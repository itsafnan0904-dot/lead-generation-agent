import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Queue, JobsOptions, QueueEvents } from 'bullmq';
import { RedisService } from '../redis/redis.service';
import { SyncGmailQueryDto } from '../conversations/dto/conversation.dto';

export const GMAIL_SYNC_QUEUE_NAME = 'gmail-sync';
export const RECURRING_GMAIL_SYNC_JOB_ID = 'recurring-gmail-sync-job';

@Injectable()
export class GmailSyncQueueService implements OnModuleDestroy {
  private readonly logger = new Logger(GmailSyncQueueService.name);
  private queue: Queue | null = null;
  private queueEvents: QueueEvents | null = null;

  constructor(private readonly redisService: RedisService) {
    this.initQueue();
  }

  private initQueue(): Queue {
    if (!this.queue) {
      const connection = this.redisService.createBullMQConnection();
      this.queue = new Queue(GMAIL_SYNC_QUEUE_NAME, {
        connection,
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5000,
          },
          removeOnComplete: {
            age: 24 * 3600, // 24 hours
            count: 1000,
          },
          removeOnFail: {
            age: 7 * 24 * 3600, // 7 days
            count: 5000,
          },
        },
      });

      this.queue.on('error', (err) => {
        this.logger.error(`BullMQ Gmail Sync Queue error: ${err.message}`, err.stack);
      });
    }

    return this.queue;
  }

  /**
   * Adds a manual or immediate Gmail sync job to the queue.
   */
  async addSyncJob(dto: SyncGmailQueryDto = {}, customOpts?: JobsOptions) {
    const queue = this.initQueue();
    const job = await queue.add('sync-inbox', dto, {
      ...customOpts,
    });
    this.logger.log(`Enqueued Gmail Sync Job ${job.id}`);
    return job;
  }

  /**
   * Configures or updates the repeatable sync job scheduler.
   */
  async scheduleRecurringSync(intervalMinutes: number) {
    const queue = this.initQueue();
    const intervalMs = Math.max(intervalMinutes, 1) * 60 * 1000;

    const scheduler = await queue.upsertJobScheduler(
      RECURRING_GMAIL_SYNC_JOB_ID,
      {
        every: intervalMs,
      },
      {
        name: 'recurring-sync-inbox',
        data: {},
      },
    );

    this.logger.log(
      `Scheduled recurring Gmail inbox sync every ${intervalMinutes} minute(s) (${intervalMs}ms). Scheduler ID: ${RECURRING_GMAIL_SYNC_JOB_ID}`,
    );
    return scheduler;
  }

  /**
   * Removes repeatable sync jobs (used when kill-switch is active or re-scheduling).
   */
  async removeRecurringSync(): Promise<number> {
    const queue = this.initQueue();
    const schedulers = await queue.getJobSchedulers();
    let removedCount = 0;

    for (const sched of schedulers) {
      if (sched.key === RECURRING_GMAIL_SYNC_JOB_ID || sched.name === 'recurring-sync-inbox') {
        await queue.removeJobScheduler(sched.key);
        removedCount++;
      }
    }

    if (removedCount > 0) {
      this.logger.log(`Removed ${removedCount} recurring Gmail sync job scheduler(s).`);
    }

    return removedCount;
  }

  getQueue(): Queue {
    return this.initQueue();
  }

  async onModuleDestroy() {
    if (this.queueEvents) {
      await this.queueEvents.close().catch(() => {});
    }
    if (this.queue) {
      await this.queue.close().catch(() => {});
      this.logger.log('Gmail Sync Queue closed cleanly.');
    }
  }
}
