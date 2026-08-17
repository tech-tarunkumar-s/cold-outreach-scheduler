import { Worker, Job } from 'bullmq';
import { redisConfig } from '../config/redis';
import { EMAIL_QUEUE_NAME, EmailJobPayload, emailQueue } from './email.queue';
import prisma from '../config/db';
import { smtpService } from '../services/smtp.service';
import { rateLimitService } from '../services/rateLimit.service';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function processEmail(job: Job<EmailJobPayload>): Promise<void> {
  const {
    emailJobId,
    senderEmail,
  
    recipientEmail,
    subject,
    body,
    hourlyLimit,
    minDelaySeconds,
  } = job.data;

  console.log(`[Worker] Starting processing job ${job.id} for email ID ${emailJobId}`);

  const emailRecord = await prisma.emailJob.findUnique({
    where: { id: emailJobId },
  });

  if (!emailRecord) {
    console.warn(`[Worker] EmailJob ${emailJobId} not found in DB. Skipping.`);
    return;
  }

  if (emailRecord.status === 'SENT') {
    console.log(
      `[Worker] EmailJob ${emailJobId} already processed (status: ${emailRecord.status}). Skipping (Idempotency).`
    );
    return;
  }

  const limitConfig =
    hourlyLimit || parseInt(process.env.MAX_EMAILS_PER_HOUR || '200', 10);
  const rateLimitResult = await rateLimitService.checkAndIncrementLimit(
    senderEmail,
    limitConfig
  );

  if (!rateLimitResult.allowed) {
    console.warn(
      `[Worker] Rate limit exceeded for sender ${senderEmail} (${rateLimitResult.currentCount}/${limitConfig}). Rescheduling job in ${rateLimitResult.msToNextHour}ms.`
    );

    const nextScheduledTime = new Date(Date.now() + rateLimitResult.msToNextHour);

    await prisma.emailJob.update({
      where: { id: emailJobId },
      data: {
        scheduledAt: nextScheduledTime,
      },
    });

    await emailQueue.add(
      'send-email',
      {
        ...job.data,
        scheduledAt: nextScheduledTime,
      },
      {
        jobId: `email_${emailJobId}_rescheduled_${nextScheduledTime.getTime()}`,
        delay: rateLimitResult.msToNextHour,
      }
    );

    return;
  }

  await prisma.emailJob.update({
    where: { id: emailJobId },
    data: { status: 'SENDING' },
  });

  try {
    const sendResult = await smtpService.sendMail(
      recipientEmail,
      subject,
      body,
      senderEmail
    );

    await prisma.emailJob.update({
      where: { id: emailJobId },
      data: {
        status: 'SENT',
        sentAt: new Date(),
        previewUrl: typeof sendResult.previewUrl === 'string' ? sendResult.previewUrl : null,
        errorMessage: null,
      },
    });
    console.log(`[Worker] Successfully sent email ID ${emailJobId}`);
  } catch (err: any) {
    console.error(`[Worker] Error sending email ${emailJobId}:`, err);
    await prisma.emailJob.update({
      where: { id: emailJobId },
      data: {
        status: 'FAILED',
        errorMessage: err?.message || 'Error delivering email',
      },
    });
  }

  const throttleSeconds =
    minDelaySeconds !== undefined
      ? minDelaySeconds
      : parseInt(process.env.MIN_DELAY_SECONDS || '2', 10);

  if (throttleSeconds > 0) {
    console.log(`[Worker] Applying throttle delay: ${throttleSeconds}s`);
    await sleep(throttleSeconds * 1000);
  }
}

export const emailWorker = new Worker<EmailJobPayload>(
  EMAIL_QUEUE_NAME,
  processEmail,
  {
    concurrency: parseInt(process.env.WORKER_CONCURRENCY || '5', 10),
    connection: redisConfig,
  }
);

emailWorker.on('ready', () => {
  console.log('[Worker] BullMQ email worker is ready and listening for jobs.');
});

emailWorker.on('failed', (job, err) => {
  console.error(`[Worker] Job ${job?.id} failed with error:`, err);
});
