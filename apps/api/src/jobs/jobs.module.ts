import { Module } from '@nestjs/common';
import { RedisModule } from '../redis/redis.module';
import { ConversationsModule } from '../conversations/conversations.module';
import { GmailSyncQueueService } from './gmail-sync.queue';
import { GmailSyncWorkerService } from './gmail-sync.worker';
import { GmailSyncSchedulerService } from './gmail-sync.scheduler';
import { FollowUpsModule } from '../follow-ups/follow-ups.module';
import { FollowUpQueueService, FollowUpWorkerService, FollowUpSchedulerService } from './follow-up.jobs';

@Module({
  imports: [RedisModule, ConversationsModule, FollowUpsModule],
  providers: [
    GmailSyncQueueService,
    GmailSyncWorkerService,
    GmailSyncSchedulerService,
    FollowUpQueueService,
    FollowUpWorkerService,
    FollowUpSchedulerService,
  ],
  exports: [
    GmailSyncQueueService,
    GmailSyncWorkerService,
    GmailSyncSchedulerService,
  ],
})
export class JobsModule {}
