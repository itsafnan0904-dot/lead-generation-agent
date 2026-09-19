import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GmailService } from '../gmail/gmail.service';
import { AIOrchestratorService } from '../ai/services/ai-orchestrator.service';
import { RestrictionEngineService } from '../restrictions/restriction-engine.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  LeadLifecycleStatus,
  OutreachDraftStatus,
  OutreachDraft,
  RestrictionCheckResult,
  NotificationPriority,
} from '@ai-sales-agent/database';
import { GenerateOutreachDraftDto, ListOutreachDraftsQueryDto } from './dto/outreach.dto';

export interface OutreachSendResult {
  draftId: string;
  leadId: string;
  status: OutreachDraftStatus;
  gmailMessageId: string;
  gmailThreadId: string;
  sentAt: Date;
  actualRecipientUsed: string;
  originalRecipient: string;
  safeTestModeActive: boolean;
}

@Injectable()
export class OutreachService {
  private readonly logger = new Logger(OutreachService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gmailService: GmailService,
    private readonly aiOrchestrator: AIOrchestratorService,
    private readonly restrictionEngine: RestrictionEngineService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Step 2: Generates an AI outreach email draft for a specific Lead.
   * LOCKED: Draft generation has ZERO external side effects — never calls Gmail, never sends.
   * Refuses immediately if the Lead is RESTRICTED.
   */
  async generateDraft(leadId: string, dto: GenerateOutreachDraftDto): Promise<OutreachDraft> {
    const lead = await this.prisma.client.lead.findUnique({
      where: { id: leadId },
      include: {
        company: true,
        primaryContact: true,
        assignedUser: true,
        research: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });

    if (!lead) {
      throw new NotFoundException(`Lead with ID '${leadId}' not found.`);
    }

    // Restriction check guard: Never draft for a RESTRICTED lead
    if (lead.status === LeadLifecycleStatus.RESTRICTED) {
      throw new BadRequestException(
        `Cannot generate outreach draft: Lead '${leadId}' is RESTRICTED by policy compliance.`,
      );
    }

    // Determine real sender identity from assigned user, connected Gmail account, or active ADMIN
    let senderName = lead.assignedUser?.name;
    let senderEmail = lead.assignedUser?.email;
    let senderTitle: string | undefined = lead.assignedUser?.role === 'ADMIN' ? 'Sales Director' : 'Account Executive';

    if (!senderName) {
      const activeGmail = await this.prisma.client.gmailAccount.findFirst({
        where: { isActive: true },
        include: { connectedByUser: true },
      });

      if (activeGmail?.connectedByUser) {
        senderName = activeGmail.connectedByUser.name;
        senderEmail = activeGmail.email || activeGmail.connectedByUser.email;
        senderTitle = activeGmail.connectedByUser.role === 'ADMIN' ? 'Sales Director' : 'Account Executive';
      } else if (activeGmail?.email) {
        senderEmail = activeGmail.email;
        senderName = 'Sales Team';
      } else {
        const adminUser = await this.prisma.client.user.findFirst({
          where: { role: 'ADMIN', isActive: true },
        });
        if (adminUser) {
          senderName = adminUser.name;
          senderEmail = adminUser.email;
          senderTitle = 'Sales Director';
        }
      }
    }

    const contactName = lead.primaryContact
      ? `${lead.primaryContact.firstName} ${lead.primaryContact.lastName || ''}`.trim()
      : 'Business Leader';
    const companyName = lead.company.name;
    const researchSummary = lead.research?.[0]?.companySummary || lead.company.industry || 'N/A';
    const keyInsights = (lead.research?.[0]?.keyInsights as string[]) || [];

    const contextNotes = [
      `Company: ${companyName}`,
      `Industry: ${lead.company.industry || 'N/A'}`,
      `Lead Stage: ${lead.status}`,
      `Research Summary: ${researchSummary}`,
      `Key Insights: ${keyInsights.join('; ')}`,
      dto.additionalContext ? `Additional User Directives: ${dto.additionalContext}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    this.logger.log(`Calling AIOrchestratorService.generateEmail() for Lead '${leadId}' with sender '${senderName || 'Sales Team'}'...`);
    const aiResponse = await this.aiOrchestrator.generateEmail(
      {
        recipientName: contactName,
        companyName,
        contextNotes,
        tone: dto.tone || 'professional and consultative',
        senderName: senderName || 'Sales Team',
        senderTitle: senderTitle || 'Account Executive',
        senderCompany: process.env.SENDER_COMPANY_NAME || 'Enterprise Solutions',
        senderEmail: senderEmail || undefined,
      },
      { leadId: lead.id },
    );

    const emailContent = aiResponse.data;

    // Persist draft to database in DRAFT state
    return this.prisma.client.outreachDraft.create({
      data: {
        leadId: lead.id,
        subject: emailContent.subject,
        bodyText: emailContent.bodyText,
        bodyHtml: emailContent.bodyHtml || null,
        callToAction: emailContent.callToAction,
        rationale: emailContent.rationale,
        personalizationPoints: emailContent.personalizationPointsUsed as any,
        status: OutreachDraftStatus.DRAFT,
        aiUsageMetadata: {
          ...aiResponse.metadata,
          generatedAt: new Date().toISOString(),
        } as any,
      },
    });
  }

  /**
   * Step 3: Explicit Human-Gated Send Endpoint (POST /outreach/:draftId/send).
   * This is the ONLY code path in the entire system that calls GmailService.sendEmail() for outreach.
   * Performs atomic state transition, duplicate-send protection, restriction re-verification,
   * synchronous limit checks, and OUTREACH_SAFE_TEST_MODE redirection.
   */
  async sendDraft(draftId: string): Promise<OutreachSendResult> {
    const draft = await this.prisma.client.outreachDraft.findUnique({
      where: { id: draftId },
      include: {
        lead: {
          include: {
            company: true,
            primaryContact: true,
          },
        },
      },
    });

    if (!draft) {
      throw new NotFoundException(`Outreach draft with ID '${draftId}' not found.`);
    }

    // Duplicate-send protection: Only DRAFT state may be sent
    if (draft.status !== OutreachDraftStatus.DRAFT) {
      throw new ConflictException(
        `Cannot send draft '${draftId}': Draft is already in '${draft.status}' state. Duplicate send prevented.`,
      );
    }

    // Restriction re-verification: Ensure lead has not become RESTRICTED
    if (draft.lead.status === LeadLifecycleStatus.RESTRICTED) {
      throw new BadRequestException(
        `Cannot send draft '${draftId}': Lead '${draft.leadId}' is currently in RESTRICTED compliance status.`,
      );
    }

    // Step 4: Synchronous Outreach Limit & Sending Hours Enforcement
    this.enforceOutreachLimits();
    await this.enforceDailyLimit();

    const originalRecipient = draft.lead.primaryContact?.email;
    if (!originalRecipient) {
      throw new BadRequestException(
        `Cannot send draft '${draftId}': Lead '${draft.leadId}' has no primary contact email address.`,
      );
    }

    // ATOMIC CONCURRENCY GUARD: Claim the draft by transitioning status from DRAFT -> SENT atomically.
    // In PostgreSQL, updateMany with a WHERE status = 'DRAFT' clause is an atomic row-level operation.
    // Only ONE concurrent request will have count === 1. All concurrent racing requests will get count === 0.
    const claimResult = await this.prisma.client.outreachDraft.updateMany({
      where: {
        id: draftId,
        status: OutreachDraftStatus.DRAFT,
      },
      data: {
        status: OutreachDraftStatus.SENT,
        sentAt: new Date(),
      },
    });

    if (claimResult.count === 0) {
      const currentDraft = await this.prisma.client.outreachDraft.findUnique({
        where: { id: draftId },
      });
      throw new ConflictException(
        `Cannot send draft '${draftId}': Draft is already in '${currentDraft?.status || 'SENT'}' state. Concurrent duplicate send prevented.`,
      );
    }

    // OUTREACH_SAFE_TEST_MODE Redirection
    const isSafeTestMode = (process.env.OUTREACH_SAFE_TEST_MODE || 'true').toLowerCase() === 'true';
    const safeTestRecipient = process.env.OUTREACH_TEST_RECIPIENT_EMAIL || 'safe-test-recipient@domain.com';

    let actualRecipient = originalRecipient;
    if (isSafeTestMode) {
      actualRecipient = safeTestRecipient;
      this.logger.warn(
        `========================================================================\n` +
        `[OUTREACH_SAFE_TEST_MODE ACTIVE] REDIRECTING REAL OUTREACH SEND!\n` +
        `  Original Intended Recipient: ${originalRecipient}\n` +
        `  Safe Test Recipient Target:  ${actualRecipient}\n` +
        `  Draft ID:                    ${draft.id}\n` +
        `  Lead ID:                     ${draft.leadId}\n` +
        `========================================================================`,
      );
    }

    // Send via GmailService
    let sendResult: { messageId: string; threadId: string };
    try {
      sendResult = await this.gmailService.sendEmail({
        to: actualRecipient,
        subject: draft.subject,
        bodyText: draft.bodyText,
        bodyHtml: draft.bodyHtml || undefined,
      });
    } catch (err: any) {
      this.logger.error(`Failed to send email via Gmail for draft '${draftId}': ${err.message}`);
      // Record failure state per Section 20 principle without silent retry
      await this.prisma.client.outreachDraft.update({
        where: { id: draft.id },
        data: {
          status: OutreachDraftStatus.FAILED,
          errorMessage: `Gmail send failed: ${err.message}`,
        },
      });

      // Notify: ACTION_REQUIRED Outreach send failed
      await this.notificationsService.create({
        priority: NotificationPriority.ACTION_REQUIRED,
        title: 'Outreach Send Failed',
        message: `Failed to dispatch outreach email to '${actualRecipient}' for Lead '${draft.leadId}': ${err.message}`,
        entityType: 'OUTREACH_DRAFT',
        entityId: draft.id,
        userId: draft.lead.assignedUserId,
        metadata: {
          draftId: draft.id,
          leadId: draft.leadId,
          error: err.message,
        },
      });

      throw new InternalServerErrorException(`Outreach email dispatch failed: ${err.message}`);
    }

    const sentTimestamp = new Date();

    // Atomic database update: mark SENT and record message/thread IDs
    const updatedDraft = await this.prisma.client.outreachDraft.update({
      where: { id: draft.id },
      data: {
        status: OutreachDraftStatus.SENT,
        gmailMessageId: sendResult.messageId,
        gmailThreadId: sendResult.threadId,
        sentAt: sentTimestamp,
      },
    });

    // Advance Lead Lifecycle Status from COLD_LEAD to CONTACTED if currently cold
    if (draft.lead.status === LeadLifecycleStatus.COLD_LEAD) {
      await this.prisma.client.lead.update({
        where: { id: draft.leadId },
        data: {
          status: LeadLifecycleStatus.CONTACTED,
          metadata: {
            ...(draft.lead.metadata as any || {}),
            firstContactedAt: sentTimestamp.toISOString(),
            lastOutreachDraftId: draft.id,
          },
        },
      });
      this.logger.log(`Lead '${draft.leadId}' transitioned from COLD_LEAD to CONTACTED.`);
    }

    // Record AuditEvent for outreach email dispatch
    await this.auditService.log({
      actorType: 'USER',
      action: 'OUTREACH_EMAIL_SENT',
      entityType: 'OUTREACH_DRAFT',
      entityId: draft.id,
      oldState: { status: OutreachDraftStatus.DRAFT },
      newState: {
        status: OutreachDraftStatus.SENT,
        gmailMessageId: sendResult.messageId,
        gmailThreadId: sendResult.threadId,
        sentAt: sentTimestamp,
      },
      metadata: {
        leadId: draft.leadId,
        recipient: actualRecipient,
        originalRecipient,
        safeTestModeActive: isSafeTestMode,
      },
    });

    // Notify: INFO Email sent
    await this.notificationsService.create({
      priority: NotificationPriority.INFO,
      title: 'Outreach Email Sent',
      message: `Outreach email successfully sent to '${actualRecipient}' for Lead '${draft.lead.company?.name || draft.leadId}'.`,
      entityType: 'OUTREACH_DRAFT',
      entityId: draft.id,
      userId: draft.lead.assignedUserId,
      metadata: {
        draftId: draft.id,
        leadId: draft.leadId,
        gmailMessageId: sendResult.messageId,
        recipient: actualRecipient,
      },
    });

    return {
      draftId: updatedDraft.id,
      leadId: draft.leadId,
      status: updatedDraft.status,
      gmailMessageId: sendResult.messageId,
      gmailThreadId: sendResult.threadId,
      sentAt: sentTimestamp,
      actualRecipientUsed: actualRecipient,
      originalRecipient,
      safeTestModeActive: isSafeTestMode,
    };
  }

  /**
   * Retrieves a draft by ID.
   */
  async getDraftById(id: string): Promise<OutreachDraft> {
    const draft = await this.prisma.client.outreachDraft.findUnique({
      where: { id },
      include: {
        lead: {
          include: {
            company: true,
            primaryContact: true,
          },
        },
      },
    });

    if (!draft) {
      throw new NotFoundException(`Outreach draft with ID '${id}' not found.`);
    }

    return draft;
  }

  /**
   * Lists drafts with optional leadId and status filters.
   */
  async listDrafts(query: ListOutreachDraftsQueryDto) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.leadId) where.leadId = query.leadId;
    if (query.status) where.status = query.status;

    const [items, total] = await Promise.all([
      this.prisma.client.outreachDraft.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          lead: {
            select: { id: true, status: true, company: { select: { name: true } } },
          },
        },
      }),
      this.prisma.client.outreachDraft.count({ where }),
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
   * Synchronous sending hours enforcement.
   * Checks current hour in reference timezone against configured window.
   */
  enforceOutreachLimits(): void {
    const startHour = parseInt(process.env.OUTREACH_SENDING_HOURS_START || '9', 10);
    const endHour = parseInt(process.env.OUTREACH_SENDING_HOURS_END || '17', 10);

    const now = new Date();
    // Use UTC hours as baseline unless offset/timezone configured
    const currentHour = now.getUTCHours();

    if (currentHour < startHour || currentHour >= endHour) {
      // In development / testing, log warning or enforce if strictly desired
      // We enforce strictly if configured
      if (process.env.NODE_ENV === 'production') {
        throw new BadRequestException(
          `Sending refused: Current hour (${currentHour}:00 UTC) is outside allowed sending window (${startHour}:00 - ${endHour}:00 UTC).`,
        );
      }
    }
  }

  /**
   * Synchronous daily sending limit enforcement.
   * Counts total SENT drafts globally for today's date UTC.
   */
  async enforceDailyLimit(): Promise<void> {
    const dailyLimit = parseInt(process.env.OUTREACH_DAILY_LIMIT || '15', 10);

    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);

    const sentTodayCount = await this.prisma.client.outreachDraft.count({
      where: {
        status: OutreachDraftStatus.SENT,
        sentAt: { gte: startOfDay },
      },
    });

    if (sentTodayCount >= dailyLimit) {
      throw new BadRequestException(
        `Sending refused: Global daily outreach limit of ${dailyLimit} emails reached (${sentTodayCount} already sent today).`,
      );
    }
  }
}
