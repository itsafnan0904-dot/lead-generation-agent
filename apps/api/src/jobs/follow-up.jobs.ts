import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Queue, Worker, Job } from 'bullmq';
import { RedisService } from '../redis/redis.service';
import { FollowUpService } from '../follow-ups/follow-up.service';

export const FOLLOW_UP_QUEUE_NAME = 'follow-up-scan';
export const RECURRING_FOLLOW_UP_JOB_ID = 'recurring-follow-up-scan';

/** Off unless explicitly enabled: follow-ups are new outbound behaviour, so they are opt-in. */
export function isFollowUpAutomationEnabled(raw: string | undefined = process.env.FOLLOW_UP_AUTOMATION_ENABLED): boolean {
  const v = (raw ?? 'false').trim().toLowerCase();
  return v === 'true' || v === '1';
}

export function getFollowUpScanIntervalMinutes(raw: string | undefined = process.env.FOLLOW_UP_SCAN_INTERVAL_MINUTES): number {
  const n = parseInt(raw || '60', 10);
  return isNaN(n) || n <= 0 ? 60 : n;
}

@Injectable()
export class FollowUpQueueService implements OnModuleDestroy {
  private readonly logger = new Logger(FollowUpQueueService.name);
  private queue: Queue | null = null;

  constructor(private readonly redisService: RedisService) {}

  getQueue(): Queue {
    if (!this.queue) {
      this.queue = new Queue(FOLLOW_UP_QUEUE_NAME, {
        connection: this.redisService.createBullMQConnection(),
        defaultJobOptions: {
          attempts: 2,
          backoff: { type: 'exponential', delay: 30_000 },
          removeOnComplete: { age: 24 * 3600, count: 200 },
          removeOnFail: { age: 7 * 24 * 3600, count: 500 },
        },
      });
      this.queue.on('error', (err) => this.logger.error(`Follow-up queue error: ${err.message}`, err.stack));
    }
    return this.queue;
  }

  async scheduleRecurring(intervalMinutes: number) {
    await this.getQueue().upsertJobScheduler(
      RECURRING_FOLLOW_UP_JOB_ID,
      { every: Math.max(intervalMinutes, 1) * 60_000 },
      { name: 'scan-follow-ups', data: {} },
    );
    this.logger.log(`Scheduled follow-up scan every ${intervalMinutes} minute(s).`);
  }

  async removeRecurring(): Promise<void> {
    const queue = this.getQueue();
    for (const s of await queue.getJobSchedulers()) {
      if (s.key === RECURRING_FOLLOW_UP_JOB_ID) await queue.removeJobScheduler(s.key);
    }
  }

  async onModuleDestroy() {
    if (this.queue) await this.queue.close().catch(() => {});
  }
}

@Injectable()
export class FollowUpWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(FollowUpWorkerService.name);
  private worker: Worker | null = null;

  constructor(
    private readonly redisService: RedisService,
    private readonly followUpService: FollowUpService,
  ) {}

  onModuleInit() {
    // Don't open a Redis worker connection at all while the feature is switched off
    if (!isFollowUpAutomationEnabled()) return;
    this.worker = new Worker(FOLLOW_UP_QUEUE_NAME, async (_job: Job) => this.followUpService.scanAndProcess(), {
      connection: this.redisService.createBullMQConnection(),
      concurrency: 1, // one scan at a time so a slow scan can never double-send
    });
    this.worker.on('failed', (job, err) => this.logger.error(`Follow-up scan ${job?.id} failed: ${err.message}`, err.stack));
    this.worker.on('error', (err) => this.logger.error(`Follow-up worker error: ${err.message}`, err.stack));
  }

  async onModuleDestroy() {
    if (this.worker) await this.worker.close().catch(() => {});
  }
}

@Injectable()
export class FollowUpSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(FollowUpSchedulerService.name);

  constructor(private readonly queueService: FollowUpQueueService) {}

  async onModuleInit() {
    if (!isFollowUpAutomationEnabled()) {
      this.logger.warn('[FOLLOW_UP_SCHEDULER] FOLLOW_UP_AUTOMATION_ENABLED is not true. Scheduled follow-ups are DISABLED.');
      await this.queueService.removeRecurring().catch((e) => this.logger.warn(`Could not clear follow-up scheduler: ${e.message}`));
      return;
    }
    await this.queueService.scheduleRecurring(getFollowUpScanIntervalMinutes());
  }
}
