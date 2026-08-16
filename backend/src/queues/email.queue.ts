import { Queue } from 'bullmq';
import { redisConfig } from '../config/redis';

export interface EmailJobPayload {
  emailJobId: string;
  senderEmail: string;
  recipientEmail: string;
  subject: string;
  body: string;
  scheduledAt: string | Date;
  hourlyLimit?: number;
  minDelaySeconds?: number;
}

export const EMAIL_QUEUE_NAME = 'emailQueue';

export const emailQueue = new Queue<EmailJobPayload>(EMAIL_QUEUE_NAME, {
  connection: redisConfig,
  defaultJobOptions: {
    removeOnComplete: false,
    removeOnFail: false,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
  },
});

export async function addEmailJob(payload: EmailJobPayload): Promise<void> {
  const scheduledTime = new Date(payload.scheduledAt).getTime();
  const now = Date.now();
  const delay = Math.max(0, scheduledTime - now);

  await emailQueue.add(
    'send-email',
    payload,
    {
      jobId: `email_${payload.emailJobId}`,
      delay,
    }
  );

  console.log(
    `[Queue] Added job for email ${payload.emailJobId} scheduled at ${new Date(
      scheduledTime
    ).toISOString()} with delay ${delay}ms`
  );
}
