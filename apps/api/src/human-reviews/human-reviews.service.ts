import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ResolveHumanReviewDto, ListHumanReviewsQueryDto } from './dto/human-review.dto';
import {
  HumanReview,
  HumanReviewStatus,
  HumanReviewTriggerSource,
  LeadLifecycleStatus,
  NotificationPriority,
} from '@ai-sales-agent/database';

@Injectable()
export class HumanReviewsService {
  private readonly logger = new Logger(HumanReviewsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Lists HumanReview records with optional filters.
   */
  async listReviews(query: ListHumanReviewsQueryDto): Promise<{
    items: HumanReview[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.status) where.status = query.status;
    if (query.triggerSource) where.triggerSource = query.triggerSource;
    if (query.leadId) where.leadId = query.leadId;

    const [items, total] = await Promise.all([
      this.prisma.client.humanReview.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          lead: {
            include: {
              company: true,
              primaryContact: true,
            },
          },
          conversation: true,
          message: true,
          restrictionCheck: true,
          assignedTo: { select: { id: true, name: true, email: true, role: true } },
          resolvedByUser: { select: { id: true, name: true, email: true, role: true } },
        },
      }),
      this.prisma.client.humanReview.count({ where }),
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
   * Retrieves a single HumanReview by ID.
   */
  async getReviewById(id: string): Promise<HumanReview> {
    const review = await this.prisma.client.humanReview.findUnique({
      where: { id },
      include: {
        lead: {
          include: {
            company: true,
            primaryContact: true,
            research: { orderBy: { createdAt: 'desc' }, take: 1 },
          },
        },
        conversation: {
          include: {
            messages: { orderBy: { sentAt: 'asc' }, take: 10 },
          },
        },
        message: true,
        restrictionCheck: true,
        assignedTo: { select: { id: true, name: true, email: true, role: true } },
        resolvedByUser: { select: { id: true, name: true, email: true, role: true } },
      },
    });

    if (!review) {
      throw new NotFoundException(`HumanReview with ID '${id}' not found.`);
    }

    return review;
  }

  /**
   * Resolves a HumanReview (APPROVED or REJECTED) with mandatory justification.
   * Locked requirement: Gated by RolesGuard(ADMIN).
   */
  async resolveReview(
    id: string,
    dto: ResolveHumanReviewDto,
    adminUserId: string,
  ): Promise<HumanReview> {
    const trimmedJustification = (dto.justification || '').trim();
    if (!trimmedJustification || trimmedJustification.length < 10) {
      throw new BadRequestException(
        'A meaningful written justification of at least 10 non-whitespace characters is required to resolve a human review.',
      );
    }

    const review = await this.prisma.client.humanReview.findUnique({
      where: { id },
      include: {
        lead: true,
      },
    });

    if (!review) {
      throw new NotFoundException(`HumanReview with ID '${id}' not found.`);
    }

    if (review.status !== HumanReviewStatus.PENDING && review.status !== HumanReviewStatus.IN_REVIEW) {
      throw new BadRequestException(
        `Cannot resolve HumanReview '${id}': Review is already resolved with status '${review.status}'. Double-resolution prevented.`,
      );
    }

    const resolvedAt = new Date();
    const decisionStatus = dto.decision;

    // Execute state resolution within transaction
    const updatedReview = await this.prisma.client.$transaction(async (tx) => {
      // 1. Update HumanReview record
      const updated = await tx.humanReview.update({
        where: { id },
        data: {
          status: decisionStatus,
          resolvedByUserId: adminUserId,
          resolvedAt,
          resolutionJustification: trimmedJustification,
        },
        include: {
          lead: true,
          resolvedByUser: { select: { id: true, name: true, email: true, role: true } },
        },
      });

      // 2. Lead lifecycle resolution logic
      if (review.leadId && review.lead) {
        if (decisionStatus === HumanReviewStatus.APPROVED) {
          // Restore Lead status
          let targetStatus: LeadLifecycleStatus = LeadLifecycleStatus.COLD_LEAD;
          const leadMeta = (review.lead.metadata as any) || {};

          if (leadMeta.previousStatus && Object.values(LeadLifecycleStatus).includes(leadMeta.previousStatus)) {
            // Restore Prompt 10 previousStatus if valid and not RESTRICTED
            targetStatus = leadMeta.previousStatus !== LeadLifecycleStatus.RESTRICTED
              ? leadMeta.previousStatus
              : LeadLifecycleStatus.COLD_LEAD;
          }

          await tx.lead.update({
            where: { id: review.leadId },
            data: {
              status: targetStatus,
              metadata: {
                ...leadMeta,
                restrictionBlocked: false,
                resolvedReviewId: id,
                resolvedBy: adminUserId,
                resolvedAt: resolvedAt.toISOString(),
                restoredToStatus: targetStatus,
              },
            },
          });

          this.logger.log(
            `Lead '${review.leadId}' restored from RESTRICTED to '${targetStatus}' upon APPROVED HumanReview '${id}'.`,
          );
        } else if (decisionStatus === HumanReviewStatus.REJECTED) {
          // Mark Lead as DISQUALIFIED to permanently solidify compliance block
          const leadMeta = (review.lead.metadata as any) || {};
          await tx.lead.update({
            where: { id: review.leadId },
            data: {
              status: LeadLifecycleStatus.DISQUALIFIED,
              metadata: {
                ...leadMeta,
                restrictionBlocked: true,
                rejectedReviewId: id,
                rejectedBy: adminUserId,
                rejectedAt: resolvedAt.toISOString(),
                disqualificationReason: trimmedJustification,
              },
            },
          });

          this.logger.log(
            `Lead '${review.leadId}' permanently DISQUALIFIED upon REJECTED HumanReview '${id}'.`,
          );
        }
      }

      return updated;
    });

    // Record AuditEvent
    await this.auditService.log({
      actorType: 'USER',
      actorId: adminUserId,
      userId: adminUserId,
      action: `HUMAN_REVIEW_${decisionStatus}`,
      entityType: 'HUMAN_REVIEW',
      entityId: id,
      oldState: { status: review.status },
      newState: { status: decisionStatus, resolvedByUserId: adminUserId, resolvedAt },
      metadata: {
        leadId: review.leadId,
        triggerSource: review.triggerSource,
        justification: trimmedJustification,
      },
    });

    // Notify: IMPORTANT Restriction check cleared / Human review approved
    if (decisionStatus === HumanReviewStatus.APPROVED && review.leadId) {
      await this.notificationsService.create({
        priority: NotificationPriority.IMPORTANT,
        title: 'Restriction Cleared - Lead Restored',
        message: `Human review '${id}' was APPROVED. Restriction cleared for Lead '${review.leadId}'.`,
        entityType: 'LEAD',
        entityId: review.leadId,
        userId: review.lead?.assignedUserId,
        metadata: {
          humanReviewId: id,
          leadId: review.leadId,
          resolvedByUserId: adminUserId,
          justification: trimmedJustification,
        },
      });
    }

    return updatedReview;
  }
}
