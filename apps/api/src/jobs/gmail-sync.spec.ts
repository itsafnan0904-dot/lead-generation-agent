import { Test, TestingModule } from '@nestjs/testing';
import { GmailSyncQueueService } from './gmail-sync.queue';
import { GmailSyncWorkerService } from './gmail-sync.worker';
import { GmailSyncSchedulerService } from './gmail-sync.scheduler';
import { RedisService } from '../redis/redis.service';
import { ConversationsService } from '../conversations/conversations.service';

describe('BullMQ Gmail Sync Automation & Idempotency', () => {
  let queueService: GmailSyncQueueService;
  let workerService: GmailSyncWorkerService;
  let schedulerService: GmailSyncSchedulerService;
  let conversationsService: any;
  let redisService: any;

  const mockSyncResult = {
    messagesFound: 2,
    newMessagesIngested: 2,
    skippedDuplicates: 0,
    details: [],
  };

  const mockSecondSyncResult = {
    messagesFound: 2,
    newMessagesIngested: 0,
    skippedDuplicates: 2,
    details: [],
  };

  beforeEach(async () => {
    conversationsService = {
      syncGmailInbox: jest.fn().mockResolvedValue(mockSyncResult),
    };

    redisService = {
      getRedisUrl: jest.fn().mockReturnValue('redis://localhost:6379'),
      createBullMQConnection: jest.fn().mockReturnValue({
        on: jest.fn(),
        quit: jest.fn().mockResolvedValue('OK'),
        disconnect: jest.fn(),
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GmailSyncQueueService,
        GmailSyncWorkerService,
        GmailSyncSchedulerService,
        { provide: ConversationsService, useValue: conversationsService },
        { provide: RedisService, useValue: redisService },
      ],
    }).compile();

    queueService = module.get<GmailSyncQueueService>(GmailSyncQueueService);
    workerService = module.get<GmailSyncWorkerService>(GmailSyncWorkerService);
    schedulerService = module.get<GmailSyncSchedulerService>(GmailSyncSchedulerService);
  });

  afterEach(async () => {
    jest.clearAllMocks();
  });

  describe('Worker Processing & Service Delegation', () => {
    it('worker processJob calls the exact same ConversationsService.syncGmailInbox method used by manual sync', async () => {
      const mockJob: any = {
        id: 'test-job-001',
        data: { query: 'is:unread', maxResults: 25 },
        attemptsMade: 0,
        opts: { attempts: 3 },
      };

      const result = await workerService.processJob(mockJob);

      expect(conversationsService.syncGmailInbox).toHaveBeenCalledTimes(1);
      expect(conversationsService.syncGmailInbox).toHaveBeenCalledWith({
        query: 'is:unread',
        maxResults: 25,
      });
      expect(result).toEqual(mockSyncResult);

      const logs = workerService.getRecentLogs();
      expect(logs.length).toBeGreaterThanOrEqual(1);
      expect(logs[0].jobId).toBe('test-job-001');
      expect(logs[0].status).toBe('COMPLETED');
      expect(logs[0].newMessagesIngested).toBe(2);
      expect(logs[0].skippedDuplicates).toBe(0);
    });

    it('idempotency under automation: running worker sync twice processes duplicates cleanly without re-ingestion', async () => {
      const mockJob1: any = {
        id: 'automated-job-run-1',
        data: {},
        attemptsMade: 0,
        opts: { attempts: 3 },
      };

      const mockJob2: any = {
        id: 'automated-job-run-2',
        data: {},
        attemptsMade: 0,
        opts: { attempts: 3 },
      };

      // Run 1: 2 new messages ingested
      conversationsService.syncGmailInbox.mockResolvedValueOnce(mockSyncResult);
      const res1 = await workerService.processJob(mockJob1);
      expect(res1.newMessagesIngested).toBe(2);
      expect(res1.skippedDuplicates).toBe(0);

      // Run 2: same messages found, 0 new ingested, 2 duplicates skipped
      conversationsService.syncGmailInbox.mockResolvedValueOnce(mockSecondSyncResult);
      const res2 = await workerService.processJob(mockJob2);
      expect(res2.newMessagesIngested).toBe(0);
      expect(res2.skippedDuplicates).toBe(2);

      expect(conversationsService.syncGmailInbox).toHaveBeenCalledTimes(2);

      const logs = workerService.getRecentLogs();
      expect(logs[0].jobId).toBe('automated-job-run-2');
      expect(logs[0].status).toBe('COMPLETED');
      expect(logs[0].newMessagesIngested).toBe(0);
      expect(logs[0].skippedDuplicates).toBe(2);
    });

    it('handles transient worker failure, records log as RETRYING, and throws for BullMQ backoff', async () => {
      const transientError = new Error('Google Gmail API rate limit 429');
      conversationsService.syncGmailInbox.mockRejectedValueOnce(transientError);

      const mockJob: any = {
        id: 'failing-job-001',
        data: {},
        attemptsMade: 0, // 1st attempt out of 3
        opts: { attempts: 3 },
      };

      await expect(workerService.processJob(mockJob)).rejects.toThrow(
        'Google Gmail API rate limit 429',
      );

      const logs = workerService.getRecentLogs();
      expect(logs[0].jobId).toBe('failing-job-001');
      expect(logs[0].status).toBe('RETRYING');
      expect(logs[0].error).toBe('Google Gmail API rate limit 429');
    });

    it('records FAILED status when all retries have been exhausted without crashing application', async () => {
      const fatalError = new Error('Invalid Gmail Credentials');
      conversationsService.syncGmailInbox.mockRejectedValueOnce(fatalError);

      const mockJob: any = {
        id: 'exhausted-job-002',
        data: {},
        attemptsMade: 2, // 3rd attempt out of 3
        opts: { attempts: 3 },
      };

      await expect(workerService.processJob(mockJob)).rejects.toThrow(
        'Invalid Gmail Credentials',
      );

      const logs = workerService.getRecentLogs();
      expect(logs[0].jobId).toBe('exhausted-job-002');
      expect(logs[0].status).toBe('FAILED');
      expect(logs[0].error).toBe('Invalid Gmail Credentials');
    });
  });

  describe('Scheduler & Kill-Switch Enforcement', () => {
    it('schedules recurring job when GMAIL_SYNC_AUTOMATION_ENABLED is true', async () => {
      process.env.GMAIL_SYNC_AUTOMATION_ENABLED = 'true';
      process.env.GMAIL_SYNC_INTERVAL_MINUTES = '10';

      const scheduleSpy = jest
        .spyOn(queueService, 'scheduleRecurringSync')
        .mockResolvedValue({ id: 'repeat-job-10m' } as any);

      await schedulerService.evaluateAndSchedule();

      expect(scheduleSpy).toHaveBeenCalledWith(10);
    });

    it('kill-switch: GMAIL_SYNC_AUTOMATION_ENABLED=false genuinely removes recurring job and prevents scheduling', async () => {
      process.env.GMAIL_SYNC_AUTOMATION_ENABLED = 'false';

      const scheduleSpy = jest.spyOn(queueService, 'scheduleRecurringSync');
      const removeSpy = jest
        .spyOn(queueService, 'removeRecurringSync')
        .mockResolvedValue(1);

      await schedulerService.evaluateAndSchedule();

      expect(scheduleSpy).not.toHaveBeenCalled();
      expect(removeSpy).toHaveBeenCalledTimes(1);
    });

    it('falls back to default 5 minute interval if GMAIL_SYNC_INTERVAL_MINUTES is invalid or unset', async () => {
      process.env.GMAIL_SYNC_AUTOMATION_ENABLED = 'true';
      delete process.env.GMAIL_SYNC_INTERVAL_MINUTES;

      const scheduleSpy = jest
        .spyOn(queueService, 'scheduleRecurringSync')
        .mockResolvedValue({ id: 'repeat-job-5m' } as any);

      await schedulerService.evaluateAndSchedule();

      expect(scheduleSpy).toHaveBeenCalledWith(5);
    });
  });
});
