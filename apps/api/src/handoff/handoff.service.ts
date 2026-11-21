import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { LeadPriorityService } from '../leads/services/lead-priority.service';
import { AIControlState, NotificationPriority } from '@ai-sales-agent/database';
import { buildHandoffBrief, HandoffBrief } from './handoff-brief.util';

export interface HandoffResult {
  handedOff: boolean;
  reason?: 'NO_TRIGGER' | 'AI_NOT_ACTIVE' | 'ALREADY_HANDLED' | 'LEAD_NOT_FOUND';
  brief?: HandoffBrief;
}

@Injectable()
export class HandoffService {
  private readonly logger = new Logger(HandoffService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly priorityService: LeadPriorityService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Called after an inbound client message is ingested. If any of the seller's intervention rules
   * fire, the AI is paused on that lead, the handoff brief is stored, and the owner is notified.
   * Idempotent per message. A lead the human already paused or took over is left alone.
   */
  async handleInboundMessage(leadId: string, messageId: string): Promise<HandoffResult> {
    const lead = await this.prisma.client.lead.findUnique({ where: { id: leadId } });
    if (!lead) return { handedOff: false, reason: 'LEAD_NOT_FOUND' };

    if ((lead.metadata as any)?.handoff?.messageId === messageId) {
      return { handedOff: false, reason: 'ALREADY_HANDLED' };
    }

    const [{ priority }] = await this.priorityService.enrich([lead]);
    if (!priority.needsHuman) return { handedOff: false, reason: 'NO_TRIGGER' };
    if (lead.aiControlState !== AIControlState.AI_ACTIVE) return { handedOff: false, reason: 'AI_NOT_ACTIVE' };

    const brief = await this.buildBrief(leadId);

    await this.prisma.client.lead.update({
      where: { id: leadId },
      data: {
        aiControlState: AIControlState.PAUSED,
        metadata: {
          ...((lead.metadata as any) || {}),
          handoff: {
            messageId,
            at: new Date().toISOString(),
            reasons: priority.humanReasons,
            brief,
          },
        },
      },
    });

    await this.auditService.log({
      actorType: 'SYSTEM',
      action: 'LEAD_AI_HANDOFF',
      entityType: 'LEAD',
      entityId: leadId,
      oldState: { aiControlState: lead.aiControlState },
      newState: { aiControlState: AIControlState.PAUSED },
      metadata: { messageId, reasons: priority.humanReasons },
    });

    await this.notificationsService.create({
      priority: NotificationPriority.ACTION_REQUIRED,
      title: 'Your Turn: AI Handed Off a Lead',
      message: `${brief.headline}. The AI has paused on this lead until you reply or resume it.`,
      entityType: 'LEAD',
      entityId: leadId,
      userId: lead.assignedUserId,
      metadata: { leadId, messageId, reasons: priority.humanReasons },
    });

    this.logger.log(`AI handed off lead '${leadId}' to a human: ${priority.humanReasons.join('; ')}`);
    return { handedOff: true, brief };
  }

  /** Live brief for a lead (also used by the lead page). */
  async buildBrief(leadId: string): Promise<HandoffBrief> {
    const lead = await this.prisma.client.lead.findUnique({
      where: { id: leadId },
      include: {
        company: true,
        primaryContact: true,
        qualifications: { orderBy: { createdAt: 'desc' }, take: 1 },
        projects: { where: { budget: { not: null } }, orderBy: { budget: 'desc' }, take: 1 },
        conversations: {
          include: { messages: { orderBy: { sentAt: 'desc' }, take: 10 } },
        },
      },
    });
    if (!lead) throw new NotFoundException(`Lead with ID '${leadId}' not found.`);

    const [{ priority }] = await this.priorityService.enrich([lead]);

    const messages = lead.conversations
      .flatMap((c) => c.messages)
      .sort((a, b) => a.sentAt.getTime() - b.sentAt.getTime())
      .map((m) => ({ direction: m.direction as 'INBOUND' | 'OUTBOUND', sentAt: m.sentAt, text: m.bodyText }));

    const q = lead.qualifications[0];
    const project = lead.projects[0];

    return buildHandoffBrief({
      companyName: lead.company.name,
      contactName: lead.primaryContact ? `${lead.primaryContact.firstName} ${lead.primaryContact.lastName || ''}`.trim() : null,
      contactTitle: lead.primaryContact?.title ?? null,
      status: lead.status,
      fitScore: lead.scoreTotal,
      readinessScore: priority.readinessScore,
      priorityLabel: priority.priorityLabel,
      reasons: priority.humanReasons,
      qualification: q
        ? {
            budgetFit: q.budgetFit, authorityFit: q.authorityFit, needFit: q.needFit,
            timelineFit: q.timelineFit, technicalFit: q.technicalFit, fitSummary: q.fitSummary,
          }
        : null,
      projectBudget: project?.budget != null ? { amount: Number(project.budget), currency: project.currency } : null,
      messages,
    });
  }
}
