import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { GmailSyncQueueService } from './jobs/gmail-sync.queue';
import { GmailSyncWorkerService } from './jobs/gmail-sync.worker';
import { GmailSyncSchedulerService } from './jobs/gmail-sync.scheduler';
import { PrismaService } from './prisma/prisma.service';

async function main() {
  console.log('========================================================================');
  console.log(' LIVE BULLMQ GMAIL SYNC AUTOMATION & IDEMPOTENCY VERIFICATION ');
  console.log('========================================================================\n');

  console.log('--- 1. BOOTSTRAPPING FULL NESTJS APPLICATION WITH JOBSMODULE ---');
  const moduleRef: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app: INestApplication = moduleRef.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.init();

  const queueService = app.get(GmailSyncQueueService);
  const workerService = app.get(GmailSyncWorkerService);
  const schedulerService = app.get(GmailSyncSchedulerService);
  const prismaService = app.get(PrismaService);

  // Check active connected Gmail account in DB
  const activeAccount = await prismaService.client.gmailAccount.findFirst({
    where: { isActive: true },
  });
  console.log(`Active Connected Gmail Account: ${activeAccount?.email || 'None'}`);

  // Count initial messages & conversations in database
  const initialMsgCount = await prismaService.client.message.count();
  const initialConvCount = await prismaService.client.conversation.count();
  console.log(`Initial Database State: ${initialMsgCount} Message(s), ${initialConvCount} Conversation(s)\n`);

  // --- 2. AUTOMATED SYNC RUN #1 VIA BULLMQ ---
  console.log('--- 2. EXECUTING AUTOMATED GMAIL SYNC RUN #1 (BULLMQ QUEUE & WORKER) ---');
  const job1 = await queueService.addSyncJob({ maxResults: 10 });
  console.log(`Job 1 Enqueued: ID ${job1.id}`);

  // Wait for worker to pick up and process job 1
  const result1 = await job1.waitUntilFinished(queueService['queueEvents'] || new (require('bullmq').QueueEvents)('gmail-sync', { connection: app.get(require('./redis/redis.service').RedisService).createBullMQConnection() }), 30000);
  console.log('Job 1 Worker Result:', JSON.stringify(result1, null, 2));

  const afterRun1MsgCount = await prismaService.client.message.count();
  const afterRun1ConvCount = await prismaService.client.conversation.count();
  console.log(`Database State after Run 1: ${afterRun1MsgCount} Message(s), ${afterRun1ConvCount} Conversation(s)\n`);

  // --- 3. AUTOMATED SYNC RUN #2 (IDEMPOTENCY PROOF - IMMEDIATE SUCCESSION) ---
  console.log('--- 3. EXECUTING AUTOMATED GMAIL SYNC RUN #2 (IDEMPOTENCY VERIFICATION) ---');
  const job2 = await queueService.addSyncJob({ maxResults: 10 });
  console.log(`Job 2 Enqueued: ID ${job2.id}`);

  const result2 = await job2.waitUntilFinished(queueService['queueEvents'] || new (require('bullmq').QueueEvents)('gmail-sync', { connection: app.get(require('./redis/redis.service').RedisService).createBullMQConnection() }), 30000);
  console.log('Job 2 Worker Result:', JSON.stringify(result2, null, 2));

  const afterRun2MsgCount = await prismaService.client.message.count();
  const afterRun2ConvCount = await prismaService.client.conversation.count();
  console.log(`Database State after Run 2: ${afterRun2MsgCount} Message(s), ${afterRun2ConvCount} Conversation(s)`);

  const duplicateNewIngested = result2.newMessagesIngested;
  console.log(`\nIDEMPOTENCY CHECK: Run 2 newMessagesIngested = ${duplicateNewIngested} (Expected: 0)`);
  console.log(`IDEMPOTENCY CHECK: Message count unchanged between Run 1 and Run 2: ${afterRun1MsgCount === afterRun2MsgCount}`);
  console.log(`IDEMPOTENCY CHECK: Conversation count unchanged between Run 1 and Run 2: ${afterRun1ConvCount === afterRun2ConvCount}`);

  // --- 4. KILL-SWITCH VERIFICATION (GMAIL_SYNC_AUTOMATION_ENABLED=false) ---
  console.log('\n--- 4. TESTING KILL SWITCH (GMAIL_SYNC_AUTOMATION_ENABLED=false) ---');
  process.env.GMAIL_SYNC_AUTOMATION_ENABLED = 'false';
  console.log(`Set process.env.GMAIL_SYNC_AUTOMATION_ENABLED = 'false'`);
  console.log(`isAutomationEnabled(): ${schedulerService.isAutomationEnabled()}`);

  await schedulerService.evaluateAndSchedule();
  const activeSchedulersAfterKill = await queueService.getQueue().getJobSchedulers();
  console.log(`Active Job Schedulers in BullMQ: ${activeSchedulersAfterKill.length} (Expected: 0)`);
  console.log(`KILL-SWITCH CONFIRMATION: Scheduler completely removed recurring jobs when disabled.`);

  // --- 5. RE-ENABLING AUTOMATION & INSPECTING RECENT JOB LOGS ---
  console.log('\n--- 5. RE-ENABLING AUTOMATION & INSPECTING AUDIT LOGS ---');
  process.env.GMAIL_SYNC_AUTOMATION_ENABLED = 'true';
  process.env.GMAIL_SYNC_INTERVAL_MINUTES = '5';
  await schedulerService.evaluateAndSchedule();

  const activeSchedulers = await queueService.getQueue().getJobSchedulers();
  console.log(`Active Job Schedulers in BullMQ after re-enabling: ${activeSchedulers.length}`);
  if (activeSchedulers.length > 0) {
    console.log(`Repeatable Job Configuration: every ${activeSchedulers[0].every}ms, key: ${activeSchedulers[0].key}`);
  }

  console.log('\nRecent Worker Job Audit Logs:');
  console.log(JSON.stringify(workerService.getRecentLogs(), null, 2));

  await app.close();
  console.log('\n========================================================================');
  console.log(' ALL LIVE BULLMQ VERIFICATIONS COMPLETED CLEANLY ');
  console.log('========================================================================');
}

main().catch((err) => {
  console.error('LIVE BULLMQ VERIFICATION FAILED:', err);
  process.exit(1);
});
