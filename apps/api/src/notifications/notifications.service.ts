import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Notification, NotificationPriority, UserRole } from '@ai-sales-agent/database';
import { CreateNotificationOptions, ListNotificationsQueryDto } from './dto/notification.dto';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Creates one or more Notification records.
   * If userId is provided, creates a notification for that specific user.
   * If userId is omitted or null, fans out to all active ADMIN users.
   * Resilient: Catches errors to ensure notification creation never crashes primary operations.
   */
  async create(options: CreateNotificationOptions): Promise<Notification[] | null> {
    const { priority, title, message, userId, entityType, entityId, metadata } = options;

    try {
      let targetUserIds: string[] = [];

      if (userId) {
        targetUserIds = [userId];
      } else {
        // Query active ADMIN users
        const adminUsers = await this.prisma.client.user.findMany({
          where: { role: UserRole.ADMIN, isActive: true },
          select: { id: true },
        });

        if (adminUsers.length > 0) {
          targetUserIds = adminUsers.map((u) => u.id);
        } else {
          // Fallback to any active user if no ADMIN exists
          const fallbackUsers = await this.prisma.client.user.findMany({
            where: { isActive: true },
            take: 1,
            select: { id: true },
          });
          targetUserIds = fallbackUsers.map((u) => u.id);
        }
      }

      if (targetUserIds.length === 0) {
        this.logger.warn(`No target users found for notification '${title}'. Skipping creation.`);
        return null;
      }

      const createdNotifications: Notification[] = [];

      for (const targetId of targetUserIds) {
        const notif = await this.prisma.client.notification.create({
          data: {
            userId: targetId,
            priority,
            title,
            message,
            entityType: entityType || null,
            entityId: entityId || null,
            isRead: false,
            metadata: (metadata as any) || undefined,
          },
        });
        createdNotifications.push(notif);
      }

      this.logger.log(
        `Created ${createdNotifications.length} notification(s) [${priority}] '${title}' for entity '${entityType}:${entityId}'.`,
      );

      return createdNotifications;
    } catch (err: any) {
      this.logger.error(
        `Failed to create notification for '${entityType}:${entityId}': ${err.message}`,
        err.stack,
      );
      return null;
    }
  }

  /**
   * Lists notifications for a specific user with pagination and optional filters.
   */
  async listNotifications(
    userId: string,
    query: ListNotificationsQueryDto,
  ): Promise<{
    items: Notification[];
    total: number;
    unreadCount: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = { userId };
    if (query.priority) where.priority = query.priority;
    if (query.isRead !== undefined) where.isRead = query.isRead;

    const [items, total, unreadCount] = await Promise.all([
      this.prisma.client.notification.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.client.notification.count({ where }),
      this.prisma.client.notification.count({ where: { userId, isRead: false } }),
    ]);

    return {
      items,
      total,
      unreadCount,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Retrieves a single notification by ID, ensuring it belongs to the requesting user.
   */
  async getNotificationById(userId: string, id: string): Promise<Notification> {
    const notification = await this.prisma.client.notification.findUnique({
      where: { id },
    });

    if (!notification || notification.userId !== userId) {
      throw new NotFoundException(`Notification with ID '${id}' not found.`);
    }

    return notification;
  }

  /**
   * Marks a notification as read for the requesting user.
   * Rejects if attempting to mark another user's notification.
   */
  async markAsRead(userId: string, id: string): Promise<Notification> {
    const notification = await this.prisma.client.notification.findUnique({
      where: { id },
    });

    if (!notification || notification.userId !== userId) {
      throw new NotFoundException(`Notification with ID '${id}' not found.`);
    }

    if (notification.isRead) {
      return notification;
    }

    return this.prisma.client.notification.update({
      where: { id },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
  }
}
