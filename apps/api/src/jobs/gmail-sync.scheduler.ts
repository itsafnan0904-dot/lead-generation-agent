import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { GmailSyncQueueService } from './gmail-sync.queue';

@Injectable()
export class GmailSyncSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(GmailSyncSchedulerService.name);

  constructor(private readonly queueService: GmailSyncQueueService) {}

  async onModuleInit() {
    await this.evaluateAndSchedule();
  }

  /**
   * Checks environment configuration and configures repeatable job or enforces kill-switch.
   */
  async evaluateAndSchedule() {
    const isEnabled = this.isAutomationEnabled();
    const intervalMinutes = this.getIntervalMinutes();

    if (!isEnabled) {
      this.logger.warn(
        '[GMAIL_SYNC_SCHEDULER] GMAIL_SYNC_AUTOMATION_ENABLED is FALSE. Scheduled Gmail inbox sync is DISABLED (Kill-switch active).',
      );
      await this.queueService.removeRecurringSync();
      return;
    }

    this.logger.log(
      `[GMAIL_SYNC_SCHEDULER] GMAIL_SYNC_AUTOMATION_ENABLED is TRUE. Initializing recurring sync every ${intervalMinutes} minute(s).`,
    );
    await this.queueService.scheduleRecurringSync(intervalMinutes);
  }

  isAutomationEnabled(): boolean {
    const rawVal = process.env.GMAIL_SYNC_AUTOMATION_ENABLED;
    if (rawVal === undefined || rawVal === null || rawVal === '') {
      return true; // default true
    }
    return rawVal.toLowerCase() === 'true' || rawVal === '1';
  }

  getIntervalMinutes(): number {
    const rawVal = process.env.GMAIL_SYNC_INTERVAL_MINUTES;
    const parsed = parseInt(rawVal || '5', 10);
    return isNaN(parsed) || parsed <= 0 ? 5 : parsed;
  }

  async enableAutomation(intervalMinutes?: number): Promise<void> {
    const interval = intervalMinutes || this.getIntervalMinutes();
    this.logger.log(`[GMAIL_SYNC_SCHEDULER] Manually enabling scheduled automation (${interval}m interval).`);
    await this.queueService.scheduleRecurringSync(interval);
  }

  async disableAutomation(): Promise<void> {
    this.logger.log('[GMAIL_SYNC_SCHEDULER] Manually disabling scheduled automation (Kill-switch).');
    await this.queueService.removeRecurringSync();
  }

  async onModuleDestroy() {
    this.logger.log('Gmail Sync Scheduler destroyed.');
  }
}
