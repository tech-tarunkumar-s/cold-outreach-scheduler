import { Request, Response } from 'express';
import prisma from '../config/db';
import { addEmailJob, emailQueue } from '../queues/email.queue';

export class EmailController {
  async scheduleEmails(req: Request, res: Response): Promise<void> {
    try {
      const {
        userId,
        senderEmail,
        subject,
        body,
        recipients,
        scheduledAt,
        delayBetweenSeconds,
        hourlyLimit,
      } = req.body;

      if (!senderEmail || !subject || !body || !recipients || !Array.isArray(recipients) || recipients.length === 0) {
        res.status(400).json({ error: 'Missing required fields or recipients array is empty.' });
        return;
      }

      const scheduleDate = scheduledAt ? new Date(scheduledAt) : new Date();
      if (isNaN(scheduleDate.getTime())) {
        res.status(400).json({ error: 'Invalid scheduledAt datetime.' });
        return;
      }

      if (userId) {
        try {
          const userExists = await prisma.user.findUnique({ where: { id: userId } });
          if (!userExists) {
            await prisma.user.create({
              data: {
                id: userId,
                email: senderEmail,
              },
            });
          }
        } catch (uErr) {
          console.warn('[EmailController] Note on User creation/lookup:', uErr);
        }
      }

      const throttleDelaySec =
        delayBetweenSeconds !== undefined
          ? Number(delayBetweenSeconds)
          : parseInt(process.env.MIN_DELAY_SECONDS || '2', 10);

      const createdJobs = await prisma.$transaction(
        recipients.map((recipient: string, index: number) => {
          const itemScheduledTime = new Date(
            scheduleDate.getTime() + index * throttleDelaySec * 1000
          );

          return prisma.emailJob.create({
            data: {
              userId: userId || null,
              senderEmail,
              recipientEmail: recipient.trim(),
              subject,
              body,
              scheduledAt: itemScheduledTime,
              status: 'SCHEDULED',
            },
          });
        })
      );

      for (const jobRecord of createdJobs) {
        await addEmailJob({
          emailJobId: jobRecord.id,
          senderEmail: jobRecord.senderEmail,
          recipientEmail: jobRecord.recipientEmail,
          subject: jobRecord.subject,
          body: jobRecord.body,
          scheduledAt: jobRecord.scheduledAt,
          hourlyLimit: hourlyLimit ? Number(hourlyLimit) : undefined,
          minDelaySeconds: throttleDelaySec,
        });
      }

      res.status(201).json({
        success: true,
        count: createdJobs.length,
        message: 'Emails scheduled successfully',
        jobs: createdJobs,
      });
    } catch (error: any) {
      console.error('[EmailController] Error scheduling emails:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }

  async getScheduledEmails(req: Request, res: Response): Promise<void> {
    try {
      const scheduledEmails = await prisma.emailJob.findMany({
        where: {
          status: 'SCHEDULED',
        },
        orderBy: {
          scheduledAt: 'asc',
        },
      });

      res.json(scheduledEmails || []);
    } catch (error: any) {
      console.error('[EmailController] Error fetching scheduled emails (DB might need migration):', error);
      res.status(500).json({ error: error.message || 'Failed to query database. Ensure migrations are applied.' });
    }
  }

  async getSentEmails(req: Request, res: Response): Promise<void> {
    try {
      const sentEmails = await prisma.emailJob.findMany({
        where: {
          status: {
            in: ['SENT', 'FAILED', 'SENDING'],
          },
        },
        orderBy: {
          sentAt: 'desc',
        },
      });

      res.json(sentEmails || []);
    } catch (error: any) {
      console.error('[EmailController] Error fetching sent emails:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }

  async getDashboardStats(req: Request, res: Response): Promise<void> {
    try {
      const [scheduledCount, sentCount, failedCount, totalCount] =
        await Promise.all([
          prisma.emailJob.count({ where: { status: 'SCHEDULED' } }).catch(() => 0),
          prisma.emailJob.count({ where: { status: 'SENT' } }).catch(() => 0),
          prisma.emailJob.count({ where: { status: 'FAILED' } }).catch(() => 0),
          prisma.emailJob.count().catch(() => 0),
        ]);

      res.json({
        scheduled: scheduledCount,
        sent: sentCount,
        failed: failedCount,
        total: totalCount,
      });
    } catch (error: any) {
      console.error('[EmailController] Error fetching stats:', error);
      res.json({ scheduled: 0, sent: 0, failed: 0, total: 0 });
    }
  }

  async cancelEmail(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const email = await prisma.emailJob.findUnique({ where: { id } });
      if (!email) {
        res.status(404).json({ error: 'Email job not found' });
        return;
      }

      if (email.status !== 'SCHEDULED') {
        res.status(400).json({ error: `Cannot cancel email with status ${email.status}` });
        return;
      }

      const bullJob = await emailQueue.getJob(`email_${id}`);
      if (bullJob) {
        await bullJob.remove();
      }

      await prisma.emailJob.delete({
        where: { id },
      });

      res.json({ success: true, message: 'Email scheduled job cancelled successfully' });
    } catch (error: any) {
      console.error('[EmailController] Error cancelling email:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }
}

export const emailController = new EmailController();
