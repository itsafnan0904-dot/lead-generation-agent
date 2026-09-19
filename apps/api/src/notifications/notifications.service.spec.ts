import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationPriority, UserRole } from '@ai-sales-agent/database';
import { NotFoundException } from '@nestjs/common';

describe('NotificationsService and NotificationsController', () => {
  let service: NotificationsService;
  let controller: NotificationsController;
  let prisma: any;

  const mockAdminUser = {
    id: 'user-admin-1',
    name: 'Admin User',
    email: 'admin@test.com',
    role: UserRole.ADMIN,
    isActive: true,
  };

  const mockSalesRepUser = {
    id: 'user-sales-1',
    name: 'Sales Rep',
    email: 'rep@test.com',
    role: UserRole.SALES_REP,
    isActive: true,
  };

  const mockNotification = {
    id: 'notif-1',
    userId: 'user-sales-1',
    priority: NotificationPriority.IMPORTANT,
    title: 'Client Replied',
    message: 'New inbound reply received',
    entityType: 'CONVERSATION',
    entityId: 'conv-123',
    isRead: false,
    readAt: null,
    metadata: { key: 'val' },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    prisma = {
      client: {
        user: {
          findMany: jest.fn(),
        },
        notification: {
          create: jest.fn(),
          findMany: jest.fn(),
          count: jest.fn(),
          findUnique: jest.fn(),
          update: jest.fn(),
        },
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [
        NotificationsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
    controller = module.get<NotificationsController>(NotificationsController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create()', () => {
    it('creates a single notification for a specific target userId', async () => {
      prisma.client.notification.create.mockResolvedValueOnce({
        ...mockNotification,
        userId: 'user-sales-1',
      });

      const res = await service.create({
        priority: NotificationPriority.INFO,
        title: 'Research Completed',
        message: 'Research on Acme Corp finished',
        userId: 'user-sales-1',
        entityType: 'COMPANY',
        entityId: 'comp-1',
      });

      expect(prisma.client.notification.create).toHaveBeenCalledTimes(1);
      expect(prisma.client.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-sales-1',
          priority: NotificationPriority.INFO,
          title: 'Research Completed',
          entityType: 'COMPANY',
          entityId: 'comp-1',
          isRead: false,
        }),
      });
      expect(res).toHaveLength(1);
    });

    it('fans out to all active ADMIN users when userId is omitted', async () => {
      prisma.client.user.findMany.mockResolvedValueOnce([
        { id: 'admin-1' },
        { id: 'admin-2' },
      ]);
      prisma.client.notification.create
        .mockResolvedValueOnce({ ...mockNotification, id: 'n1', userId: 'admin-1' })
        .mockResolvedValueOnce({ ...mockNotification, id: 'n2', userId: 'admin-2' });

      const res = await service.create({
        priority: NotificationPriority.ACTION_REQUIRED,
        title: 'Compliance Restriction Block',
        message: 'Lead blocked',
        entityType: 'HUMAN_REVIEW',
        entityId: 'hr-1',
      });

      expect(prisma.client.user.findMany).toHaveBeenCalledWith({
        where: { role: UserRole.ADMIN, isActive: true },
        select: { id: true },
      });
      expect(prisma.client.notification.create).toHaveBeenCalledTimes(2);
      expect(res).toHaveLength(2);
    });

    it('is resilient and catches internal errors without throwing', async () => {
      prisma.client.notification.create.mockRejectedValueOnce(new Error('DB failure'));

      const res = await service.create({
        priority: NotificationPriority.INFO,
        title: 'Test',
        message: 'Test message',
        userId: 'user-1',
      });

      expect(res).toBeNull();
    });
  });

  describe('listNotifications()', () => {
    it('lists notifications filtered by userId, priority, and isRead', async () => {
      prisma.client.notification.findMany.mockResolvedValueOnce([mockNotification]);
      prisma.client.notification.count
        .mockResolvedValueOnce(1) // total
        .mockResolvedValueOnce(1); // unreadCount

      const res = await service.listNotifications('user-sales-1', {
        priority: NotificationPriority.IMPORTANT,
        isRead: false,
        page: 1,
        limit: 10,
      });

      expect(prisma.client.notification.findMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-sales-1',
          priority: NotificationPriority.IMPORTANT,
          isRead: false,
        },
        skip: 0,
        take: 10,
        orderBy: { createdAt: 'desc' },
      });
      expect(res.items).toEqual([mockNotification]);
      expect(res.total).toBe(1);
      expect(res.unreadCount).toBe(1);
      expect(res.totalPages).toBe(1);
    });
  });

  describe('getNotificationById()', () => {
    it('returns the notification if it belongs to the user', async () => {
      prisma.client.notification.findUnique.mockResolvedValueOnce(mockNotification);

      const res = await service.getNotificationById('user-sales-1', 'notif-1');
      expect(res).toEqual(mockNotification);
    });

    it('throws NotFoundException if notification does not exist', async () => {
      prisma.client.notification.findUnique.mockResolvedValueOnce(null);

      await expect(service.getNotificationById('user-sales-1', 'nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFoundException if notification belongs to another user', async () => {
      prisma.client.notification.findUnique.mockResolvedValueOnce({
        ...mockNotification,
        userId: 'other-user',
      });

      await expect(service.getNotificationById('user-sales-1', 'notif-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('markAsRead()', () => {
    it('marks an unread notification as read', async () => {
      prisma.client.notification.findUnique.mockResolvedValueOnce(mockNotification);
      prisma.client.notification.update.mockResolvedValueOnce({
        ...mockNotification,
        isRead: true,
        readAt: new Date(),
      });

      const res = await service.markAsRead('user-sales-1', 'notif-1');
      expect(res.isRead).toBe(true);
      expect(prisma.client.notification.update).toHaveBeenCalledWith({
        where: { id: 'notif-1' },
        data: {
          isRead: true,
          readAt: expect.any(Date),
        },
      });
    });

    it('returns the already read notification without re-updating', async () => {
      const alreadyRead = { ...mockNotification, isRead: true, readAt: new Date() };
      prisma.client.notification.findUnique.mockResolvedValueOnce(alreadyRead);

      const res = await service.markAsRead('user-sales-1', 'notif-1');
      expect(res.isRead).toBe(true);
      expect(prisma.client.notification.update).not.toHaveBeenCalled();
    });

    it('rejects attempt to mark another user notification as read', async () => {
      prisma.client.notification.findUnique.mockResolvedValueOnce({
        ...mockNotification,
        userId: 'other-user',
      });

      await expect(service.markAsRead('user-sales-1', 'notif-1')).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.client.notification.update).not.toHaveBeenCalled();
    });
  });

  describe('NotificationsController', () => {
    it('GET /notifications delegates to service.listNotifications', async () => {
      prisma.client.notification.findMany.mockResolvedValueOnce([mockNotification]);
      prisma.client.notification.count.mockResolvedValueOnce(1).mockResolvedValueOnce(1);

      const req = { user: { id: 'user-sales-1' } };
      const res = await controller.listNotifications(req, { page: 1, limit: 10 });
      expect(res.items).toHaveLength(1);
    });

    it('GET /notifications/:id delegates to service.getNotificationById', async () => {
      prisma.client.notification.findUnique.mockResolvedValueOnce(mockNotification);

      const req = { user: { id: 'user-sales-1' } };
      const res = await controller.getNotificationById(req, 'notif-1');
      expect(res.id).toBe('notif-1');
    });

    it('PATCH /notifications/:id/read delegates to service.markAsRead', async () => {
      prisma.client.notification.findUnique.mockResolvedValueOnce(mockNotification);
      prisma.client.notification.update.mockResolvedValueOnce({
        ...mockNotification,
        isRead: true,
        readAt: new Date(),
      });

      const req = { user: { id: 'user-sales-1' } };
      const res = await controller.markAsRead(req, 'notif-1');
      expect(res.isRead).toBe(true);
    });
  });
});
