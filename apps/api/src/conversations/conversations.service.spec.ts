import { Test, TestingModule } from '@nestjs/testing';
import { ConversationsService, OPEN_LEAD_STATUSES } from './conversations.service';
import { PrismaService } from '../prisma/prisma.service';
import { GmailService } from '../gmail/gmail.service';
import { AIOrchestratorService } from '../ai/services/ai-orchestrator.service';
import { RestrictionEngineService } from '../restrictions/restriction-engine.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  LeadLifecycleStatus,
  MessageDirection,
  RestrictionCheckResult,
  RestrictionEntityType,
  AIControlState,
  HumanReviewStatus,
  HumanReviewTriggerSource,
} from '@ai-sales-agent/database';

describe('ConversationsService', () => {
  let service: ConversationsService;
  let prismaMock: any;
  let gmailMock: any;
  let aiOrchestratorMock: any;
  let restrictionEngineMock: any;
  let auditServiceMock: any;

  beforeEach(async () => {
    prismaMock = {
      client: {
        contact: {
          findUnique: jest.fn(),
        },
        lead: {
          findUnique: jest.fn(),
          update: jest.fn(),
        },
        conversation: {
          findUnique: jest.fn(),
          upsert: jest.fn(),
          findMany: jest.fn(),
          count: jest.fn(),
        },
        message: {
          findUnique: jest.fn(),
          create: jest.fn(),
          update: jest.fn(),
        },
        humanReview: {
          findFirst: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockImplementation((args) => ({
            id: 'hr-conv-1',
            ...args.data,
            createdAt: new Date(),
          })),
        },
      },
    };

    gmailMock = {
      listMessages: jest.fn(),
      getMessage: jest.fn(),
    };

    aiOrchestratorMock = {
      analyzeReply: jest.fn(),
    };

    restrictionEngineMock = {
      evaluate: jest.fn(),
    };

    auditServiceMock = {
      log: jest.fn().mockResolvedValue({ id: 'audit-event-1' }),
    };

    const notificationsServiceMock = {
      create: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConversationsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: GmailService, useValue: gmailMock },
        { provide: AIOrchestratorService, useValue: aiOrchestratorMock },
        { provide: RestrictionEngineService, useValue: restrictionEngineMock },
        { provide: AuditService, useValue: auditServiceMock },
        { provide: NotificationsService, useValue: notificationsServiceMock },
      ],
    }).compile();

    service = module.get<ConversationsService>(ConversationsService);
  });

  describe('extractEmailAddress', () => {
    it('should extract email from standard RFC 5322 header', () => {
      expect(service.extractEmailAddress('Marcus Vance <marcus.vance@apexforge.com>')).toBe('marcus.vance@apexforge.com');
      expect(service.extractEmailAddress('marcus.vance@apexforge.com')).toBe('marcus.vance@apexforge.com');
      expect(service.extractEmailAddress('  "Vance, Marcus" <MARCUS@APEXFORGE.COM> ')).toBe('marcus@apexforge.com');
      expect(service.extractEmailAddress(undefined)).toBeNull();
    });
  });

  describe('Lead Matching & Ingestion', () => {
    it('Scenario 1: Contact with EXACTLY ONE open Lead -> correctly auto-attached', async () => {
      const mockLead = {
        id: 'lead-open-1',
        companyId: 'comp-1',
        primaryContactId: 'contact-1',
        status: LeadLifecycleStatus.CONTACTED,
        company: { id: 'comp-1', name: 'Apex Forge', industry: 'Fabrication' },
        research: [{ companySummary: 'Leading fabrication provider.' }],
      };

      prismaMock.client.conversation.findUnique.mockResolvedValue(null);
      prismaMock.client.contact.findUnique.mockResolvedValue({
        id: 'contact-1',
        email: 'marcus@apexforge.com',
        leads: [mockLead],
      });

      prismaMock.client.conversation.upsert.mockResolvedValue({
        id: 'conv-1',
        leadId: 'lead-open-1',
        gmailThreadId: 'thread-123',
      });

      prismaMock.client.message.create.mockResolvedValue({
        id: 'msg-1',
        conversationId: 'conv-1',
        gmailMessageId: 'gmail-msg-1',
        bodyText: 'We are interested in discussing the proposal next Tuesday.',
      });

      aiOrchestratorMock.analyzeReply.mockResolvedValue({
        data: {
          intent: 'INTERESTED',
          sentiment: 'POSITIVE',
          suggestedLeadStage: LeadLifecycleStatus.INTERESTED,
          objectionsIdentified: [],
          questionsAsked: [],
          requiresHumanIntervention: false,
          recommendedNextAction: 'Schedule meeting',
        },
        metadata: {
          actionId: 'action-reply-1',
          modelUsed: 'gpt-4o-mini',
          usage: { totalTokens: 150 },
          latencyMs: 1200,
        },
      });

      restrictionEngineMock.evaluate.mockResolvedValue({
        id: 'rest-1',
        result: RestrictionCheckResult.CLEAR,
        reason: 'No restricted scope.',
      });

      prismaMock.client.lead.findUnique.mockResolvedValue({
        id: 'lead-open-1',
        status: LeadLifecycleStatus.CONTACTED,
      });

      const result = await service.ingestSingleInboundMessage({
        id: 'gmail-msg-1',
        threadId: 'thread-123',
        from: 'Marcus Vance <marcus@apexforge.com>',
        to: 'sales@enterprise.com',
        subject: 'Re: Partnership Proposal',
        bodyText: 'We are interested in discussing the proposal next Tuesday.',
        date: new Date().toISOString(),
      });

      expect(result.assignmentStatus).toBe('ASSIGNED');
      expect(result.leadId).toBe('lead-open-1');
      expect(result.aiAnalysisPerformed).toBe(true);
      expect(result.restrictionResult).toBe(RestrictionCheckResult.CLEAR);
      expect(result.leadStatusUpdated).toBe(LeadLifecycleStatus.INTERESTED);

      expect(prismaMock.client.conversation.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            leadId: 'lead-open-1',
          }),
        }),
      );

      expect(prismaMock.client.lead.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'lead-open-1' },
          data: expect.objectContaining({
            status: LeadLifecycleStatus.INTERESTED,
          }),
        }),
      );
    });

    it('Scenario 2: Contact with ZERO open Leads -> correctly creates unassigned conversation, not a guess', async () => {
      prismaMock.client.conversation.findUnique.mockResolvedValue(null);
      prismaMock.client.contact.findUnique.mockResolvedValue({
        id: 'contact-2',
        email: 'stranger@unknown.com',
        leads: [], // 0 open leads
      });

      prismaMock.client.conversation.upsert.mockResolvedValue({
        id: 'conv-unassigned-1',
        leadId: null,
        gmailThreadId: 'thread-456',
      });

      prismaMock.client.message.create.mockResolvedValue({
        id: 'msg-unassigned-1',
        conversationId: 'conv-unassigned-1',
        gmailMessageId: 'gmail-msg-2',
        bodyText: 'Hello, inquiring about your software catalog.',
      });

      const result = await service.ingestSingleInboundMessage({
        id: 'gmail-msg-2',
        threadId: 'thread-456',
        from: 'stranger@unknown.com',
        to: 'sales@enterprise.com',
        subject: 'Inquiry',
        bodyText: 'Hello, inquiring about your software catalog.',
      });

      expect(result.assignmentStatus).toBe('NEEDS_HUMAN_ASSIGNMENT');
      expect(result.leadId).toBeNull();
      expect(result.aiAnalysisPerformed).toBe(false); // Deferred until assignment
      expect(prismaMock.client.conversation.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            leadId: null,
          }),
        }),
      );
    });

    it('Scenario 3: Contact with MULTIPLE open Leads -> creates unassigned conversation requiring human assignment', async () => {
      const openLeadA = { id: 'lead-a', companyId: 'comp-a', status: LeadLifecycleStatus.CONTACTED };
      const openLeadB = { id: 'lead-b', companyId: 'comp-b', status: LeadLifecycleStatus.QUALIFIED };

      prismaMock.client.conversation.findUnique.mockResolvedValue(null);
      prismaMock.client.contact.findUnique.mockResolvedValue({
        id: 'contact-3',
        email: 'consultant@multi-org.com',
        leads: [openLeadA, openLeadB], // 2 open leads
      });

      prismaMock.client.conversation.upsert.mockResolvedValue({
        id: 'conv-unassigned-2',
        leadId: null,
        gmailThreadId: 'thread-789',
      });

      prismaMock.client.message.create.mockResolvedValue({
        id: 'msg-unassigned-2',
        conversationId: 'conv-unassigned-2',
        gmailMessageId: 'gmail-msg-3',
        bodyText: 'Following up on our active projects.',
      });

      const result = await service.ingestSingleInboundMessage({
        id: 'gmail-msg-3',
        threadId: 'thread-789',
        from: 'consultant@multi-org.com',
        to: 'sales@enterprise.com',
        subject: 'Project update',
        bodyText: 'Following up on our active projects.',
      });

      expect(result.assignmentStatus).toBe('NEEDS_HUMAN_ASSIGNMENT');
      expect(result.leadId).toBeNull();
      expect(result.aiAnalysisPerformed).toBe(false);
      expect(aiOrchestratorMock.analyzeReply).not.toHaveBeenCalled();
    });
  });

  describe('Idempotency & Duplicate Protection', () => {
    it('Scenario 4: Running sync twice on the same Gmail data does not reprocess existing Message records', async () => {
      gmailMock.listMessages.mockResolvedValue([
        { id: 'msg-id-101', threadId: 'thread-101' },
        { id: 'msg-id-102', threadId: 'thread-102' },
      ]);

      // Message 101 already exists in DB; Message 102 is new
      prismaMock.client.message.findUnique
        .mockResolvedValueOnce({ id: 'existing-db-id', gmailMessageId: 'msg-id-101' })
        .mockResolvedValueOnce(null);

      gmailMock.getMessage.mockResolvedValue({
        id: 'msg-id-102',
        threadId: 'thread-102',
        from: 'test@example.com',
        bodyText: 'Fresh message',
      });

      prismaMock.client.conversation.findUnique.mockResolvedValue(null);
      prismaMock.client.contact.findUnique.mockResolvedValue(null);
      prismaMock.client.conversation.upsert.mockResolvedValue({ id: 'conv-102', leadId: null });
      prismaMock.client.message.create.mockResolvedValue({ id: 'msg-102', conversationId: 'conv-102' });

      const syncResult = await service.syncGmailInbox({});

      expect(syncResult.messagesFound).toBe(2);
      expect(syncResult.skippedDuplicates).toBe(1);
      expect(syncResult.newMessagesIngested).toBe(1);
      expect(gmailMock.getMessage).toHaveBeenCalledTimes(1);
      expect(gmailMock.getMessage).toHaveBeenCalledWith('msg-id-102');
    });
  });

  describe('Restriction Engine Re-Checking & Lead Blocking', () => {
    it('Scenario 5: Inbound reply containing restricted scope triggers RestrictionEngine and blocks Lead', async () => {
      const mockLead = {
        id: 'lead-vulcan',
        companyId: 'comp-vulcan',
        status: LeadLifecycleStatus.CONTACTED,
        company: { id: 'comp-vulcan', name: 'Vulcan Framing' },
        research: [],
      };

      prismaMock.client.conversation.findUnique.mockResolvedValue(null);
      prismaMock.client.contact.findUnique.mockResolvedValue({
        id: 'contact-vulcan',
        email: 'owner@vulcan.com',
        leads: [mockLead],
      });

      prismaMock.client.conversation.upsert.mockResolvedValue({ id: 'conv-v', leadId: 'lead-vulcan' });
      prismaMock.client.message.create.mockResolvedValue({ id: 'msg-v', conversationId: 'conv-v' });

      aiOrchestratorMock.analyzeReply.mockResolvedValue({
        data: {
          intent: 'INTERESTED',
          sentiment: 'POSITIVE',
          suggestedLeadStage: LeadLifecycleStatus.INTERESTED,
        },
        metadata: { actionId: 'action-v' },
      });

      // Restriction engine flags RESTRICTED and updates Lead in DB to RESTRICTED
      restrictionEngineMock.evaluate.mockImplementation(async () => {
        return {
          id: 'rest-vulcan-1',
          result: RestrictionCheckResult.RESTRICTED,
          reason: 'Prohibited structural steel scope (OWSJ joists) detected in inbound reply.',
        };
      });

      // When lead is re-checked, it reflects RESTRICTED status
      prismaMock.client.lead.findUnique.mockResolvedValue({
        id: 'lead-vulcan',
        status: LeadLifecycleStatus.RESTRICTED,
      });

      const result = await service.ingestSingleInboundMessage({
        id: 'msg-restricted-reply',
        threadId: 'thread-v',
        from: 'owner@vulcan.com',
        bodyText: 'We specialize in longspan OWSJ joists and heavy steel decking for warehouses.',
      });

      expect(result.restrictionResult).toBe(RestrictionCheckResult.RESTRICTED);
      expect(restrictionEngineMock.evaluate).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: RestrictionEntityType.LEAD,
          leadId: 'lead-vulcan',
          sourceTrigger: 'conversation',
        }),
      );

      // Verify that lead status update to INTERESTED was NOT performed because Lead is RESTRICTED
      expect(result.leadStatusUpdated).toBeUndefined();
    });

    it('Scenario 6: Lead already at RESTRICTED status is NEVER moved out by reply-driven progression', async () => {
      const mockLead = {
        id: 'lead-already-blocked',
        companyId: 'comp-blocked',
        status: LeadLifecycleStatus.RESTRICTED,
        company: { id: 'comp-blocked', name: 'Blocked Corp' },
        research: [],
      };

      prismaMock.client.conversation.findUnique.mockResolvedValue(null);
      prismaMock.client.contact.findUnique.mockResolvedValue({
        id: 'contact-b',
        email: 'blocked@domain.com',
        // Even if querying open leads returns empty because it is RESTRICTED:
        leads: [],
      });

      // But conversation thread was already tied to this Lead previously:
      prismaMock.client.conversation.findUnique.mockResolvedValue({
        id: 'conv-b',
        leadId: 'lead-already-blocked',
        lead: mockLead,
      });

      prismaMock.client.conversation.upsert.mockResolvedValue({ id: 'conv-b', leadId: 'lead-already-blocked' });
      prismaMock.client.message.create.mockResolvedValue({ id: 'msg-b', conversationId: 'conv-b' });

      aiOrchestratorMock.analyzeReply.mockResolvedValue({
        data: {
          intent: 'INTERESTED',
          sentiment: 'POSITIVE',
          suggestedLeadStage: LeadLifecycleStatus.INTERESTED,
        },
        metadata: { actionId: 'action-b' },
      });

      restrictionEngineMock.evaluate.mockResolvedValue({
        id: 'rest-b',
        result: RestrictionCheckResult.RESTRICTED,
        reason: 'Still restricted',
      });

      prismaMock.client.lead.findUnique.mockResolvedValue({
        id: 'lead-already-blocked',
        status: LeadLifecycleStatus.RESTRICTED,
      });

      const result = await service.ingestSingleInboundMessage({
        id: 'msg-b-new',
        threadId: 'thread-b',
        from: 'blocked@domain.com',
        bodyText: 'We love your offer and want to buy immediately!',
      });

      // Must remain strictly blocked
      expect(result.leadStatusUpdated).toBeUndefined();
      expect(prismaMock.client.lead.update).not.toHaveBeenCalled();
    });
  });

  describe('AI Control State Management & Human Review Triggers', () => {
    it('Scenario 7: Inbound reply with requires_human: true creates a HumanReview record and records AuditEvent', async () => {
      const mockLead = {
        id: 'lead-human-flag-1',
        companyId: 'comp-1',
        primaryContactId: 'contact-1',
        status: LeadLifecycleStatus.CONTACTED,
        aiControlState: AIControlState.AI_ACTIVE,
        company: { id: 'comp-1', name: 'Apex Forge', industry: 'Fabrication' },
        research: [],
      };

      prismaMock.client.conversation.findUnique.mockResolvedValue({
        id: 'conv-hf-1',
        leadId: 'lead-human-flag-1',
        lead: mockLead,
      });

      prismaMock.client.conversation.upsert.mockResolvedValue({
        id: 'conv-hf-1',
        leadId: 'lead-human-flag-1',
      });

      prismaMock.client.message.create.mockResolvedValue({
        id: 'msg-hf-1',
        conversationId: 'conv-hf-1',
        gmailMessageId: 'gmail-msg-hf',
        bodyText: 'We need custom pricing and want to negotiate contract terms.',
      });

      aiOrchestratorMock.analyzeReply.mockResolvedValue({
        data: {
          intent: 'PRICING_NEGOTIATION',
          sentiment: 'NEUTRAL',
          requires_human: true,
          summary: 'Prospect requesting bespoke enterprise pricing and legal redlines.',
        },
        metadata: { actionId: 'action-hf-1' },
      });

      restrictionEngineMock.evaluate.mockResolvedValue({
        id: 'rest-hf-1',
        result: RestrictionCheckResult.CLEAR,
        reason: 'Clean',
      });

      prismaMock.client.lead.findUnique.mockResolvedValue({
        id: 'lead-human-flag-1',
        status: LeadLifecycleStatus.CONTACTED,
      });

      const result = await service.ingestSingleInboundMessage({
        id: 'gmail-msg-hf',
        threadId: 'thread-hf-1',
        from: 'Marcus Vance <marcus@apexforge.com>',
        subject: 'Contract negotiation',
        bodyText: 'We need custom pricing and want to negotiate contract terms.',
      });

      expect(result.aiAnalysisPerformed).toBe(true);
      expect(prismaMock.client.humanReview.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            leadId: 'lead-human-flag-1',
            triggerSource: HumanReviewTriggerSource.AI_REPLY_FLAG,
            status: HumanReviewStatus.PENDING,
          }),
        }),
      );
      expect(auditServiceMock.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'HUMAN_REVIEW_CREATED',
          entityType: 'HUMAN_REVIEW',
        }),
      );
    });

    it('Scenario 8: Lead in PAUSED or TAKEN_OVER state stores message but skips AI analysis and restriction checks', async () => {
      const mockLead = {
        id: 'lead-paused-1',
        companyId: 'comp-1',
        primaryContactId: 'contact-1',
        status: LeadLifecycleStatus.CONTACTED,
        aiControlState: AIControlState.PAUSED, // Paused by operator
        company: { id: 'comp-1', name: 'Apex Forge', industry: 'Fabrication' },
        research: [],
      };

      prismaMock.client.conversation.findUnique.mockResolvedValue({
        id: 'conv-paused-1',
        leadId: 'lead-paused-1',
        lead: mockLead,
      });

      prismaMock.client.conversation.upsert.mockResolvedValue({
        id: 'conv-paused-1',
        leadId: 'lead-paused-1',
      });

      prismaMock.client.message.create.mockResolvedValue({
        id: 'msg-paused-1',
        conversationId: 'conv-paused-1',
        gmailMessageId: 'gmail-msg-paused',
        bodyText: 'Hello from client while lead is paused.',
      });

      const result = await service.ingestSingleInboundMessage({
        id: 'gmail-msg-paused',
        threadId: 'thread-paused-1',
        from: 'Marcus Vance <marcus@apexforge.com>',
        subject: 'Paused thread message',
        bodyText: 'Hello from client while lead is paused.',
      });

      // Message stored in DB
      expect(result.messageId).toBe('msg-paused-1');
      // AI analysis and restriction checks strictly suppressed
      expect(result.aiAnalysisPerformed).toBe(false);
      expect(aiOrchestratorMock.analyzeReply).not.toHaveBeenCalled();
      expect(restrictionEngineMock.evaluate).not.toHaveBeenCalled();
      expect(prismaMock.client.lead.update).not.toHaveBeenCalled();
    });

    it('Scenario 9: Concurrent message ingestion race condition (Promise.all) - duplicate ingestion handles P2002 gracefully and prevents double AI processing', async () => {
      const mockLead = {
        id: 'lead-concurrent-sync',
        companyId: 'comp-1',
        status: LeadLifecycleStatus.CONTACTED,
        aiControlState: AIControlState.AI_ACTIVE,
        company: { id: 'comp-1', name: 'Apex Forge', industry: 'Fabrication' },
        research: [],
      };

      prismaMock.client.conversation.findUnique.mockResolvedValue({
        id: 'conv-concurrent-1',
        leadId: 'lead-concurrent-sync',
        lead: mockLead,
      });

      prismaMock.client.conversation.upsert.mockResolvedValue({
        id: 'conv-concurrent-1',
        leadId: 'lead-concurrent-sync',
      });

      // 1st caller creates message successfully; 2nd caller hits P2002 unique constraint error
      const p2002Error: any = new Error('Unique constraint failed on the fields: (`gmailMessageId`)');
      p2002Error.code = 'P2002';

      prismaMock.client.message.create
        .mockResolvedValueOnce({
          id: 'msg-winner-1',
          conversationId: 'conv-concurrent-1',
          gmailMessageId: 'gmail-msg-race-1',
          bodyText: 'We are interested in discussing specs.',
        })
        .mockRejectedValueOnce(p2002Error);

      prismaMock.client.message.findUnique.mockResolvedValue({
        id: 'msg-winner-1',
        gmailMessageId: 'gmail-msg-race-1',
      });

      aiOrchestratorMock.analyzeReply.mockResolvedValue({
        data: {
          intent: 'INTERESTED',
          sentiment: 'POSITIVE',
          suggestedLeadStage: LeadLifecycleStatus.INTERESTED,
          objectionsIdentified: [],
          questionsAsked: [],
          requiresHumanIntervention: false,
          recommendedNextAction: 'Schedule technical call.',
        },
        metadata: { modelUsed: 'gpt-4o-mini', usage: { totalTokens: 150 } },
      });

      restrictionEngineMock.evaluate.mockResolvedValue({
        result: RestrictionCheckResult.CLEAR,
      });

      // Fire 2 simultaneous concurrent message ingestion calls
      const [res1, res2] = await Promise.all([
        service.ingestSingleInboundMessage({
          id: 'gmail-msg-race-1',
          threadId: 'thread-race-1',
          from: 'Marcus Vance <marcus@apexforge.com>',
          subject: 'Specifications inquiry',
          bodyText: 'We are interested in discussing specs.',
        }),
        service.ingestSingleInboundMessage({
          id: 'gmail-msg-race-1',
          threadId: 'thread-race-1',
          from: 'Marcus Vance <marcus@apexforge.com>',
          subject: 'Specifications inquiry',
          bodyText: 'We are interested in discussing specs.',
        }),
      ]);

      // 1st caller performed full analysis
      expect(res1.messageId).toBe('msg-winner-1');
      expect(res1.aiAnalysisPerformed).toBe(true);

      // 2nd caller caught P2002, recovered gracefully, and skipped duplicate AI analysis
      expect(res2.messageId).toBe('msg-winner-1');
      expect(res2.aiAnalysisPerformed).toBe(false);

      // Invariant: AI analyzeReply was called EXACTLY ONCE
      expect(aiOrchestratorMock.analyzeReply).toHaveBeenCalledTimes(1);
    });
  });
});
