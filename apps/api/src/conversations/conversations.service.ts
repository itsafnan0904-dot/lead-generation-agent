import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GmailService, GmailMessageMetadata } from '../gmail/gmail.service';
import { AIOrchestratorService } from '../ai/services/ai-orchestrator.service';
import { RestrictionEngineService } from '../restrictions/restriction-engine.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  LeadLifecycleStatus,
  MessageDirection,
  RestrictionEntityType,
  AIControlState,
  HumanReviewStatus,
  HumanReviewTriggerSource,
  NotificationPriority,
  Conversation,
  Message,
} from '@ai-sales-agent/database';
import { ListConversationsQueryDto, SyncGmailQueryDto } from './dto/conversation.dto';

export interface IngestedMessageResult {
  messageId: string;
  gmailMessageId: string;
  conversationId: string;
  leadId: string | null;
  assignmentStatus: 'ASSIGNED' | 'NEEDS_HUMAN_ASSIGNMENT';
  aiAnalysisPerformed: boolean;
  restrictionResult?: string;
  leadStatusUpdated?: string;
}

export interface SyncGmailResult {
  messagesFound: number;
  newMessagesIngested: number;
  skippedDuplicates: number;
  details: IngestedMessageResult[];
}

export const OPEN_LEAD_STATUSES: LeadLifecycleStatus[] = [
  LeadLifecycleStatus.COLD_LEAD,
  LeadLifecycleStatus.CONTACTED,
  LeadLifecycleStatus.RESPONDED,
  LeadLifecycleStatus.INTERESTED,
  LeadLifecycleStatus.GATHERING_REQUIREMENTS,
  LeadLifecycleStatus.QUALIFIED,
  LeadLifecycleStatus.DEAL_DISCUSSION,
  LeadLifecycleStatus.WAITING_FOR_CLIENT,
  LeadLifecycleStatus.FOLLOW_UP_REQUIRED,
  LeadLifecycleStatus.HUMAN_REVIEW,
];

export const TERMINAL_AND_BLOCKED_STATUSES: LeadLifecycleStatus[] = [
  LeadLifecycleStatus.WON,
  LeadLifecycleStatus.LOST,
  LeadLifecycleStatus.DISQUALIFIED,
  LeadLifecycleStatus.RESTRICTED,
];

@Injectable()
export class ConversationsService {
  private readonly logger = new Logger(ConversationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gmailService: GmailService,
    private readonly aiOrchestrator: AIOrchestratorService,
    private readonly restrictionEngine: RestrictionEngineService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Extracts clean RFC 5322 email address from a header value (e.g. "John Doe <john@domain.com>" -> "john@domain.com").
   */
  extractEmailAddress(rawHeader?: string): string | null {
    if (!rawHeader) return null;
    const match = rawHeader.match(/<([^>]+)>/) || rawHeader.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
    return match ? match[1].toLowerCase().trim() : rawHeader.toLowerCase().trim();
  }

  /**
   * Lists conversations with support for filtering by leadId and assignment status.
   */
  async listConversations(query: ListConversationsQueryDto) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.leadId) {
      where.leadId = query.leadId;
    }
    if (query.status === 'UNASSIGNED') {
      where.leadId = null;
    } else if (query.status === 'ASSIGNED') {
      where.leadId = { not: null };
    }

    const [items, total] = await Promise.all([
      this.prisma.client.conversation.findMany({
        where,
        skip,
        take: limit,
        orderBy: { updatedAt: 'desc' },
        include: {
          lead: {
            include: {
              company: true,
              primaryContact: true,
            },
          },
          messages: {
            orderBy: { sentAt: 'asc' },
          },
        },
      }),
      this.prisma.client.conversation.count({ where }),
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
   * Retrieves a single conversation by ID.
   */
  async getConversationById(id: string): Promise<Conversation> {
    const conv = await this.prisma.client.conversation.findUnique({
      where: { id },
      include: {
        lead: {
          include: {
            company: true,
            primaryContact: true,
            research: { orderBy: { createdAt: 'desc' }, take: 1 },
          },
        },
        messages: {
          orderBy: { sentAt: 'asc' },
          include: {
            aiActions: { orderBy: { createdAt: 'desc' } },
          },
        },
      },
    });

    if (!conv) {
      throw new NotFoundException(`Conversation with ID '${id}' not found.`);
    }

    return conv;
  }

  /**
   * Syncs messages from the connected Gmail mailbox.
   * Idempotent: Skips messages whose gmailMessageId is already stored in the DB.
   */
  async syncGmailInbox(dto: SyncGmailQueryDto): Promise<SyncGmailResult> {
    this.logger.log(`Initiating manual Gmail sync with query: '${dto.query || 'ALL'}' (max: ${dto.maxResults || 50})`);

    const rawMessageList = await this.gmailService.listMessages(dto.query, dto.maxResults || 50);
    this.logger.log(`Found ${rawMessageList.length} total messages in Gmail response.`);

    let newIngestedCount = 0;
    let skippedDuplicatesCount = 0;
    const ingestedDetails: IngestedMessageResult[] = [];

    for (const item of rawMessageList) {
      const existingMessage = await this.prisma.client.message.findUnique({
        where: { gmailMessageId: item.id },
      });

      if (existingMessage) {
        skippedDuplicatesCount++;
        continue;
      }

      // Fetch full message metadata from Gmail
      const fullMsg = await this.gmailService.getMessage(item.id);
      const result = await this.ingestSingleInboundMessage(fullMsg);
      ingestedDetails.push(result);
      newIngestedCount++;
    }

    return {
      messagesFound: rawMessageList.length,
      newMessagesIngested: newIngestedCount,
      skippedDuplicates: skippedDuplicatesCount,
      details: ingestedDetails,
    };
  }

  /**
   * Ingests a single message:
   * 1. Resolves sender email and checks matching Contact & Open Leads.
   * 2. Auto-attaches to Lead IF EXACTLY ONE open lead matches. Otherwise leaves UNASSIGNED.
   * 3. Creates or maps 1:1 Conversation with gmailThreadId.
   * 4. Persists Message record.
   * 5. If attached to Lead: runs AI analyzeReply() + stores structured result.
   * 6. Re-evaluates RestrictionEngine against new inbound content.
   * 7. Progresses Lead lifecycle conservatively (unless blocked at RESTRICTED).
   */
  async ingestSingleInboundMessage(msg: GmailMessageMetadata): Promise<IngestedMessageResult> {
    const senderEmail = this.extractEmailAddress(msg.from) || 'unknown@domain.com';
    const recipientEmail = this.extractEmailAddress(msg.to) || 'system@enterprise.com';
    const threadId = msg.threadId || msg.id;
    const bodyContent = (msg.bodyText || msg.snippet || '').trim();

    this.logger.log(`Processing inbound message ${msg.id} from sender: ${senderEmail}`);

    // Step 2: Lead Matching Logic
    let matchedLeadId: string | null = null;
    let assignmentStatus: 'ASSIGNED' | 'NEEDS_HUMAN_ASSIGNMENT' = 'NEEDS_HUMAN_ASSIGNMENT';
    let matchedLead: any = null;

    // Check if conversation for this thread already exists and has a lead attached
    const existingConversation = await this.prisma.client.conversation.findUnique({
      where: { gmailThreadId: threadId },
      include: {
        lead: {
          include: {
            company: true,
            primaryContact: true,
            research: { orderBy: { createdAt: 'desc' }, take: 1 },
          },
        },
      },
    });

    if (existingConversation?.leadId) {
      matchedLeadId = existingConversation.leadId;
      matchedLead = existingConversation.lead;
      assignmentStatus = 'ASSIGNED';
    } else {
      // Find matching Contact by email
      const matchingContact = await this.prisma.client.contact.findUnique({
        where: { email: senderEmail },
        include: {
          leads: {
            where: {
              status: { in: OPEN_LEAD_STATUSES },
            },
            include: {
              company: true,
              primaryContact: true,
              research: { orderBy: { createdAt: 'desc' }, take: 1 },
            },
          },
        },
      });

      const openLeads = matchingContact?.leads || [];

      if (openLeads.length === 1) {
        matchedLead = openLeads[0];
        matchedLeadId = matchedLead.id;
        assignmentStatus = 'ASSIGNED';
        this.logger.log(`Sender '${senderEmail}' matched EXACTLY ONE open Lead '${matchedLeadId}'. Auto-attaching.`);
      } else if (openLeads.length === 0) {
        matchedLeadId = null;
        assignmentStatus = 'NEEDS_HUMAN_ASSIGNMENT';
        this.logger.warn(`Sender '${senderEmail}' matched 0 open leads. Conversation created in UNASSIGNED state.`);
      } else {
        matchedLeadId = null;
        assignmentStatus = 'NEEDS_HUMAN_ASSIGNMENT';
        this.logger.warn(`Sender '${senderEmail}' matched MULTIPLE (${openLeads.length}) open leads. Conversation created in UNASSIGNED state.`);
      }
    }

    // Step 2b: Create or Upsert Conversation (1:1 with gmailThreadId)
    const conversation = await this.prisma.client.conversation.upsert({
      where: { gmailThreadId: threadId },
      update: {
        subject: msg.subject || undefined,
        lastMessageAt: msg.date ? new Date(msg.date) : new Date(),
        leadId: existingConversation?.leadId ? undefined : matchedLeadId,
        metadata: {
          ...(existingConversation?.metadata as any || {}),
          senderEmail,
          assignmentStatus,
          lastSyncAt: new Date().toISOString(),
        },
      },
      create: {
        gmailThreadId: threadId,
        subject: msg.subject || 'No Subject',
        channel: 'EMAIL',
        leadId: matchedLeadId,
        lastMessageAt: msg.date ? new Date(msg.date) : new Date(),
        metadata: {
          senderEmail,
          assignmentStatus,
          firstSyncedAt: new Date().toISOString(),
        },
      },
    });

    // Step 2c: Store Message record (with concurrent duplicate race protection)
    let message: Message;
    try {
      message = await this.prisma.client.message.create({
        data: {
          conversationId: conversation.id,
          gmailMessageId: msg.id,
          direction: MessageDirection.INBOUND,
          sender: msg.from || senderEmail,
          recipient: msg.to || recipientEmail,
          subject: msg.subject || null,
          bodyText: bodyContent,
          bodyHtml: msg.bodyHtml || null,
          sentAt: msg.date ? new Date(msg.date) : new Date(),
          metadata: {
            snippet: msg.snippet,
            headers: (msg.headers as any),
          },
        },
      });
    } catch (createErr: any) {
      if (createErr.code === 'P2002' || createErr.message?.includes('Unique constraint')) {
        this.logger.warn(`[CONCURRENT_SYNC_SKIPPED] Message '${msg.id}' was concurrently ingested by another sync execution. Skipping duplicate.`);
        const existing = await this.prisma.client.message.findUnique({
          where: { gmailMessageId: msg.id },
        });
        return {
          messageId: existing?.id || 'duplicate-concurrent',
          gmailMessageId: msg.id,
          conversationId: conversation.id,
          leadId: matchedLeadId,
          assignmentStatus,
          aiAnalysisPerformed: false,
          restrictionResult: undefined,
          leadStatusUpdated: undefined,
        };
      }
      throw createErr;
    }

    // Step 3: AI Reply Analysis & Policy Evaluation (Only for Lead-attached conversations)
    let aiAnalysisPerformed = false;
    let restrictionResult: string | undefined = undefined;
    let leadStatusUpdated: string | undefined = undefined;

    if (matchedLeadId && matchedLead) {
      // Step 3a: Check Lead AI Control State
      const aiControlState = matchedLead.aiControlState || AIControlState.AI_ACTIVE;

      if (aiControlState !== AIControlState.AI_ACTIVE) {
        this.logger.warn(
          `[AI_CONTROL_SUPPRESSED] Lead '${matchedLead.id}' is currently in state '${aiControlState}'. Inbound message ${msg.id} ingested into DB, but AI reply analysis, restriction re-checking, and lifecycle progression are strictly SKIPPED.`,
        );
        return {
          messageId: message.id,
          gmailMessageId: msg.id,
          conversationId: conversation.id,
          leadId: matchedLeadId,
          assignmentStatus,
          aiAnalysisPerformed: false,
          restrictionResult: undefined,
          leadStatusUpdated: undefined,
        };
      }

      // Build layered context
      const companySummary = matchedLead.research?.[0]?.companySummary || matchedLead.company?.industry || 'N/A';
      const threadSummary = `Company: ${matchedLead.company.name}. Research Summary: ${companySummary}`;

      try {
        const aiResponse = await this.aiOrchestrator.analyzeReply(
          {
            messageBody: bodyContent,
            emailSubject: msg.subject,
            previousThreadSummary: threadSummary,
          },
          {
            leadId: matchedLead.id,
            conversationId: conversation.id,
            messageId: message.id,
          },
        );

        aiAnalysisPerformed = true;
        const analysisData = aiResponse.data;

        // Store analysis result on Message metadata
        await this.prisma.client.message.update({
          where: { id: message.id },
          data: {
            metadata: {
              ...(message.metadata as any || {}),
              aiReplyAnalysis: analysisData,
              aiActionId: aiResponse.metadata.actionId,
            },
          },
        });

        // Step 3b: If AI analysis flags requires_human / requiresHumanIntervention, create HumanReview record
        const requiresHuman =
          (analysisData as any)?.requires_human === true ||
          analysisData?.requiresHumanIntervention === true;

        if (requiresHuman) {
          const existingPendingReview = await this.prisma.client.humanReview.findFirst({
            where: {
              leadId: matchedLead.id,
              triggerSource: HumanReviewTriggerSource.AI_REPLY_FLAG,
              status: HumanReviewStatus.PENDING,
            },
          });

          if (!existingPendingReview) {
            const reviewSummary =
              (analysisData as any)?.summary ||
              analysisData?.recommendedNextAction ||
              'Inbound reply flagged for human review by AI analysis.';

            const humanReview = await this.prisma.client.humanReview.create({
              data: {
                leadId: matchedLead.id,
                conversationId: conversation.id,
                messageId: message.id,
                status: HumanReviewStatus.PENDING,
                triggerSource: HumanReviewTriggerSource.AI_REPLY_FLAG,
                triggerReason: reviewSummary,
                reviewNotes: `Intent: ${analysisData.intent}, Sentiment: ${analysisData.sentiment}`,
              },
            });

            this.logger.log(`Created HumanReview '${humanReview.id}' for AI-flagged reply on Lead '${matchedLead.id}'.`);

            await this.auditService.log({
              actorType: 'AI',
              action: 'HUMAN_REVIEW_CREATED',
              entityType: 'HUMAN_REVIEW',
              entityId: humanReview.id,
              newState: {
                status: HumanReviewStatus.PENDING,
                triggerSource: HumanReviewTriggerSource.AI_REPLY_FLAG,
                leadId: matchedLead.id,
                messageId: message.id,
              },
              metadata: {
                triggerReason: humanReview.triggerReason,
                analysisData,
              },
            });

            // Notify: ACTION_REQUIRED HumanReview created for AI reply flag
            await this.notificationsService.create({
              priority: NotificationPriority.ACTION_REQUIRED,
              title: 'Inbound Reply Flagged - Human Review Required',
              message: `Inbound reply from '${senderEmail}' on Lead '${matchedLead.id}' requires human attention: ${reviewSummary}`,
              entityType: 'HUMAN_REVIEW',
              entityId: humanReview.id,
              userId: matchedLead.assignedUserId,
              metadata: {
                leadId: matchedLead.id,
                humanReviewId: humanReview.id,
                conversationId: conversation.id,
                messageId: message.id,
              },
            });
          } else {
            this.logger.log(`Pending HumanReview '${existingPendingReview.id}' already exists for Lead '${matchedLead.id}'. Skipping duplicate creation.`);
          }
        }

        // Notify: IMPORTANT Client replied
        await this.notificationsService.create({
          priority: NotificationPriority.IMPORTANT,
          title: 'Client Replied',
          message: `New inbound reply received from '${senderEmail}' for Lead '${matchedLead.company?.name || matchedLead.id}'.`,
          entityType: 'CONVERSATION',
          entityId: conversation.id,
          userId: matchedLead.assignedUserId,
          metadata: {
            conversationId: conversation.id,
            leadId: matchedLead.id,
            messageId: message.id,
            sender: senderEmail,
            intent: analysisData?.intent,
          },
        });

        // Step 4: Restriction Re-Checking on Inbound Content
        const restrictionCheck = await this.restrictionEngine.evaluate({
          entityType: RestrictionEntityType.LEAD,
          leadId: matchedLead.id,
          companyId: matchedLead.companyId,
          contactId: matchedLead.primaryContactId || undefined,
          sourceTrigger: 'conversation',
          textCorpus: `Inbound Message Subject: ${msg.subject || ''}\nBody: ${bodyContent}\nCompany: ${matchedLead.company.name}`,
          notes: `Triggered by inbound message ${msg.id} in conversation ${conversation.id}`,
        });

        restrictionResult = restrictionCheck.result;

        // Step 5: Lead Lifecycle Progression from Reply Analysis
        // Re-fetch lead to check if restriction engine just blocked it
        const currentLead = await this.prisma.client.lead.findUnique({
          where: { id: matchedLead.id },
          select: { id: true, status: true },
        });

        if (currentLead && currentLead.status !== LeadLifecycleStatus.RESTRICTED) {
          const nextStatus = this.computeNextLifecycleStatus(currentLead.status, analysisData);
          if (nextStatus && nextStatus !== currentLead.status) {
            await this.prisma.client.lead.update({
              where: { id: currentLead.id },
              data: {
                status: nextStatus,
                metadata: {
                  ...(matchedLead.metadata as any || {}),
                  lastReplyIntent: analysisData.intent,
                  lastReplySentiment: analysisData.sentiment,
                  lastStageTransition: `From ${currentLead.status} to ${nextStatus} via AI reply analysis`,
                  transitionedAt: new Date().toISOString(),
                },
              },
            });
            leadStatusUpdated = nextStatus;
            this.logger.log(`Lead '${currentLead.id}' progressed from '${currentLead.status}' to '${nextStatus}' based on intent '${analysisData.intent}'.`);
          }
        } else {
          this.logger.warn(`Lead '${matchedLead.id}' is RESTRICTED (or blocked). Reply-driven progression strictly skipped.`);
        }
      } catch (err: any) {
        this.logger.error(`Error during AI reply analysis/restriction re-check for message ${msg.id}: ${err.message}`);
      }
    } else {
      this.logger.log(`Message ${msg.id} stored for unassigned conversation ${conversation.id}. AI reply analysis deferred until lead assignment.`);
    }

    return {
      messageId: message.id,
      gmailMessageId: msg.id,
      conversationId: conversation.id,
      leadId: matchedLeadId,
      assignmentStatus,
      aiAnalysisPerformed,
      restrictionResult,
      leadStatusUpdated,
    };
  }

  /**
   * Conservative, explicit lifecycle transition logic:
   * - CONTACTED / COLD_LEAD + Inbound Reply -> RESPONDED
   * - If intent is INTERESTED / MORE_INFO_REQUESTED -> INTERESTED
   * - If intent is NOT_INTERESTED / UNSUBSCRIBE -> LOST
   * - Never alters RESTRICTED leads.
   */
  computeNextLifecycleStatus(currentStatus: LeadLifecycleStatus, analysis: any): LeadLifecycleStatus | null {
    // Invariant: Never unblock RESTRICTED leads
    if (currentStatus === LeadLifecycleStatus.RESTRICTED) {
      return null;
    }

    if (analysis.intent === 'NOT_INTERESTED' || analysis.intent === 'UNSUBSCRIBE') {
      return LeadLifecycleStatus.LOST;
    }

    if (analysis.intent === 'INTERESTED' || (analysis.intent === 'MORE_INFO_REQUESTED' && analysis.sentiment === 'POSITIVE')) {
      return LeadLifecycleStatus.INTERESTED;
    }

    if (currentStatus === LeadLifecycleStatus.CONTACTED || currentStatus === LeadLifecycleStatus.COLD_LEAD) {
      return LeadLifecycleStatus.RESPONDED;
    }

    return null;
  }
}
