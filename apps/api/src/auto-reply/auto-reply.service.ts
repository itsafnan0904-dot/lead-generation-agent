import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AIOrchestratorService } from '../ai/services/ai-orchestrator.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { OutreachService } from '../outreach/outreach.service';
import { SellerContextService } from '../seller-profile/seller-context.service';
import {
  MessageDirection,
  NotificationPriority,
  OutreachDraftStatus,
} from '@ai-sales-agent/database';
import { decideAutoReply, resolveAutoReplyMode } from './auto-reply-policy.util';

export interface AutoReplyResult {
  action: 'SKIPPED' | 'DRAFTED' | 'SENT' | 'FAILED';
  reason?: string;
  draftId?: string;
}

const THREAD_CONTEXT_MESSAGES = 6;

@Injectable()
export class AutoReplyService {
  private readonly logger = new Logger(AutoReplyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiOrchestrator: AIOrchestratorService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
    private readonly outreachService: OutreachService,
    private readonly sellerContext: SellerContextService,
  ) {}

  /**
   * Called after an inbound message has been ingested, analysed, restriction-checked and run through the
   * human-handoff rules. Drafts a reply, and sends it only when every autonomy gate passes.
   * All sending goes through OutreachService.sendDraft(), which keeps duplicate-send protection, restriction
   * re-verification, daily limits, sending hours and OUTREACH_SAFE_TEST_MODE.
   */
  async handleInboundMessage(
    leadId: string,
    messageId: string,
    analysis: { intent?: string | null; requiresHumanIntervention?: boolean; requires_human?: boolean; summary?: string } | null,
  ): Promise<AutoReplyResult> {
    const mode = resolveAutoReplyMode();
    if (mode === 'off') return { action: 'SKIPPED', reason: 'KILL_SWITCH_OFF' };

    const [lead, message] = await Promise.all([
      this.prisma.client.lead.findUnique({
        where: { id: leadId },
        include: { company: true, primaryContact: true, assignedUser: true },
      }),
      this.prisma.client.message.findUnique({
        where: { id: messageId },
        include: { conversation: true },
      }),
    ]);
    if (!lead || !message || message.direction !== MessageDirection.INBOUND) {
      return { action: 'SKIPPED', reason: 'LEAD_OR_INBOUND_MESSAGE_NOT_FOUND' };
    }

    const [existing, sentLast24h] = await Promise.all([
      this.prisma.client.outreachDraft.findFirst({
        where: { leadId, aiUsageMetadata: { path: ['inReplyToMessageId'], equals: messageId } },
        select: { id: true },
      }),
      this.prisma.client.outreachDraft.count({
        where: {
          leadId,
          status: OutreachDraftStatus.SENT,
          sentAt: { gte: new Date(Date.now() - 86_400_000) },
          aiUsageMetadata: { path: ['kind'], equals: 'AUTO_REPLY' },
        },
      }),
    ]);

    const decision = decideAutoReply({
      mode,
      leadStatus: lead.status,
      aiControlState: lead.aiControlState,
      autonomousOptIn: (lead.metadata as any)?.autonomousConversationMode === true,
      analysisRequiresHuman: analysis?.requiresHumanIntervention === true || analysis?.requires_human === true,
      intent: analysis?.intent,
      contactEmail: lead.primaryContact?.email,
      replyAlreadyExists: !!existing,
      autoRepliesSentLast24h: sentLast24h,
      maxAutoRepliesPerDay: parseInt(process.env.AUTO_REPLY_MAX_PER_LEAD_PER_DAY || '3', 10),
    });

    if (decision.action === 'SKIP') {
      this.logger.log(`Auto-reply skipped for lead '${leadId}': ${decision.reason}`);
      return { action: 'SKIPPED', reason: decision.reason };
    }

    // ---- Generate the reply (no external side effects) ----
    let draftId: string;
    try {
      draftId = await this.generateReplyDraft(lead, message, decision.action === 'AUTO_SEND' ? 'AUTO_REPLY' : 'REPLY_DRAFT');
    } catch (err: any) {
      this.logger.error(`Reply generation failed for lead '${leadId}': ${err.message}`);
      return { action: 'FAILED', reason: `GENERATION_FAILED: ${err.message}` };
    }

    if (decision.action === 'DRAFT_FOR_APPROVAL') {
      await this.auditService.log({
        actorType: 'AI',
        action: 'REPLY_DRAFTED_FOR_APPROVAL',
        entityType: 'OUTREACH_DRAFT',
        entityId: draftId,
        metadata: { leadId, inReplyToMessageId: messageId, reason: decision.reason },
      });
      await this.notificationsService.create({
        priority: NotificationPriority.IMPORTANT,
        title: 'Reply Draft Ready for Approval',
        message: `The AI drafted a reply to ${lead.company.name}. Review and send it from the lead page.`,
        entityType: 'OUTREACH_DRAFT',
        entityId: draftId,
        userId: lead.assignedUserId,
        metadata: { leadId, draftId, inReplyToMessageId: messageId, reason: decision.reason },
      });
      return { action: 'DRAFTED', reason: decision.reason, draftId };
    }

    // ---- AUTO_SEND: every gate passed; sendDraft re-enforces limits and restrictions ----
    try {
      await this.outreachService.sendDraft(draftId);
      await this.auditService.log({
        actorType: 'AI',
        action: 'AUTO_REPLY_SENT',
        entityType: 'OUTREACH_DRAFT',
        entityId: draftId,
        metadata: { leadId, inReplyToMessageId: messageId },
      });
      return { action: 'SENT', draftId };
    } catch (err: any) {
      // sendDraft refusing (limits, hours, restriction) leaves the draft for a human; never retried silently
      this.logger.warn(`Auto-send refused for draft '${draftId}': ${err.message}`);
      await this.notificationsService.create({
        priority: NotificationPriority.ACTION_REQUIRED,
        title: 'Auto-Reply Not Sent: Review Needed',
        message: `A reply to ${lead.company.name} could not be sent automatically (${err.message}). Review the draft.`,
        entityType: 'OUTREACH_DRAFT',
        entityId: draftId,
        userId: lead.assignedUserId,
        metadata: { leadId, draftId, error: err.message },
      });
      return { action: 'FAILED', reason: `SEND_REFUSED: ${err.message}`, draftId };
    }
  }

  private async generateReplyDraft(lead: any, message: any, kind: 'AUTO_REPLY' | 'REPLY_DRAFT'): Promise<string> {
    const thread = await this.prisma.client.message.findMany({
      where: { conversationId: message.conversationId },
      orderBy: { sentAt: 'desc' },
      take: THREAD_CONTEXT_MESSAGES,
      select: { direction: true, sentAt: true, bodyText: true },
    });
    const transcript = thread
      .reverse()
      .map((m) => `${m.direction === MessageDirection.INBOUND ? 'CLIENT' : 'US'}: ${m.bodyText.replace(/\s+/g, ' ').trim().slice(0, 600)}`)
      .join('\n');

    const seller = await this.sellerContext.getContext(lead.assignedUserId);
    const contact = lead.primaryContact;

    const aiResponse = await this.aiOrchestrator.generateEmail(
      {
        recipientName: contact ? `${contact.firstName} ${contact.lastName || ''}`.trim() : 'there',
        companyName: lead.company.name,
        contextNotes: `Conversation so far (oldest first):\n${transcript}\n\nReply to the CLIENT's latest message.`,
        tone: seller?.tone || 'professional and consultative',
        senderName: seller?.displayName || lead.assignedUser?.name || 'Sales Team',
        senderTitle: seller?.title || 'Account Executive',
        senderCompany: seller?.companyName || process.env.SENDER_COMPANY_NAME || 'Enterprise Solutions',
        senderEmail: lead.assignedUser?.email,
        sellerContext: seller?.pitchContext,
        signature: seller?.signature || undefined,
        isReply: true,
      },
      { leadId: lead.id, conversationId: message.conversationId, messageId: message.id },
    );

    const email = aiResponse.data;
    const baseSubject = (message.subject || email.subject || 'Your enquiry').trim();
    const subject = /^re:/i.test(baseSubject) ? baseSubject : `Re: ${baseSubject}`;

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
        gmailThreadId: message.conversation?.gmailThreadId || null,
        aiUsageMetadata: {
          ...aiResponse.metadata,
          kind,
          inReplyToMessageId: message.id,
          generatedAt: new Date().toISOString(),
        } as any,
      },
    });
    return draft.id;
  }
}
