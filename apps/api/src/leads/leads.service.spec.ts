import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { LeadsService } from './leads.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { OutreachService } from '../outreach/outreach.service';
import {
  LeadLifecycleStatus,
  AIControlState,
  OutreachDraftStatus,
} from '@ai-sales-agent/database';

describe('LeadsService', () => {
  let service: LeadsService;
  let prismaService: any;
  let auditServiceMock: any;
  let outreachServiceMock: any;

  const mockCompany = {
    id: 'comp-uuid-1',
    name: 'Apex Industrial Supply',
    domain: 'apexindustrial.com',
    industry: 'Industrial Equipment',
    size: '250',
    location: 'Chicago, IL',
  };

  const mockContact = {
    id: 'contact-uuid-1',
    companyId: 'comp-uuid-1',
    firstName: 'Sarah',
    lastName: 'Connor',
    email: 'sarah@apex.com',
    title: 'VP Operations',
  };

  const mockResearch = {
    id: 'research-uuid-1',
    leadId: 'lead-uuid-1',
    companySummary: 'Leading supplier of industrial components in the Midwest.',
    keyInsights: ['Expanding into automated warehouse distribution', 'Looking for reliable supply chain partners'],
    painPoints: ['Supply chain bottlenecks'],
    techStack: ['SAP', 'Salesforce'],
    newsAndEvents: ['Opened new distribution hub'],
    sources: ['https://apexindustrial.com'],
    createdAt: new Date(),
  };

  const mockLead = {
    id: 'lead-uuid-1',
    companyId: 'comp-uuid-1',
    primaryContactId: 'contact-uuid-1',
    campaignId: null,
    assignedUserId: null,
    status: LeadLifecycleStatus.COLD_LEAD,
    aiControlState: AIControlState.AI_ACTIVE,
    scoreTotal: 85,
    scoreServiceMatch: 35,
    scoreCompanyRelevance: 18,
    scoreContactQuality: 12,
    scoreProjectPotential: 12,
    scoreLocationMatch: 8,
    scoreBreakdownReason: { reason: 'High relevance' },
    metadata: {
      autonomousConversationMode: false,
    },
    company: mockCompany,
    primaryContact: mockContact,
    research: [mockResearch],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockDraft = {
    id: 'draft-uuid-1',
    leadId: 'lead-uuid-1',
    status: OutreachDraftStatus.DRAFT,
    subject: 'Optimizing supply chain distribution for Apex',
    bodyText: 'Hi Sarah, I noticed Apex is expanding automated warehouse distribution...',
    bodyHtml: '<p>Hi Sarah, I noticed Apex is expanding automated warehouse distribution...</p>',
    callToAction: 'Would you be open to a 10-minute discovery call next Tuesday?',
    rationale: 'Addresses specific warehouse expansion identified in company research.',
    personalizationPoints: ['Warehouse automation', 'Midwest regional hub'],
    aiUsageMetadata: {
      promptTokens: 450,
      completionTokens: 180,
      totalTokens: 630,
      estimatedCostUsd: 0.00063,
    },
    createdAt: new Date(),
  };

  beforeEach(async () => {
    prismaService = {
      client: {
        company: {
          findUnique: jest.fn(),
        },
        contact: {
          findUnique: jest.fn(),
        },
        campaign: {
          findUnique: jest.fn(),
        },
        user: {
          findUnique: jest.fn(),
        },
        lead: {
          create: jest.fn(),
          findUnique: jest.fn(),
          findMany: jest.fn(),
          count: jest.fn(),
          update: jest.fn(),
        },
        outreachDraft: {
          findUnique: jest.fn(),
        },
      },
    };

    auditServiceMock = {
      log: jest.fn().mockResolvedValue({ id: 'audit-event-1' }),
    };

    outreachServiceMock = {
      generateDraft: jest.fn().mockResolvedValue(mockDraft),
      sendDraft: jest.fn().mockResolvedValue({
        draftId: 'draft-uuid-1',
        leadId: 'lead-uuid-1',
        status: OutreachDraftStatus.SENT,
        gmailMessageId: 'gmail-msg-12345',
        gmailThreadId: 'gmail-th-12345',
        sentAt: new Date(),
        actualRecipientUsed: '70176613@student.uol.edu.pk',
        originalRecipient: 'sarah@apex.com',
        safeTestModeActive: true,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeadsService,
        { provide: PrismaService, useValue: prismaService },
        { provide: AuditService, useValue: auditServiceMock },
        { provide: OutreachService, useValue: outreachServiceMock },
      ],
    }).compile();

    service = module.get<LeadsService>(LeadsService);
  });

  describe('Lead Creation & Flag Protection', () => {
    it('successfully creates a Lead with autonomousConversationMode = false by default', async () => {
      prismaService.client.company.findUnique.mockResolvedValue(mockCompany);
      prismaService.client.contact.findUnique.mockResolvedValue(mockContact);
      prismaService.client.lead.create.mockResolvedValue(mockLead);

      const result = await service.createLead({
        companyId: 'comp-uuid-1',
        primaryContactId: 'contact-uuid-1',
        metadata: { autonomousConversationMode: true }, // Try to sneak true in metadata
      });

      expect(result.id).toBe('lead-uuid-1');
      // Must be forced to false
      expect(prismaService.client.lead.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            companyId: 'comp-uuid-1',
            status: LeadLifecycleStatus.COLD_LEAD,
            metadata: { autonomousConversationMode: false },
          }),
        }),
      );
    });

    it('updateLead strictly preserves existing autonomousConversationMode and prevents generic enabling', async () => {
      prismaService.client.lead.findUnique.mockResolvedValue({
        ...mockLead,
        metadata: { autonomousConversationMode: false },
      });
      prismaService.client.lead.update.mockResolvedValue({
        ...mockLead,
        metadata: { autonomousConversationMode: false, customNote: 'hello' },
      });

      await service.updateLead('lead-uuid-1', {
        metadata: { autonomousConversationMode: true, customNote: 'hello' },
      });

      expect(prismaService.client.lead.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'lead-uuid-1' },
          data: expect.objectContaining({
            metadata: { autonomousConversationMode: false, customNote: 'hello' },
          }),
        }),
      );
    });
  });

  describe('Autonomous Engagement Preview (Step 1)', () => {
    it('returns existing research, scoring summary, and freshly generated draft with real token cost', async () => {
      prismaService.client.lead.findUnique.mockResolvedValue(mockLead);

      const preview = await service.getAutonomousEngagementPreview('lead-uuid-1');

      expect(preview).toBeDefined();
      expect(preview.lead.id).toBe('lead-uuid-1');
      expect(preview.researchSummary?.companySummary).toBe(mockResearch.companySummary);
      expect(preview.scoringSummary.scoreTotal).toBe(85);
      expect(preview.proposedPitch.draftId).toBe('draft-uuid-1');
      expect((preview.proposedPitch.aiUsageMetadata as any)?.promptTokens).toBe(450);
      expect(preview.autonomousStatus.autonomousConversationMode).toBe(false);
      expect(preview.autonomousStatus.canApprove).toBe(true);

      // Verify zero side effects: no update to lead, no send called
      expect(prismaService.client.lead.update).not.toHaveBeenCalled();
      expect(outreachServiceMock.sendDraft).not.toHaveBeenCalled();
    });

    it('rejects preview if Lead is RESTRICTED', async () => {
      prismaService.client.lead.findUnique.mockResolvedValue({
        ...mockLead,
        status: LeadLifecycleStatus.RESTRICTED,
      });

      await expect(service.getAutonomousEngagementPreview('lead-uuid-1')).rejects.toThrow(
        BadRequestException,
      );
      expect(outreachServiceMock.generateDraft).not.toHaveBeenCalled();
    });

    it('rejects preview if primary contact email is missing', async () => {
      prismaService.client.lead.findUnique.mockResolvedValue({
        ...mockLead,
        primaryContact: null,
      });

      await expect(service.getAutonomousEngagementPreview('lead-uuid-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('Autonomous Engagement Approval (Step 2)', () => {
    it('atomically sets autonomousConversationMode = true AND dispatches the previewed draft', async () => {
      prismaService.client.lead.findUnique.mockResolvedValue(mockLead);
      prismaService.client.outreachDraft.findUnique.mockResolvedValue(mockDraft);
      prismaService.client.lead.update.mockResolvedValue({
        ...mockLead,
        metadata: { autonomousConversationMode: true },
      });

      const result = await service.approveAutonomousEngagement(
        'lead-uuid-1',
        { draftId: 'draft-uuid-1' },
        'admin-user-1',
      );

      expect(result.success).toBe(true);
      expect(result.autonomousConversationMode).toBe(true);
      expect(result.sendResult.actualRecipientUsed).toBe('70176613@student.uol.edu.pk');

      // Verify OutreachService.sendDraft was called with the specific draftId
      expect(outreachServiceMock.sendDraft).toHaveBeenCalledWith('draft-uuid-1');

      // Verify AuditEvent logged with actorType: USER
      expect(auditServiceMock.log).toHaveBeenCalledWith(
        expect.objectContaining({
          actorType: 'USER',
          action: 'AUTONOMOUS_ENGAGEMENT_APPROVED',
          entityType: 'LEAD',
          entityId: 'lead-uuid-1',
          userId: 'admin-user-1',
        }),
      );
    });

    it('rejects approval if referenced draft belongs to a different lead', async () => {
      prismaService.client.lead.findUnique.mockResolvedValue(mockLead);
      prismaService.client.outreachDraft.findUnique.mockResolvedValue({
        ...mockDraft,
        leadId: 'other-lead-uuid-999',
      });

      await expect(
        service.approveAutonomousEngagement(
          'lead-uuid-1',
          { draftId: 'draft-uuid-1' },
          'admin-user-1',
        ),
      ).rejects.toThrow(BadRequestException);

      expect(outreachServiceMock.sendDraft).not.toHaveBeenCalled();
    });

    it('rejects approval if referenced draft is not in DRAFT status', async () => {
      prismaService.client.lead.findUnique.mockResolvedValue(mockLead);
      prismaService.client.outreachDraft.findUnique.mockResolvedValue({
        ...mockDraft,
        status: OutreachDraftStatus.SENT,
      });

      await expect(
        service.approveAutonomousEngagement(
          'lead-uuid-1',
          { draftId: 'draft-uuid-1' },
          'admin-user-1',
        ),
      ).rejects.toThrow(ConflictException);

      expect(outreachServiceMock.sendDraft).not.toHaveBeenCalled();
    });

    it('rejects approval if lead is RESTRICTED', async () => {
      prismaService.client.lead.findUnique.mockResolvedValue({
        ...mockLead,
        status: LeadLifecycleStatus.RESTRICTED,
      });

      await expect(
        service.approveAutonomousEngagement(
          'lead-uuid-1',
          { draftId: 'draft-uuid-1' },
          'admin-user-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects approval if lead aiControlState is PAUSED', async () => {
      prismaService.client.lead.findUnique.mockResolvedValue({
        ...mockLead,
        aiControlState: AIControlState.PAUSED,
      });

      await expect(
        service.approveAutonomousEngagement(
          'lead-uuid-1',
          { draftId: 'draft-uuid-1' },
          'admin-user-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('explicitly rolls back autonomousConversationMode to false if sending fails', async () => {
      prismaService.client.lead.findUnique.mockResolvedValue(mockLead);
      prismaService.client.outreachDraft.findUnique.mockResolvedValue(mockDraft);
      prismaService.client.lead.update.mockResolvedValue(mockLead);

      outreachServiceMock.sendDraft.mockRejectedValueOnce(
        new InternalServerErrorException('Gmail API error: Daily quota exceeded'),
      );

      await expect(
        service.approveAutonomousEngagement(
          'lead-uuid-1',
          { draftId: 'draft-uuid-1' },
          'admin-user-1',
        ),
      ).rejects.toThrow(InternalServerErrorException);

      // Verify rollback update occurred setting autonomousConversationMode = false
      expect(prismaService.client.lead.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'lead-uuid-1' },
          data: expect.objectContaining({
            metadata: expect.objectContaining({
              autonomousConversationMode: false,
            }),
          }),
        }),
      );

      // Verify failure audit log
      expect(auditServiceMock.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'AUTONOMOUS_ENGAGEMENT_APPROVAL_FAILED',
        }),
      );
    });
  });

  describe('Autonomous Engagement Rejection (Step 3)', () => {
    it('leaves autonomousConversationMode = false and records rejection AuditEvent', async () => {
      prismaService.client.lead.findUnique.mockResolvedValue(mockLead);
      prismaService.client.lead.update.mockResolvedValue({
        ...mockLead,
        metadata: { autonomousConversationMode: false },
      });

      const result = await service.rejectAutonomousEngagement(
        'lead-uuid-1',
        { draftId: 'draft-uuid-1', reason: 'Prospect does not fit current Q3 profile' },
        'admin-user-1',
      );

      expect(result.success).toBe(true);
      expect(result.autonomousConversationMode).toBe(false);
      expect(result.status).toBe('REJECTED');

      expect(prismaService.client.lead.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'lead-uuid-1' },
          data: expect.objectContaining({
            metadata: expect.objectContaining({
              autonomousConversationMode: false,
              autonomousRejectionReason: 'Prospect does not fit current Q3 profile',
            }),
          }),
        }),
      );

      expect(auditServiceMock.log).toHaveBeenCalledWith(
        expect.objectContaining({
          actorType: 'USER',
          action: 'AUTONOMOUS_ENGAGEMENT_REJECTED',
          entityType: 'LEAD',
          entityId: 'lead-uuid-1',
        }),
      );
    });
  });

  describe('AI Control State Management', () => {
    it('sets Lead.aiControlState to PAUSED and records AuditEvent', async () => {
      prismaService.client.lead.findUnique.mockResolvedValue(mockLead);
      prismaService.client.lead.update.mockResolvedValue({
        ...mockLead,
        aiControlState: AIControlState.PAUSED,
      });

      const result = await service.pauseAI('lead-uuid-1', 'user-1');

      expect(result.aiControlState).toBe(AIControlState.PAUSED);
      expect(prismaService.client.lead.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'lead-uuid-1' },
          data: { aiControlState: AIControlState.PAUSED },
        }),
      );
      expect(auditServiceMock.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'LEAD_AI_PAUSED',
          entityType: 'LEAD',
          entityId: 'lead-uuid-1',
        }),
      );
    });

    it('sets Lead.aiControlState to TAKEN_OVER and records AuditEvent', async () => {
      prismaService.client.lead.findUnique.mockResolvedValue(mockLead);
      prismaService.client.lead.update.mockResolvedValue({
        ...mockLead,
        aiControlState: AIControlState.TAKEN_OVER,
      });

      const result = await service.takeOver('lead-uuid-1', 'user-1');

      expect(result.aiControlState).toBe(AIControlState.TAKEN_OVER);
      expect(auditServiceMock.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'LEAD_AI_TAKEN_OVER',
        }),
      );
    });

    it('sets Lead.aiControlState to AI_ACTIVE on resume and records AuditEvent', async () => {
      prismaService.client.lead.findUnique.mockResolvedValue({
        ...mockLead,
        aiControlState: AIControlState.PAUSED,
      });
      prismaService.client.lead.update.mockResolvedValue({
        ...mockLead,
        aiControlState: AIControlState.AI_ACTIVE,
      });

      const result = await service.resumeAI('lead-uuid-1', 'user-1');

      expect(result.aiControlState).toBe(AIControlState.AI_ACTIVE);
      expect(auditServiceMock.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'LEAD_AI_RESUMED',
        }),
      );
    });
  });
});

