import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuditService } from './audit.service';
import { AuditController } from './audit.controller';
import { PrismaService } from '../prisma/prisma.service';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '@ai-sales-agent/database';

describe('AuditService and AuditController', () => {
  let service: AuditService;
  let controller: AuditController;
  let rolesGuard: RolesGuard;
  let reflector: Reflector;
  let prisma: any;

  const mockAuditEvent = {
    id: 'audit-event-1',
    userId: 'user-admin-1',
    actorType: 'USER',
    actorId: 'user-admin-1',
    action: 'LEAD_AI_PAUSED',
    entityType: 'LEAD',
    entityId: 'lead-123',
    oldState: { aiControlState: 'AI_ACTIVE' },
    newState: { aiControlState: 'PAUSED' },
    metadata: { leadId: 'lead-123' },
    ipAddress: '127.0.0.1',
    userAgent: 'test-agent',
    createdAt: new Date('2026-09-05T12:00:00.000Z'),
    user: {
      id: 'user-admin-1',
      email: 'admin@enterprise.com',
      name: 'Admin User',
      role: UserRole.ADMIN,
    },
  };

  beforeEach(async () => {
    prisma = {
      client: {
        auditEvent: {
          create: jest.fn(),
          findMany: jest.fn(),
          count: jest.fn(),
        },
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuditController],
      providers: [
        AuditService,
        RolesGuard,
        Reflector,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<AuditService>(AuditService);
    controller = module.get<AuditController>(AuditController);
    rolesGuard = module.get<RolesGuard>(RolesGuard);
    reflector = module.get<Reflector>(Reflector);
  });

  describe('AuditService.listAuditEvents()', () => {
    it('returns paginated audit events with total and totalPages', async () => {
      prisma.client.auditEvent.findMany.mockResolvedValueOnce([mockAuditEvent]);
      prisma.client.auditEvent.count.mockResolvedValueOnce(1);

      const res = await service.listAuditEvents({ page: 1, limit: 10 });

      expect(res.items).toHaveLength(1);
      expect(res.total).toBe(1);
      expect(res.page).toBe(1);
      expect(res.limit).toBe(10);
      expect(res.totalPages).toBe(1);
      expect(prisma.client.auditEvent.findMany).toHaveBeenCalledWith({
        where: {},
        skip: 0,
        take: 10,
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
      });
    });

    it('filters by actorType, entityType, entityId, and action', async () => {
      prisma.client.auditEvent.findMany.mockResolvedValueOnce([mockAuditEvent]);
      prisma.client.auditEvent.count.mockResolvedValueOnce(1);

      const res = await service.listAuditEvents({
        actorType: 'USER',
        entityType: 'LEAD',
        entityId: 'lead-123',
        action: 'LEAD_AI_PAUSED',
        page: 2,
        limit: 5,
      });

      expect(res.items).toHaveLength(1);
      expect(prisma.client.auditEvent.findMany).toHaveBeenCalledWith({
        where: {
          actorType: 'USER',
          entityType: 'LEAD',
          entityId: 'lead-123',
          action: 'LEAD_AI_PAUSED',
        },
        skip: 5,
        take: 5,
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
      });
    });

    it('filters by date range (startDate and endDate)', async () => {
      prisma.client.auditEvent.findMany.mockResolvedValueOnce([mockAuditEvent]);
      prisma.client.auditEvent.count.mockResolvedValueOnce(1);

      const start = '2026-09-01T00:00:00.000Z';
      const end = '2026-09-05T23:59:59.999Z';

      await service.listAuditEvents({
        startDate: start,
        endDate: end,
      });

      expect(prisma.client.auditEvent.findMany).toHaveBeenCalledWith({
        where: {
          createdAt: {
            gte: new Date(start),
            lte: new Date(end),
          },
        },
        skip: 0,
        take: 20,
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
      });
    });
  });

  describe('AuditController and RolesGuard', () => {
    it('AuditController.listAuditEvents delegates to service.listAuditEvents', async () => {
      prisma.client.auditEvent.findMany.mockResolvedValueOnce([mockAuditEvent]);
      prisma.client.auditEvent.count.mockResolvedValueOnce(1);

      const res = await controller.listAuditEvents({ page: 1, limit: 10 });
      expect(res.items).toHaveLength(1);
      expect(res.items[0].id).toBe('audit-event-1');
    });

    it('allows access for ADMIN user via RolesGuard', () => {
      const mockContext = {
        getHandler: jest.fn(),
        getClass: jest.fn(),
        switchToHttp: () => ({
          getRequest: () => ({
            user: { id: 'admin-1', email: 'admin@enterprise.com', role: UserRole.ADMIN },
          }),
        }),
      } as unknown as ExecutionContext;

      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([UserRole.ADMIN]);

      const canActivate = rolesGuard.canActivate(mockContext);
      expect(canActivate).toBe(true);
    });

    it('rejects access with 403 Forbidden for non-ADMIN user via RolesGuard', () => {
      const mockContext = {
        getHandler: jest.fn(),
        getClass: jest.fn(),
        switchToHttp: () => ({
          getRequest: () => ({
            user: { id: 'rep-1', email: 'rep@enterprise.com', role: UserRole.SALES_REP },
          }),
        }),
      } as unknown as ExecutionContext;

      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([UserRole.ADMIN]);

      expect(() => rolesGuard.canActivate(mockContext)).toThrow(ForbiddenException);
    });

    it('rejects access with 403 Forbidden when user identity or role is missing in RolesGuard', () => {
      const mockContext = {
        getHandler: jest.fn(),
        getClass: jest.fn(),
        switchToHttp: () => ({
          getRequest: () => ({
            user: undefined,
          }),
        }),
      } as unknown as ExecutionContext;

      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([UserRole.ADMIN]);

      expect(() => rolesGuard.canActivate(mockContext)).toThrow(ForbiddenException);
    });
  });
});
