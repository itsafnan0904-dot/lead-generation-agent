import { Test, TestingModule } from '@nestjs/testing';
import { HumanReviewsService } from './human-reviews.service';
import { HumanReviewsController } from './human-reviews.controller';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  HumanReviewStatus,
  HumanReviewTriggerSource,
  LeadLifecycleStatus,
  UserRole,
} from '@ai-sales-agent/database';
import { BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Reflector } from '@nestjs/core';

describe('HumanReviewsModule', () => {
  let service: HumanReviewsService;
  let controller: HumanReviewsController;
  let prismaMock: any;
  let auditServiceMock: any;

  beforeEach(async () => {
    prismaMock = {
      client: {
        humanReview: {
          findMany: jest.fn(),
          count: jest.fn(),
          findUnique: jest.fn(),
          update: jest.fn(),
        },
        lead: {
          update: jest.fn(),
        },
        $transaction: jest.fn().mockImplementation((callback) => callback(prismaMock.client)),
      },
    };

    auditServiceMock = {
      log: jest.fn().mockResolvedValue({ id: 'audit-event-1' }),
    };

    const notificationsServiceMock = {
      create: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HumanReviewsController],
      providers: [
        HumanReviewsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: AuditService, useValue: auditServiceMock },
        { provide: NotificationsService, useValue: notificationsServiceMock },
        Reflector,
      ],
    }).compile();

    service = module.get<HumanReviewsService>(HumanReviewsService);
    controller = module.get<HumanReviewsController>(HumanReviewsController);
  });

  describe('Listing and Retrieval', () => {
    it('lists human reviews with pagination and status filters', async () => {
      const mockReviews = [
        { id: 'hr-1', status: HumanReviewStatus.PENDING, triggerReason: 'Restricted joists' },
      ];
      prismaMock.client.humanReview.findMany.mockResolvedValue(mockReviews);
      prismaMock.client.humanReview.count.mockResolvedValue(1);

      const result = await service.listReviews({ status: HumanReviewStatus.PENDING });
      expect(result.items.length).toBe(1);
      expect(result.total).toBe(1);
    });

    it('retrieves single human review by ID or throws NotFoundException', async () => {
      prismaMock.client.humanReview.findUnique.mockResolvedValue(null);
      await expect(service.getReviewById('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('Resolution Logic and Validation', () => {
    it('rejects resolution if justification is missing or under 10 characters', async () => {
      await expect(
        service.resolveReview(
          'hr-1',
          { decision: HumanReviewStatus.APPROVED, justification: 'Too short' },
          'admin-user-1',
        ),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.resolveReview(
          'hr-1',
          { decision: HumanReviewStatus.APPROVED, justification: '          ' },
          'admin-user-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects resolution if HumanReview is already resolved (double-resolution prevention)', async () => {
      prismaMock.client.humanReview.findUnique.mockResolvedValue({
        id: 'hr-1',
        status: HumanReviewStatus.APPROVED, // already resolved
      });

      await expect(
        service.resolveReview(
          'hr-1',
          {
            decision: HumanReviewStatus.APPROVED,
            justification: 'Valid length justification explaining clear compliance approval.',
          },
          'admin-user-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('APPROVED resolution restores Lead status to previousStatus and updates HumanReview metadata', async () => {
      const mockLead = {
        id: 'lead-1',
        status: LeadLifecycleStatus.RESTRICTED,
        metadata: {
          restrictionBlocked: true,
          previousStatus: LeadLifecycleStatus.QUALIFIED,
        },
      };

      const mockReview = {
        id: 'hr-1',
        leadId: 'lead-1',
        lead: mockLead,
        status: HumanReviewStatus.PENDING,
        triggerSource: HumanReviewTriggerSource.RESTRICTION_CHECK,
      };

      prismaMock.client.humanReview.findUnique.mockResolvedValue(mockReview);
      prismaMock.client.humanReview.update.mockResolvedValue({
        ...mockReview,
        status: HumanReviewStatus.APPROVED,
        resolvedByUserId: 'admin-user-1',
        resolutionJustification: 'Vendor clarified they only provide decorative metal panels, not OWSJ.',
      });

      const result = await service.resolveReview(
        'hr-1',
        {
          decision: HumanReviewStatus.APPROVED,
          justification: 'Vendor clarified they only provide decorative metal panels, not OWSJ.',
        },
        'admin-user-1',
      );

      expect(result.status).toBe(HumanReviewStatus.APPROVED);
      expect(prismaMock.client.lead.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'lead-1' },
          data: expect.objectContaining({
            status: LeadLifecycleStatus.QUALIFIED, // Restored to previousStatus
            metadata: expect.objectContaining({
              restrictionBlocked: false,
              restoredToStatus: LeadLifecycleStatus.QUALIFIED,
            }),
          }),
        }),
      );
      expect(auditServiceMock.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'HUMAN_REVIEW_APPROVED',
          entityType: 'HUMAN_REVIEW',
          entityId: 'hr-1',
        }),
      );
    });

    it('REJECTED resolution transitions Lead to DISQUALIFIED and records justification', async () => {
      const mockLead = {
        id: 'lead-2',
        status: LeadLifecycleStatus.RESTRICTED,
        metadata: { restrictionBlocked: true },
      };

      const mockReview = {
        id: 'hr-2',
        leadId: 'lead-2',
        lead: mockLead,
        status: HumanReviewStatus.PENDING,
        triggerSource: HumanReviewTriggerSource.RESTRICTION_CHECK,
      };

      prismaMock.client.humanReview.findUnique.mockResolvedValue(mockReview);
      prismaMock.client.humanReview.update.mockResolvedValue({
        ...mockReview,
        status: HumanReviewStatus.REJECTED,
        resolvedByUserId: 'admin-user-1',
        resolutionJustification: 'Confirmed prospect provides prohibited joists. Permanently restricted.',
      });

      const result = await service.resolveReview(
        'hr-2',
        {
          decision: HumanReviewStatus.REJECTED,
          justification: 'Confirmed prospect provides prohibited joists. Permanently restricted.',
        },
        'admin-user-1',
      );

      expect(result.status).toBe(HumanReviewStatus.REJECTED);
      expect(prismaMock.client.lead.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'lead-2' },
          data: expect.objectContaining({
            status: LeadLifecycleStatus.DISQUALIFIED,
          }),
        }),
      );
      expect(auditServiceMock.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'HUMAN_REVIEW_REJECTED',
          entityType: 'HUMAN_REVIEW',
          entityId: 'hr-2',
        }),
      );
    });
  });

  describe('RBAC RolesGuard Enforcement', () => {
    it('RolesGuard rejects non-ADMIN users with 403 Forbidden', () => {
      const reflector = new Reflector();
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([UserRole.ADMIN]);
      const guard = new RolesGuard(reflector);

      const contextMock: any = {
        getHandler: () => {},
        getClass: () => {},
        switchToHttp: () => ({
          getRequest: () => ({
            user: { id: 'rep-user', role: UserRole.SALES_REP },
          }),
        }),
      };

      expect(() => guard.canActivate(contextMock)).toThrow(ForbiddenException);
    });

    it('RolesGuard permits ADMIN users', () => {
      const reflector = new Reflector();
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([UserRole.ADMIN]);
      const guard = new RolesGuard(reflector);

      const contextMock: any = {
        getHandler: () => {},
        getClass: () => {},
        switchToHttp: () => ({
          getRequest: () => ({
            user: { id: 'admin-user', role: UserRole.ADMIN },
          }),
        }),
      };

      expect(guard.canActivate(contextMock)).toBe(true);
    });
  });
});
