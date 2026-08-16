import Redis from 'ioredis';
import dotenv from 'dotenv';
dotenv.config();

export class RateLimitService {
  private redis: Redis;

  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD || undefined,
      tls: process.env.REDIS_TLS === 'true' ? {} : undefined,
      maxRetriesPerRequest: null,
    });
  }

  private getCurrentHourKey(senderEmail: string, date: Date = new Date()): string {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    const hour = String(date.getUTCHours()).padStart(2, '0');
    return `ratelimit:${senderEmail}:${year}-${month}-${day}-${hour}`;
  }

  private getMsRemainingInHour(date: Date = new Date()): number {
    const nextHour = new Date(date);
    nextHour.setUTCMinutes(0, 0, 0);
    nextHour.setUTCHours(nextHour.getUTCHours() + 1);
    return Math.max(1000, nextHour.getTime() - date.getTime());
  }

  async checkAndIncrementLimit(
    senderEmail: string,
    hourlyLimit: number = parseInt(process.env.MAX_EMAILS_PER_HOUR || '200', 10)
  ): Promise<{ allowed: boolean; msToNextHour: number; currentCount: number }> {
    const now = new Date();
    const key = this.getCurrentHourKey(senderEmail, now);
    const msToNextHour = this.getMsRemainingInHour(now);

    const count = await this.redis.incr(key);

    if (count === 1) {
      const ttlSeconds = Math.ceil(msToNextHour / 1000) + 60;
      await this.redis.expire(key, ttlSeconds);
    }

    if (count > hourlyLimit) {
      return {
        allowed: false,
        msToNextHour,
        currentCount: count,
      };
    }

    return {
      allowed: true,
      msToNextHour,
      currentCount: count,
    };
  }

  async decrementLimit(senderEmail: string): Promise<void> {
    const key = this.getCurrentHourKey(senderEmail);
    await this.redis.decr(key);
  }

  async disconnect(): Promise<void> {
    await this.redis.quit();
  }
}

export const rateLimitService = new RateLimitService();
