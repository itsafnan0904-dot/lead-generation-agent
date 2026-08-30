import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private redisClient: Redis | null = null;
  private readonly redisUrl: string;

  constructor() {
    this.redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    this.initClient();
  }

  private initClient(): Redis {
    if (this.redisClient && this.redisClient.status !== 'end') {
      return this.redisClient;
    }

    this.redisClient = new Redis(this.redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      retryStrategy: (times) => {
        // Linear backoff maxing at 2 seconds
        return Math.min(times * 200, 2000);
      },
      reconnectOnError: () => true,
    });

    this.redisClient.on('error', (err) => {
      this.logger.warn(`Redis connection event: ${err.message}`);
    });

    return this.redisClient;
  }

  async ping(timeoutMs = 1500): Promise<{ ok: boolean; latencyMs?: number; error?: string }> {
    const start = Date.now();
    try {
      const client = this.initClient();

      if (client.status === 'wait' || client.status === 'close' || client.status === 'end') {
        if (client.status === 'end') {
          this.redisClient = null;
          return this.ping(timeoutMs);
        }
        await Promise.race([
          client.connect(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Redis connect timed out')), timeoutMs),
          ),
        ]);
      }

      const pingPromise = client.ping();
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Redis ping timed out')), timeoutMs),
      );

      const res = await Promise.race([pingPromise, timeoutPromise]);
      const latencyMs = Date.now() - start;

      if (res === 'PONG') {
        return { ok: true, latencyMs };
      }
      return { ok: false, latencyMs, error: `Unexpected ping response: ${res}` };
    } catch (error) {
      const latencyMs = Date.now() - start;
      return {
        ok: false,
        latencyMs,
        error: (error as Error).message || 'Failed to ping Redis',
      };
    }
  }

  async onModuleDestroy() {
    if (this.redisClient && this.redisClient.status !== 'end') {
      try {
        await this.redisClient.quit();
        this.logger.log('Redis client disconnected cleanly.');
      } catch {
        this.redisClient.disconnect();
      }
    }
  }
}
