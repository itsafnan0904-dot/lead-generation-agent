import { Module } from '@nestjs/common';
import { RedisModule } from '../redis/redis.module';
import { ConversationsModule } from '../conversations/conversations.module';
import { GmailSyncQueueService } from './gmail-sync.queue';
import { GmailSyncWorkerService } from './gmail-sync.worker';
import { GmailSyncSchedulerService } from './gmail-sync.scheduler';

@Module({
  imports: [RedisModule, ConversationsModule],
  providers: [
    GmailSyncQueueService,
    GmailSyncWorkerService,
    GmailSyncSchedulerService,
  ],
  exports: [
    GmailSyncQueueService,
    GmailSyncWorkerService,
    GmailSyncSchedulerService,
  ],
})
export class JobsModule {}
