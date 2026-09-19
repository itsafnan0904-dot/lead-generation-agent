import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Worker, Job } from 'bullmq';
import { RedisService } from '../redis/redis.service';
import { ConversationsService } from '../conversations/conversations.service';
import { GMAIL_SYNC_QUEUE_NAME } from './gmail-sync.queue';

export interface SyncJobLog {
  jobId: string;
  attempt: number;
  maxAttempts: number;
  status: 'COMPLETED' | 'FAILED' | 'RETRYING';
  messagesFound?: number;
  newMessagesIngested?: number;
  skippedDuplicates?: number;
  error?: string;
  timestamp: string;
  durationMs: number;
}

@Injectable()
export class GmailSyncWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(GmailSyncWorkerService.name);
  private worker: Worker | null = null;
  private readonly recentJobLogs: SyncJobLog[] = [];

  constructor(
    private readonly redisService: RedisService,
    private readonly conversationsService: ConversationsService,
  ) {}

  onModuleInit() {
    this.initWorker();
  }

  private initWorker(): Worker {
    if (!this.worker) {
      const connection = this.redisService.createBullMQConnection();

      this.worker = new Worker(
        GMAIL_SYNC_QUEUE_NAME,
        async (job: Job) => {
          return this.processJob(job);
        },
        {
          connection,
          concurrency: 1, // Process one sync at a time to prevent race conditions
        },
      );

      this.worker.on('completed', (job: Job, returnvalue: any) => {
        this.logger.log(
          `[GMAIL_SYNC_WORKER] Job ${job.id} completed successfully. Found: ${returnvalue?.messagesFound || 0}, Ingested: ${returnvalue?.newMessagesIngested || 0}, Skipped: ${returnvalue?.skippedDuplicates || 0}`,
        );
      });

      this.worker.on('failed', (job: Job | undefined, err: Error) => {
        const jobId = job?.id || 'unknown';
        const attemptsMade = job?.attemptsMade || 1;
        const maxAttempts = job?.opts.attempts || 3;
        const willRetry = attemptsMade < maxAttempts;

        this.logger.error(
          `[GMAIL_SYNC_WORKER] Job ${jobId} failed on attempt ${attemptsMade}/${maxAttempts}. ${willRetry ? 'Will retry with backoff.' : 'All retries exhausted.'} Error: ${err.message}`,
          err.stack,
        );
      });

      this.worker.on('error', (err: Error) => {
        this.logger.error(`[GMAIL_SYNC_WORKER] Internal worker error: ${err.message}`, err.stack);
      });

      this.logger.log('Gmail Sync BullMQ Worker initialized and listening for jobs.');
    }

    return this.worker;
  }

  /**
   * Processes a sync job by invoking the existing, verified ConversationsService.syncGmailInbox logic.
   */
  async processJob(job: Job) {
    const startTime = Date.now();
    const jobId = String(job.id || 'manual');
    const attempt = (job.attemptsMade || 0) + 1;
    const maxAttempts = job.opts.attempts || 3;

    this.logger.log(`[GMAIL_SYNC_WORKER] Starting sync execution for job ${jobId} (Attempt ${attempt}/${maxAttempts})...`);

    try {
      // Calls existing ConversationsService logic - zero logic duplication
      const syncResult = await this.conversationsService.syncGmailInbox(job.data || {});
      const durationMs = Date.now() - startTime;

      const logEntry: SyncJobLog = {
        jobId,
        attempt,
        maxAttempts,
        status: 'COMPLETED',
        messagesFound: syncResult.messagesFound,
        newMessagesIngested: syncResult.newMessagesIngested,
        skippedDuplicates: syncResult.skippedDuplicates,
        timestamp: new Date().toISOString(),
        durationMs,
      };

      this.recordJobLog(logEntry);
      return syncResult;
    } catch (error: any) {
      const durationMs = Date.now() - startTime;
      const willRetry = attempt < maxAttempts;

      const logEntry: SyncJobLog = {
        jobId,
        attempt,
        maxAttempts,
        status: willRetry ? 'RETRYING' : 'FAILED',
        error: error.message || 'Unknown sync error',
        timestamp: new Date().toISOString(),
        durationMs,
      };

      this.recordJobLog(logEntry);
      // Re-throw so BullMQ triggers retry and backoff mechanism
      throw error;
    }
  }

  private recordJobLog(entry: SyncJobLog) {
    this.recentJobLogs.unshift(entry);
    if (this.recentJobLogs.length > 100) {
      this.recentJobLogs.pop();
    }
  }

  getRecentLogs(): SyncJobLog[] {
    return [...this.recentJobLogs];
  }

  getWorker(): Worker | null {
    return this.worker;
  }

  async onModuleDestroy() {
    if (this.worker) {
      await this.worker.close().catch(() => {});
      this.logger.log('Gmail Sync BullMQ Worker closed cleanly.');
    }
  }
}
