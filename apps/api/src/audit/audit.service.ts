import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface LogAuditOptions {
  actorType: 'USER' | 'AI' | 'SYSTEM';
  actorId?: string | null;
  userId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  oldState?: Record<string, any> | null;
  newState?: Record<string, any> | null;
  metadata?: Record<string, any> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Records an audit event to the database.
   * Resilient: Catches and logs errors without bubbling exceptions that would break primary actions.
   */
  async log(options: LogAuditOptions): Promise<any> {
    const {
      actorType,
      actorId,
      userId,
      action,
      entityType,
      entityId,
      oldState,
      newState,
      metadata,
      ipAddress,
      userAgent,
    } = options;

    try {
      const resolvedUserId = userId || (actorType === 'USER' && actorId ? actorId : null);

      const auditEvent = await this.prisma.client.auditEvent.create({
        data: {
          actorType,
          actorId: actorId || null,
          userId: resolvedUserId,
          action,
          entityType,
          entityId: entityId || null,
          oldState: (oldState as any) || undefined,
          newState: (newState as any) || undefined,
          metadata: (metadata as any) || undefined,
          ipAddress: ipAddress || null,
          userAgent: userAgent || null,
        },
      });

      return auditEvent;
    } catch (err: any) {
      this.logger.error(
        `Failed to record AuditEvent for action '${action}' on '${entityType}:${entityId}': ${err.message}`,
        err.stack,
      );
      // Non-blocking resilience per Prompt 14 design
      return null;
    }
  }

  /**
   * Queries and lists AuditEvent records with pagination and multi-field filtering.
   * Sorts by timestamp (createdAt) descending by default.
   */
  async listAuditEvents(query: {
    actorType?: 'USER' | 'AI' | 'SYSTEM';
    entityType?: string;
    entityId?: string;
    action?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (query.actorType) {
      where.actorType = query.actorType;
    }
    if (query.entityType) {
      where.entityType = query.entityType;
    }
    if (query.entityId) {
      where.entityId = query.entityId;
    }
    if (query.action) {
      where.action = query.action;
    }

    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) {
        where.createdAt.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        where.createdAt.lte = new Date(query.endDate);
      }
    }

    const [items, total] = await Promise.all([
      this.prisma.client.auditEvent.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              role: true,
            },
          },
        },
      }),
      this.prisma.client.auditEvent.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}

