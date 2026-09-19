import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { OutreachService } from '../outreach/outreach.service';
import { CreateLeadDto, UpdateLeadDto, ListLeadsQueryDto } from './dto/lead.dto';
import {
  ApproveAutonomousEngagementDto,
  RejectAutonomousEngagementDto,
} from './dto/autonomous-engagement.dto';
import {
  Lead,
  LeadLifecycleStatus,
  AIControlState,
  OutreachDraftStatus,
} from '@ai-sales-agent/database';

@Injectable()
export class LeadsService {
  private readonly logger = new Logger(LeadsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly outreachService: OutreachService,
  ) {}

  /**
   * Creates a Lead record.
   * REQUIRES an existing companyId.
   * Defaults status to COLD_LEAD. Scoring columns remain at 0 defaults (Prompt 09 computes them).
   * HARD SAFETY RULE: autonomousConversationMode is strictly initialized to false.
   */
  async createLead(dto: CreateLeadDto): Promise<Lead> {
    // 1. Verify Company exists
    const company = await this.prisma.client.company.findUnique({
      where: { id: dto.companyId },
    });

    if (!company) {
      throw new NotFoundException(`Company with ID '${dto.companyId}' not found. A Lead requires an existing company.`);
    }

    // 2. If primaryContactId is provided, verify Contact belongs to this Company
    if (dto.primaryContactId) {
      const contact = await this.prisma.client.contact.findUnique({
        where: { id: dto.primaryContactId },
      });
      if (!contact) {
        throw new NotFoundException(`Contact with ID '${dto.primaryContactId}' not found.`);
      }
      if (contact.companyId !== dto.companyId) {
        throw new BadRequestException(
          `Contact with ID '${dto.primaryContactId}' belongs to Company '${contact.companyId}', not '${dto.companyId}'.`,
        );
      }
    }

    // 3. If campaignId provided, verify Campaign exists
    if (dto.campaignId) {
      const campaign = await this.prisma.client.campaign.findUnique({
        where: { id: dto.campaignId },
      });
      if (!campaign) {
        throw new NotFoundException(`Campaign with ID '${dto.campaignId}' not found.`);
      }
    }

    // 4. If assignedUserId provided, verify User exists
    if (dto.assignedUserId) {
      const user = await this.prisma.client.user.findUnique({
        where: { id: dto.assignedUserId },
      });
      if (!user) {
        throw new NotFoundException(`User with ID '${dto.assignedUserId}' not found.`);
      }
    }

    // Explicitly ensure autonomousConversationMode cannot be initialized to true via createLead
    const sanitizedMetadata = {
      ...(dto.metadata || {}),
      autonomousConversationMode: false,
    };

    return this.prisma.client.lead.create({
      data: {
        companyId: dto.companyId,
        primaryContactId: dto.primaryContactId || null,
        campaignId: dto.campaignId || null,
        assignedUserId: dto.assignedUserId || null,
        status: LeadLifecycleStatus.COLD_LEAD,
        metadata: sanitizedMetadata,
      },
      include: {
        company: true,
        primaryContact: true,
        assignedUser: {
          select: { id: true, email: true, name: true, role: true },
        },
      },
    });
  }

  /**
   * Retrieves a single Lead with associated Company, Contact, and User.
   */
  async getLeadById(id: string): Promise<Lead> {
    const lead = await this.prisma.client.lead.findUnique({
      where: { id },
      include: {
        company: true,
        primaryContact: true,
        campaign: true,
        assignedUser: {
          select: { id: true, email: true, name: true, role: true },
        },
        research: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!lead) {
      throw new NotFoundException(`Lead with ID '${id}' not found.`);
    }

    return lead;
  }

  /**
   * Lists Leads with pagination and filtering.
   */
  async listLeads(query: ListLeadsQueryDto): Promise<{
    items: Lead[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.companyId) where.companyId = query.companyId;
    if (query.assignedUserId) where.assignedUserId = query.assignedUserId;
    if (query.status) where.status = query.status;

    const [items, total] = await Promise.all([
      this.prisma.client.lead.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          company: { select: { id: true, name: true, domain: true, industry: true } },
          primaryContact: { select: { id: true, email: true, firstName: true, lastName: true } },
          assignedUser: { select: { id: true, name: true, email: true } },
        },
      }),
      this.prisma.client.lead.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Updates an existing Lead.
   * HARD SAFETY RULE: Generic PATCH cannot enable autonomousConversationMode.
   */
  async updateLead(id: string, dto: UpdateLeadDto): Promise<Lead> {
    const existing = await this.getLeadById(id);

    if (dto.primaryContactId) {
      const contact = await this.prisma.client.contact.findUnique({
        where: { id: dto.primaryContactId },
      });
      if (!contact) {
        throw new NotFoundException(`Contact with ID '${dto.primaryContactId}' not found.`);
      }
      if (contact.companyId !== existing.companyId) {
        throw new BadRequestException(
          `Contact with ID '${dto.primaryContactId}' belongs to Company '${contact.companyId}', not '${existing.companyId}'.`,
        );
      }
    }

    if (dto.assignedUserId) {
      const user = await this.prisma.client.user.findUnique({
        where: { id: dto.assignedUserId },
      });
      if (!user) {
        throw new NotFoundException(`User with ID '${dto.assignedUserId}' not found.`);
      }
    }

    let mergedMetadata = undefined;
    if (dto.metadata !== undefined) {
      const existingAutonomousMode =
        (existing.metadata as Record<string, any>)?.autonomousConversationMode ?? false;
      mergedMetadata = {
        ...((existing.metadata as Record<string, any>) || {}),
        ...dto.metadata,
        autonomousConversationMode: existingAutonomousMode, // strictly preserve existing state; can ONLY be enabled via approveAutonomousEngagement
      };
    }

    return this.prisma.client.lead.update({
      where: { id },
      data: {
        ...(dto.primaryContactId !== undefined ? { primaryContactId: dto.primaryContactId } : {}),
        ...(dto.campaignId !== undefined ? { campaignId: dto.campaignId } : {}),
        ...(dto.assignedUserId !== undefined ? { assignedUserId: dto.assignedUserId } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(mergedMetadata !== undefined ? { metadata: mergedMetadata } : {}),
      },
      include: {
        company: true,
        primaryContact: true,
        assignedUser: {
          select: { id: true, email: true, name: true, role: true },
        },
      },
    });
  }

  /**
   * Step 1: Pre-Approval Preview Generation (GET /leads/:id/autonomous-engagement-preview).
   * ADMIN-only endpoint.
   * Returns:
   * - Existing research and lead scoring summary (reused, zero re-computation).
   * - A freshly generated proposed opening pitch draft via OutreachService.generateDraft() with real token cost.
   * ZERO side effects: Viewing this preview does not enable autonomous mode and does not send any email.
   */
  async getAutonomousEngagementPreview(leadId: string) {
    const lead = await this.prisma.client.lead.findUnique({
      where: { id: leadId },
      include: {
        company: true,
        primaryContact: true,
        assignedUser: {
          select: { id: true, email: true, name: true, role: true },
        },
        research: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!lead) {
      throw new NotFoundException(`Lead with ID '${leadId}' not found.`);
    }

    if (lead.status === LeadLifecycleStatus.RESTRICTED) {
      throw new BadRequestException(
        `Cannot preview autonomous engagement: Lead '${leadId}' is RESTRICTED by compliance policy.`,
      );
    }

    if (!lead.primaryContact?.email) {
      throw new BadRequestException(
        `Cannot preview autonomous engagement: Lead '${leadId}' has no primary contact with a valid email address.`,
      );
    }

    this.logger.log(`Generating proposed opening pitch draft for autonomous engagement preview on Lead '${leadId}'...`);
    const draft = await this.outreachService.generateDraft(leadId, {
      tone: 'professional and consultative',
      additionalContext: 'Proposed opening pitch for autonomous engagement activation.',
    });

    const research = lead.research?.[0];
    const currentMetadata = (lead.metadata as Record<string, any>) || {};

    return {
      lead: {
        id: lead.id,
        status: lead.status,
        aiControlState: lead.aiControlState,
        company: {
          id: lead.company.id,
          name: lead.company.name,
          domain: lead.company.domain,
          industry: lead.company.industry,
          size: lead.company.size,
          location: lead.company.location,
        },
        primaryContact: {
          id: lead.primaryContact.id,
          firstName: lead.primaryContact.firstName,
          lastName: lead.primaryContact.lastName,
          email: lead.primaryContact.email,
          title: lead.primaryContact.title,
        },
      },
      researchSummary: research
        ? {
            id: research.id,
            companySummary: research.companySummary,
            keyInsights: research.keyInsights,
            painPoints: research.painPoints,
            techStack: research.techStack,
            newsAndEvents: research.newsAndEvents,
            sources: research.sources,
            createdAt: research.createdAt,
          }
        : null,
      scoringSummary: {
        scoreTotal: lead.scoreTotal,
        scoreServiceMatch: lead.scoreServiceMatch,
        scoreCompanyRelevance: lead.scoreCompanyRelevance,
        scoreContactQuality: lead.scoreContactQuality,
        scoreProjectPotential: lead.scoreProjectPotential,
        scoreLocationMatch: lead.scoreLocationMatch,
        scoreBreakdownReason: lead.scoreBreakdownReason,
      },
      proposedPitch: {
        draftId: draft.id,
        subject: draft.subject,
        bodyText: draft.bodyText,
        bodyHtml: draft.bodyHtml,
        callToAction: draft.callToAction,
        rationale: draft.rationale,
        personalizationPoints: draft.personalizationPoints,
        aiUsageMetadata: draft.aiUsageMetadata,
        status: draft.status,
        createdAt: draft.createdAt,
      },
      autonomousStatus: {
        autonomousConversationMode: currentMetadata.autonomousConversationMode ?? false,
        canApprove:
          (lead.status as any) !== LeadLifecycleStatus.RESTRICTED &&
          lead.aiControlState === AIControlState.AI_ACTIVE &&
          Boolean(lead.primaryContact?.email),
      },
    };
  }

  /**
   * Step 2: Approval Endpoint (POST /leads/:id/approve-autonomous-engagement).
   * ADMIN-only endpoint.
   * Atomically:
   * 1. Enables autonomousConversationMode = true for this Lead.
   * 2. Immediately dispatches the specific previewed draft via OutreachService.sendDraft().
   * If send fails, explicitly rolls back autonomousConversationMode to avoid inconsistent state.
   * Logs AuditEvent with actorType: 'USER'.
   */
  async approveAutonomousEngagement(
    leadId: string,
    dto: ApproveAutonomousEngagementDto,
    userId: string,
  ) {
    const lead = await this.prisma.client.lead.findUnique({
      where: { id: leadId },
      include: {
        company: true,
        primaryContact: true,
      },
    });

    if (!lead) {
      throw new NotFoundException(`Lead with ID '${leadId}' not found.`);
    }

    if (lead.status === LeadLifecycleStatus.RESTRICTED) {
      throw new BadRequestException(
        `Cannot approve autonomous engagement: Lead '${leadId}' is currently RESTRICTED by compliance policy.`,
      );
    }

    if (lead.aiControlState !== AIControlState.AI_ACTIVE) {
      throw new BadRequestException(
        `Cannot approve autonomous engagement: Lead AI control state is '${lead.aiControlState}'. AI must be AI_ACTIVE.`,
      );
    }

    // Verify draft existence and ownership
    const draft = await this.prisma.client.outreachDraft.findUnique({
      where: { id: dto.draftId },
    });

    if (!draft) {
      throw new NotFoundException(`Outreach draft with ID '${dto.draftId}' not found.`);
    }

    if (draft.leadId !== leadId) {
      throw new BadRequestException(
        `Draft '${dto.draftId}' belongs to Lead '${draft.leadId}', not Lead '${leadId}'. Approval rejected.`,
      );
    }

    if (draft.status !== OutreachDraftStatus.DRAFT) {
      throw new ConflictException(
        `Cannot approve draft '${dto.draftId}': Draft is currently in '${draft.status}' state. Only un-sent DRAFT previews can be approved.`,
      );
    }

    const previousMetadata = (lead.metadata as Record<string, any>) || {};

    // 1. Atomically enable autonomousConversationMode
    await this.prisma.client.lead.update({
      where: { id: leadId },
      data: {
        metadata: {
          ...previousMetadata,
          autonomousConversationMode: true,
          autonomousApprovedAt: new Date().toISOString(),
          autonomousApprovedBy: userId,
          lastOutreachDraftId: draft.id,
        },
      },
    });

    // 2. Dispatch the approved draft via atomic send mechanism
    try {
      const sendResult = await this.outreachService.sendDraft(dto.draftId);

      // Log AuditEvent for approval action
      await this.auditService.log({
        actorType: 'USER',
        actorId: userId,
        userId,
        action: 'AUTONOMOUS_ENGAGEMENT_APPROVED',
        entityType: 'LEAD',
        entityId: leadId,
        oldState: { autonomousConversationMode: false },
        newState: { autonomousConversationMode: true },
        metadata: {
          draftId: dto.draftId,
          actualRecipientUsed: sendResult.actualRecipientUsed,
          originalRecipient: sendResult.originalRecipient,
          gmailMessageId: sendResult.gmailMessageId,
          safeTestModeActive: sendResult.safeTestModeActive,
          sentAt: sendResult.sentAt,
        },
      });

      this.logger.log(`Autonomous engagement APPROVED for Lead '${leadId}'. Draft '${dto.draftId}' dispatched successfully.`);

      return {
        success: true,
        leadId,
        autonomousConversationMode: true,
        sendResult,
      };
    } catch (sendErr: any) {
      this.logger.error(
        `[APPROVAL_SEND_FAILED] Failed to send approved draft '${dto.draftId}' for Lead '${leadId}': ${sendErr.message}. Rolling back autonomousConversationMode.`,
      );

      // Explicit rollback to prevent inconsistent state
      await this.prisma.client.lead.update({
        where: { id: leadId },
        data: {
          metadata: {
            ...previousMetadata,
            autonomousConversationMode: false,
            autonomousApprovalFailureReason: sendErr.message,
            autonomousApprovalFailedAt: new Date().toISOString(),
          },
        },
      });

      await this.auditService.log({
        actorType: 'USER',
        actorId: userId,
        userId,
        action: 'AUTONOMOUS_ENGAGEMENT_APPROVAL_FAILED',
        entityType: 'LEAD',
        entityId: leadId,
        metadata: {
          draftId: dto.draftId,
          error: sendErr.message,
        },
      });

      throw sendErr;
    }
  }

  /**
   * Step 3: Rejection Endpoint (POST /leads/:id/reject-autonomous-engagement).
   * ADMIN-only endpoint.
   * Leaves Lead in current manual state (autonomousConversationMode = false).
   * Logs AuditEvent with actorType: 'USER'.
   */
  async rejectAutonomousEngagement(
    leadId: string,
    dto: RejectAutonomousEngagementDto,
    userId: string,
  ) {
    const lead = await this.prisma.client.lead.findUnique({
      where: { id: leadId },
    });

    if (!lead) {
      throw new NotFoundException(`Lead with ID '${leadId}' not found.`);
    }

    const previousMetadata = (lead.metadata as Record<string, any>) || {};

    await this.prisma.client.lead.update({
      where: { id: leadId },
      data: {
        metadata: {
          ...previousMetadata,
          autonomousConversationMode: false,
          autonomousRejectedAt: new Date().toISOString(),
          autonomousRejectedBy: userId,
          autonomousRejectionReason: dto.reason || 'Rejected by Admin',
        },
      },
    });

    await this.auditService.log({
      actorType: 'USER',
      actorId: userId,
      userId,
      action: 'AUTONOMOUS_ENGAGEMENT_REJECTED',
      entityType: 'LEAD',
      entityId: leadId,
      metadata: {
        draftId: dto.draftId,
        reason: dto.reason || 'Rejected by Admin',
      },
    });

    this.logger.log(`Autonomous engagement REJECTED for Lead '${leadId}'. Flag remains false.`);

    return {
      success: true,
      leadId,
      autonomousConversationMode: false,
      status: 'REJECTED',
      reason: dto.reason || 'Rejected by Admin',
    };
  }

  /**
   * Sets the AI Control State on a Lead (AI_ACTIVE, PAUSED, TAKEN_OVER).
   * Records an AuditEvent.
   */
  async setAIControlState(
    leadId: string,
    targetState: AIControlState,
    userId?: string,
  ): Promise<Lead> {
    const lead = await this.prisma.client.lead.findUnique({
      where: { id: leadId },
      include: {
        company: true,
        primaryContact: true,
      },
    });

    if (!lead) {
      throw new NotFoundException(`Lead with ID '${leadId}' not found.`);
    }

    const previousState = lead.aiControlState;
    const updatedLead = await this.prisma.client.lead.update({
      where: { id: leadId },
      data: {
        aiControlState: targetState,
      },
      include: {
        company: true,
        primaryContact: true,
      },
    });

    this.logger.log(
      `Lead '${leadId}' AI control state transitioned from '${previousState}' to '${targetState}' by user '${userId || 'SYSTEM'}'.`,
    );

    const actionName =
      targetState === AIControlState.AI_ACTIVE
        ? 'LEAD_AI_RESUMED'
        : targetState === AIControlState.PAUSED
          ? 'LEAD_AI_PAUSED'
          : 'LEAD_AI_TAKEN_OVER';

    await this.auditService.log({
      actorType: 'USER',
      actorId: userId,
      userId,
      action: actionName,
      entityType: 'LEAD',
      entityId: leadId,
      oldState: { aiControlState: previousState },
      newState: { aiControlState: targetState },
      metadata: {
        leadId,
        previousState,
        newState: targetState,
      },
    });

    return updatedLead;
  }

  async pauseAI(leadId: string, userId?: string): Promise<Lead> {
    return this.setAIControlState(leadId, AIControlState.PAUSED, userId);
  }

  async takeOver(leadId: string, userId?: string): Promise<Lead> {
    return this.setAIControlState(leadId, AIControlState.TAKEN_OVER, userId);
  }

  async resumeAI(leadId: string, userId?: string): Promise<Lead> {
    return this.setAIControlState(leadId, AIControlState.AI_ACTIVE, userId);
  }
}

