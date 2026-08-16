import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import emailRoutes from './routes/email.routes';
import prisma from './config/db';
import { emailWorker } from './queues/email.worker';
import { emailQueue } from './queues/email.queue';
import { rateLimitService } from './services/rateLimit.service';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.use('/api/emails', emailRoutes);

const server = app.listen(PORT, () => {
  console.log(`[Server] Email Job Scheduler backend running on http://localhost:${PORT}`);
});

const gracefulShutdown = async (signal: string) => {
  console.log(`\n[Server] Received ${signal}. Starting graceful shutdown...`);
  server.close(async () => {
    console.log('[Server] HTTP server closed.');
    try {
      await emailWorker.close();
      console.log('[Server] BullMQ worker stopped.');
      await emailQueue.close();
      console.log('[Server] BullMQ queue connection closed.');
      await rateLimitService.disconnect();
      console.log('[Server] Redis rate limiter connection closed.');
      await prisma.$disconnect();
      console.log('[Server] Prisma database connection closed.');
      process.exit(0);
    } catch (err) {
      console.error('[Server] Error during graceful shutdown:', err);
      process.exit(1);
    }
  });
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
