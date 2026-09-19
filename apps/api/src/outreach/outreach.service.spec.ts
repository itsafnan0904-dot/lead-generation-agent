import { Test, TestingModule } from '@nestjs/testing';
import { OutreachService } from './outreach.service';
import { PrismaService } from '../prisma/prisma.service';
import { GmailService } from '../gmail/gmail.service';
import { AIOrchestratorService } from '../ai/services/ai-orchestrator.service';
import { RestrictionEngineService } from '../restrictions/restriction-engine.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  LeadLifecycleStatus,
  OutreachDraftStatus,
} from '@ai-sales-agent/database';
import { BadRequestException, ConflictException } from '@nestjs/common';

describe('OutreachService', () => {
  let service: OutreachService;
  let prismaMock: any;
  let gmailMock: any;
  let aiOrchestratorMock: any;
  let restrictionEngineMock: any;
  let auditServiceMock: any;

  beforeEach(async () => {
    prismaMock = {
      client: {
        lead: {
          findUnique: jest.fn(),
          update: jest.fn(),
        },
        outreachDraft: {
          create: jest.fn(),
          findUnique: jest.fn(),
          update: jest.fn(),
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          findMany: jest.fn(),
          count: jest.fn(),
        },
        gmailAccount: {
          findFirst: jest.fn(),
        },
        user: {
          findFirst: jest.fn(),
        },
      },
    };

    gmailMock = {
      sendEmail: jest.fn(),
    };

    aiOrchestratorMock = {
      generateEmail: jest.fn(),
    };

    restrictionEngineMock = {
      evaluate: jest.fn(),
    };

    auditServiceMock = {
      log: jest.fn().mockResolvedValue({ id: 'audit-outreach-1' }),
    };

    const notificationsServiceMock = {
      create: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OutreachService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: GmailService, useValue: gmailMock },
        { provide: AIOrchestratorService, useValue: aiOrchestratorMock },
        { provide: RestrictionEngineService, useValue: restrictionEngineMock },
        { provide: AuditService, useValue: auditServiceMock },
        { provide: NotificationsService, useValue: notificationsServiceMock },
      ],
    }).compile();

    service = module.get<OutreachService>(OutreachService);
  });

  describe('Draft Generation', () => {
    it('Scenario 1: Draft generation resolves sender identity, passes to AI, and does NOT call GmailService', async () => {
      const mockLead = {
        id: 'lead-1',
        status: LeadLifecycleStatus.COLD_LEAD,
        company: { name: 'Precision Engineering LLC', industry: 'Fabrication' },
        primaryContact: { firstName: 'Sarah', lastName: 'Connor', email: 'sarah@precision.com' },
        assignedUser: { name: 'Afnan Jawad', email: 'afnanjawad174m@gmail.com', role: 'ADMIN' },
        research: [{ companySummary: 'High precision machining.', keyInsights: ['Expanding Midwest facilities'] }],
      };

      prismaMock.client.lead.findUnique.mockResolvedValue(mockLead);
      aiOrchestratorMock.generateEmail.mockResolvedValue({
        data: {
          subject: 'Collaborating on Precision Engineering',
          bodyText: 'Hi Sarah, noticed your Midwest expansion...\n\nBest regards,\nAfnan Jawad\nSales Director',
          bodyHtml: '<p>Hi Sarah...</p><p>Best regards,<br/>Afnan Jawad<br/>Sales Director</p>',
          callToAction: 'Can we connect next Tuesday?',
          rationale: 'Addresses Midwest facility expansion',
          personalizationPointsUsed: ['Midwest expansion'],
        },
        metadata: {
          actionId: 'action-draft-1',
          modelUsed: 'gpt-4o-mini',
          usage: { totalTokens: 250 },
        },
      });

      prismaMock.client.outreachDraft.create.mockImplementation((args: any) => ({
        id: 'draft-1',
        ...args.data,
      }));

      const result = await service.generateDraft('lead-1', { tone: 'consultative' });

      expect(result.id).toBe('draft-1');
      expect(result.status).toBe(OutreachDraftStatus.DRAFT);
      expect(gmailMock.sendEmail).not.toHaveBeenCalled();

      // Verify AI orchestrator was invoked with real sender identity
      expect(aiOrchestratorMock.generateEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientName: 'Sarah Connor',
          companyName: 'Precision Engineering LLC',
          senderName: 'Afnan Jawad',
          senderTitle: 'Sales Director',
          senderEmail: 'afnanjawad174m@gmail.com',
        }),
        { leadId: 'lead-1' },
      );

      // Verify draft body contains no placeholder markers
      const placeholderPattern = /\[(Your |Name|Position|Company|Contact|Title|Phone|Email)[\w\s]*\]/i;
      expect(placeholderPattern.test(result.bodyText)).toBe(false);
      expect(result.bodyText).not.toContain('[Your Name]');
      expect(result.bodyText).not.toContain('[Your Company]');
      expect(result.bodyText).toContain('Afnan Jawad');
    });

    it('Scenario 1b: When assignedUser is null, resolves sender from connected GmailAccount or Admin fallback', async () => {
      const mockLeadNoUser = {
        id: 'lead-no-user',
        status: LeadLifecycleStatus.COLD_LEAD,
        company: { name: 'Precision Engineering LLC', industry: 'Fabrication' },
        primaryContact: { firstName: 'Sarah', lastName: 'Connor', email: 'sarah@precision.com' },
        assignedUser: null,
        research: [],
      };

      prismaMock.client.lead.findUnique.mockResolvedValue(mockLeadNoUser);
      prismaMock.client.gmailAccount.findFirst.mockResolvedValue({
        id: 'gmail-1',
        email: 'itsafnan0904@gmail.com',
        isActive: true,
        connectedByUser: {
          name: 'Afnan Jawad',
          email: 'afnanjawad174m@gmail.com',
          role: 'ADMIN',
        },
      });

      aiOrchestratorMock.generateEmail.mockResolvedValue({
        data: {
          subject: 'Precision Engineering inquiry',
          bodyText: 'Hi Sarah...\n\nBest regards,\nAfnan Jawad',
          bodyHtml: '<p>Hi Sarah...</p>',
          callToAction: 'Can we connect?',
          rationale: 'Initial outreach',
          personalizationPointsUsed: [],
        },
        metadata: { modelUsed: 'gpt-4o-mini', usage: { totalTokens: 200 } },
      });

      prismaMock.client.outreachDraft.create.mockImplementation((args: any) => ({
        id: 'draft-2',
        ...args.data,
      }));

      const result = await service.generateDraft('lead-no-user', {});

      expect(aiOrchestratorMock.generateEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          senderName: 'Afnan Jawad',
          senderEmail: 'itsafnan0904@gmail.com',
          senderTitle: 'Sales Director',
        }),
        { leadId: 'lead-no-user' },
      );
      expect(result.bodyText).not.toContain('[Your Name]');
    });

    it('Scenario 2: Draft generation is refused for a RESTRICTED lead', async () => {
      const mockRestrictedLead = {
        id: 'lead-restricted',
        status: LeadLifecycleStatus.RESTRICTED,
        company: { name: 'Restricted Joist Corp' },
      };

      prismaMock.client.lead.findUnique.mockResolvedValue(mockRestrictedLead);

      await expect(service.generateDraft('lead-restricted', {})).rejects.toThrow(BadRequestException);
      expect(aiOrchestratorMock.generateEmail).not.toHaveBeenCalled();
      expect(gmailMock.sendEmail).not.toHaveBeenCalled();
    });
  });

  describe('Sending & Duplicate Protection', () => {
    it('Scenario 3: Sending a draft twice (retry) only sends once; second attempt is rejected with 409 Conflict', async () => {
      const mockLead = {
        id: 'lead-send-1',
        status: LeadLifecycleStatus.COLD_LEAD,
        company: { name: 'Apex Forging' },
        primaryContact: { email: 'prospect@apexforging.com' },
      };

      // 1st call: draft is DRAFT
      prismaMock.client.outreachDraft.findUnique
        .mockResolvedValueOnce({
          id: 'draft-to-send',
          leadId: 'lead-send-1',
          status: OutreachDraftStatus.DRAFT,
          subject: 'Partnership Inquiry',
          bodyText: 'Hello from sales',
          lead: mockLead,
        })
        // 2nd call: draft is now SENT
        .mockResolvedValueOnce({
          id: 'draft-to-send',
          leadId: 'lead-send-1',
          status: OutreachDraftStatus.SENT,
          subject: 'Partnership Inquiry',
          bodyText: 'Hello from sales',
          lead: mockLead,
        });

      prismaMock.client.outreachDraft.count.mockResolvedValue(0); // Under daily limit
      gmailMock.sendEmail.mockResolvedValue({ messageId: 'gmail-sent-001', threadId: 'thread-001' });

      prismaMock.client.outreachDraft.update.mockResolvedValue({
        id: 'draft-to-send',
        status: OutreachDraftStatus.SENT,
        gmailMessageId: 'gmail-sent-001',
      });

      // 1st attempt: succeeds
      const sendResult1 = await service.sendDraft('draft-to-send');
      expect(sendResult1.status).toBe(OutreachDraftStatus.SENT);
      expect(gmailMock.sendEmail).toHaveBeenCalledTimes(1);

      // 2nd attempt: throws ConflictException
      await expect(service.sendDraft('draft-to-send')).rejects.toThrow(ConflictException);
      // Still only called once!
      expect(gmailMock.sendEmail).toHaveBeenCalledTimes(1);
    });

    it('Scenario 3b: Genuinely concurrent send attempts (Promise.all) - exactly ONE succeeds and sends email, all others receive 409 Conflict', async () => {
      const mockLead = {
        id: 'lead-concurrent-race',
        status: LeadLifecycleStatus.COLD_LEAD,
        company: { name: 'Titan Industrial Systems' },
        primaryContact: { email: 'david@titan-industrial.com' },
      };

      // Both concurrent calls find the draft initially in DRAFT state
      prismaMock.client.outreachDraft.findUnique.mockResolvedValue({
        id: 'draft-concurrent-1',
        leadId: 'lead-concurrent-race',
        status: OutreachDraftStatus.DRAFT,
        subject: 'Titan Partnership Pitch',
        bodyText: 'Hello David...',
        lead: mockLead,
      });

      prismaMock.client.outreachDraft.count.mockResolvedValue(0); // Under daily limit

      // Atomic claim simulation: 1st caller wins count = 1, subsequent concurrent callers get count = 0
      prismaMock.client.outreachDraft.updateMany
        .mockResolvedValueOnce({ count: 1 })
        .mockResolvedValueOnce({ count: 0 })
        .mockResolvedValueOnce({ count: 0 });

      gmailMock.sendEmail.mockResolvedValue({ messageId: 'gmail-race-winner-001', threadId: 'thread-001' });

      prismaMock.client.outreachDraft.update.mockResolvedValue({
        id: 'draft-concurrent-1',
        status: OutreachDraftStatus.SENT,
        gmailMessageId: 'gmail-race-winner-001',
      });

      // Fire 3 simultaneous concurrent requests via Promise.all
      const results = await Promise.allSettled([
        service.sendDraft('draft-concurrent-1'),
        service.sendDraft('draft-concurrent-1'),
        service.sendDraft('draft-concurrent-1'),
      ]);

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      // Exactly ONE request succeeds
      expect(fulfilled.length).toBe(1);
      // Exactly TWO requests are rejected with ConflictException (409)
      expect(rejected.length).toBe(2);
      rejected.forEach((r: any) => {
        expect(r.reason).toBeInstanceOf(ConflictException);
        expect(r.reason.message).toContain('Concurrent duplicate send prevented');
      });

      // Crucial invariant: Gmail sendEmail was executed EXACTLY ONCE
      expect(gmailMock.sendEmail).toHaveBeenCalledTimes(1);
    });

    it('Scenario 4: Sending is refused if Lead became RESTRICTED after draft creation', async () => {
      const mockLead = {
        id: 'lead-blocked-late',
        status: LeadLifecycleStatus.RESTRICTED, // Blocked after draft creation
        company: { name: 'Late Blocked Corp' },
        primaryContact: { email: 'late@blocked.com' },
      };

      prismaMock.client.outreachDraft.findUnique.mockResolvedValue({
        id: 'draft-late-blocked',
        leadId: 'lead-blocked-late',
        status: OutreachDraftStatus.DRAFT,
        subject: 'Inquiry',
        bodyText: 'Draft text',
        lead: mockLead,
      });

      await expect(service.sendDraft('draft-late-blocked')).rejects.toThrow(BadRequestException);
      expect(gmailMock.sendEmail).not.toHaveBeenCalled();
    });

    it('Scenario 5: Sending is refused once the daily limit is reached', async () => {
      const mockLead = {
        id: 'lead-limit',
        status: LeadLifecycleStatus.COLD_LEAD,
        company: { name: 'Limit Corp' },
        primaryContact: { email: 'limit@corp.com' },
      };

      prismaMock.client.outreachDraft.findUnique.mockResolvedValue({
        id: 'draft-limit',
        leadId: 'lead-limit',
        status: OutreachDraftStatus.DRAFT,
        lead: mockLead,
      });

      // Mock daily count exceeds limit (15)
      prismaMock.client.outreachDraft.count.mockResolvedValue(15);

      await expect(service.sendDraft('draft-limit')).rejects.toThrow(BadRequestException);
      expect(gmailMock.sendEmail).not.toHaveBeenCalled();
    });

    it('Scenario 6: OUTREACH_SAFE_TEST_MODE correctly redirects recipient and flags in result', async () => {
      const originalEnvMode = process.env.OUTREACH_SAFE_TEST_MODE;
      const originalEnvEmail = process.env.OUTREACH_TEST_RECIPIENT_EMAIL;

      process.env.OUTREACH_SAFE_TEST_MODE = 'true';
      process.env.OUTREACH_TEST_RECIPIENT_EMAIL = 'designated-safe-inbox@test.com';

      const mockLead = {
        id: 'lead-safe-test',
        status: LeadLifecycleStatus.COLD_LEAD,
        company: { name: 'Real Prospect LLC' },
        primaryContact: { email: 'real-prospect@client-company.com' },
      };

      prismaMock.client.outreachDraft.findUnique.mockResolvedValue({
        id: 'draft-safe-test',
        leadId: 'lead-safe-test',
        status: OutreachDraftStatus.DRAFT,
        subject: 'Real Prospect Pitch',
        bodyText: 'Hello prospect...',
        lead: mockLead,
      });

      prismaMock.client.outreachDraft.count.mockResolvedValue(0);
      gmailMock.sendEmail.mockResolvedValue({ messageId: 'safe-msg-id', threadId: 'safe-thread-id' });
      prismaMock.client.outreachDraft.update.mockResolvedValue({
        id: 'draft-safe-test',
        status: OutreachDraftStatus.SENT,
      });

      const sendResult = await service.sendDraft('draft-safe-test');

      expect(sendResult.safeTestModeActive).toBe(true);
      expect(sendResult.originalRecipient).toBe('real-prospect@client-company.com');
      expect(sendResult.actualRecipientUsed).toBe('designated-safe-inbox@test.com');
      expect(gmailMock.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'designated-safe-inbox@test.com',
        }),
      );

      process.env.OUTREACH_SAFE_TEST_MODE = originalEnvMode;
      process.env.OUTREACH_TEST_RECIPIENT_EMAIL = originalEnvEmail;
    });
  });
});
