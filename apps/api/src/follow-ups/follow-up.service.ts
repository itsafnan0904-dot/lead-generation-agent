import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AIOrchestratorService } from '../ai/services/ai-orchestrator.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { OutreachService } from '../outreach/outreach.service';
import { SellerContextService } from '../seller-profile/seller-context.service';
import { MessageDirection, NotificationPriority, OutreachDraftStatus } from '@ai-sales-agent/database';
import { decideFollowUp, resolveFollowUpMode } from './follow-up-policy.util';

export interface FollowUpScanResult {
  mode: string;
  considered: number;
  drafted: number;
  sent: number;
  skipped: number;
  failed: number;
}

const FOLLOW_UP_KINDS = ['FOLLOW_UP', 'AUTO_FOLLOW_UP'];
const MAX_LEADS_PER_SCAN = 200;
const ELIGIBLE_STATUSES = [
  'CONTACTED', 'RESPONDED', 'INTERESTED', 'GATHERING_REQUIREMENTS', 'QUALIFIED',
  'DEAL_DISCUSSION', 'WAITING_FOR_CLIENT', 'FOLLOW_UP_REQUIRED',
] as const;

@Injectable()
export class FollowUpService {
  private readonly logger = new Logger(FollowUpService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiOrchestrator: AIOrchestratorService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
    private readonly outreachService: OutreachService,
    private readonly sellerContext: SellerContextService,
  ) {}

  /**
   * Scans open leads for ones that have gone quiet after we last wrote, and drafts (or, when every gate
   * allows, sends) a follow-up. Sends go through OutreachService.sendDraft so limits, sending hours,
   * restriction re-checks and OUTREACH_SAFE_TEST_MODE still apply.
   */
  async scanAndProcess(now: Date = new Date()): Promise<FollowUpScanResult> {
    const mode = resolveFollowUpMode();
    const result: FollowUpScanResult = { mode, considered: 0, drafted: 0, sent: 0, skipped: 0, failed: 0 };
    if (mode === 'off') return result;

    const afterDays = Math.max(1, parseInt(process.env.FOLLOW_UP_AFTER_DAYS || '3', 10) || 3);
    const maxFollowUps = Math.max(1, parseInt(process.env.FOLLOW_UP_MAX_COUNT || '2', 10) || 2);
    const db = this.prisma.client;

    const leads = await db.lead.findMany({
      where: { status: { in: ELIGIBLE_STATUSES as any }, aiControlState: 'AI_ACTIVE' },
      include: { company: true, primaryContact: true, assignedUser: true, campaign: { select: { status: true } } },
      orderBy: { updatedAt: 'asc' },
      take: MAX_LEADS_PER_SCAN,
    });
    result.considered = leads.length;
    if (leads.length === 0) return result;
    const leadIds = leads.map((l) => l.id);

    const [messages, drafts] = await Promise.all([
      db.message.findMany({
        where: { conversation: { leadId: { in: leadIds } } },
        select: { direction: true, sentAt: true, conversation: { select: { leadId: true, gmailThreadId: true, subject: true } } },
        orderBy: { sentAt: 'desc' },
        take: 5000,
      }),
      db.outreachDraft.findMany({
        where: { leadId: { in: leadIds }, status: { in: [OutreachDraftStatus.SENT, OutreachDraftStatus.DRAFT] } },
        select: { leadId: true, status: true, sentAt: true, subject: true, gmailThreadId: true, aiUsageMetadata: true },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    type Activity = { lastOutboundAt: Date | null; lastInboundAt: Date | null; threadId: string | null; subject: string | null };
    const activity = new Map<string, Activity>();
    const touch = (id: string) => {
      if (!activity.has(id)) activity.set(id, { lastOutboundAt: null, lastInboundAt: null, threadId: null, subject: null });
      return activity.get(id)!;
    };
    for (const m of messages) {
      const id = m.conversation.leadId;
      if (!id) continue;
      const a = touch(id);
      if (m.direction === MessageDirection.OUTBOUND && (!a.lastOutboundAt || m.sentAt > a.lastOutboundAt)) {
        a.lastOutboundAt = m.sentAt;
        a.threadId = m.conversation.gmailThreadId ?? a.threadId;
        a.subject = m.conversation.subject ?? a.subject;
      }
      if (m.direction === MessageDirection.INBOUND && (!a.lastInboundAt || m.sentAt > a.lastInboundAt)) a.lastInboundAt = m.sentAt;
    }

    const followUpsSent = new Map<string, number>();
    const pendingFollowUp = new Set<string>();
    for (const d of drafts) {
      const a = touch(d.leadId);
      const kind = (d.aiUsageMetadata as any)?.kind as string | undefined;
      if (d.status === OutreachDraftStatus.SENT && d.sentAt) {
        if (!a.lastOutboundAt || d.sentAt > a.lastOutboundAt) {
          a.lastOutboundAt = d.sentAt;
          a.threadId = d.gmailThreadId ?? a.threadId;
          a.subject = d.subject ?? a.subject;
        }
        if (kind && FOLLOW_UP_KINDS.includes(kind)) followUpsSent.set(d.leadId, (followUpsSent.get(d.leadId) ?? 0) + 1);
      }
      if (d.status === OutreachDraftStatus.DRAFT && kind && FOLLOW_UP_KINDS.includes(kind)) pendingFollowUp.add(d.leadId);
    }

    for (const lead of leads) {
      const a = activity.get(lead.id);
      const decision = decideFollowUp({
        mode: mode as any,
        leadStatus: lead.status,
        aiControlState: lead.aiControlState,
        campaignStatus: lead.campaign?.status ?? null,
        autonomousOptIn: (lead.metadata as any)?.autonomousConversationMode === true,
        contactEmail: lead.primaryContact?.email,
        lastOutboundAt: a?.lastOutboundAt ?? null,
        lastInboundAt: a?.lastInboundAt ?? null,
        now,
        afterDays,
        followUpsSent: followUpsSent.get(lead.id) ?? 0,
        maxFollowUps,
        hasPendingFollowUpDraft: pendingFollowUp.has(lead.id),
      });

      if (decision.action === 'SKIP') { result.skipped++; continue; }

      let draftId: string;
      try {
        draftId = await this.generateFollowUpDraft(lead, a!, decision.followUpNumber, decision.isFinal, decision.action === 'AUTO_SEND');
      } catch (err: any) {
        this.logger.error(`Follow-up generation failed for lead '${lead.id}': ${err.message}`);
        result.failed++;
        continue;
      }

      if (decision.action === 'DRAFT_FOR_APPROVAL') {
        result.drafted++;
        await this.auditService.log({
          actorType: 'AI', action: 'FOLLOW_UP_DRAFTED_FOR_APPROVAL', entityType: 'OUTREACH_DRAFT', entityId: draftId,
          metadata: { leadId: lead.id, followUpNumber: decision.followUpNumber, reason: decision.reason },
        });
        await this.notificationsService.create({
          priority: NotificationPriority.IMPORTANT,
          title: 'Follow-Up Draft Ready for Approval',
          message: `${lead.company.name} has not replied. The AI drafted follow-up #${decision.followUpNumber}; review and send it from the lead page.`,
          entityType: 'OUTREACH_DRAFT', entityId: draftId, userId: lead.assignedUserId,
          metadata: { leadId: lead.id, draftId, followUpNumber: decision.followUpNumber },
        });
        continue;
      }

      try {
        await this.outreachService.sendDraft(draftId);
        result.sent++;
        await this.auditService.log({
          actorType: 'AI', action: 'AUTO_FOLLOW_UP_SENT', entityType: 'OUTREACH_DRAFT', entityId: draftId,
          metadata: { leadId: lead.id, followUpNumber: decision.followUpNumber },
        });
      } catch (err: any) {
        // Limits, hours or a restriction refused the send: keep the draft for a human, stop spamming retries
        result.failed++;
        this.logger.warn(`Auto follow-up refused for draft '${draftId}': ${err.message}`);
        await this.notificationsService.create({
          priority: NotificationPriority.ACTION_REQUIRED,
          title: 'Follow-Up Not Sent: Review Needed',
          message: `A follow-up to ${lead.company.name} could not be sent automatically (${err.message}). Review the draft.`,
          entityType: 'OUTREACH_DRAFT', entityId: draftId, userId: lead.assignedUserId,
          metadata: { leadId: lead.id, draftId, error: err.message },
        });
      }
    }

    this.logger.log(`Follow-up scan (${mode}): considered ${result.considered}, drafted ${result.drafted}, sent ${result.sent}, skipped ${result.skipped}, failed ${result.failed}.`);
    return result;
  }

  private async generateFollowUpDraft(
    lead: any,
    a: { threadId: string | null; subject: string | null },
    followUpNumber: number,
    isFinal: boolean,
    auto: boolean,
  ): Promise<string> {
    const seller = await this.sellerContext.getContext(lead.assignedUserId);
    const contact = lead.primaryContact;

    const aiResponse = await this.aiOrchestrator.generateEmail(
      {
        recipientName: contact ? `${contact.firstName} ${contact.lastName || ''}`.trim() : 'there',
        companyName: lead.company.name,
        contextNotes: `Company: ${lead.company.name}\nIndustry: ${lead.company.industry || 'N/A'}\nLead stage: ${lead.status}\nThis is follow-up #${followUpNumber}; the client has not replied to our last message.`,
        tone: seller?.tone || 'professional and consultative',
        senderName: seller?.displayName || lead.assignedUser?.name || 'Sales Team',
        senderTitle: seller?.title || 'Account Executive',
        senderCompany: seller?.companyName || process.env.SENDER_COMPANY_NAME || 'Enterprise Solutions',
        senderEmail: lead.assignedUser?.email,
        sellerContext: seller?.pitchContext,
        signature: seller?.signature || undefined,
        isFollowUp: true,
        followUpIsFinal: isFinal,
      },
      { leadId: lead.id },
    );

    const email = aiResponse.data;
    const base = (a.subject || email.subject || 'Following up').trim();
    const subject = /^re:/i.test(base) ? base : `Re: ${base}`;

    const draft = await this.prisma.client.outreachDraft.create({
      data: {
        leadId: lead.id,
        subject,
        bodyText: email.bodyText,
        bodyHtml: email.bodyHtml || null,
        callToAction: email.callToAction,
        rationale: email.rationale,
        personalizationPoints: email.personalizationPointsUsed as any,
        status: OutreachDraftStatus.DRAFT,
        gmailThreadId: a.threadId,
        aiUsageMetadata: {
          ...aiResponse.metadata,
          kind: auto ? 'AUTO_FOLLOW_UP' : 'FOLLOW_UP',
          followUpNumber,
          generatedAt: new Date().toISOString(),
        } as any,
      },
    });
    return draft.id;
  }
}
