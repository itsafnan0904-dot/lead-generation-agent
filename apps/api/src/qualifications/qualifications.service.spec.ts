import { NotFoundException } from '@nestjs/common';
import { QualificationsService } from './qualifications.service';

describe('QualificationsService & Placeholder Restriction State', () => {
  let service: QualificationsService;
  let mockPrismaClient: any;

  const mockLead = {
    id: 'lead-uuid-1',
    companyId: 'comp-uuid-1',
  };

  const mockQualification = {
    id: 'qual-uuid-101',
    leadId: 'lead-uuid-1',
    budgetFit: true,
    authorityFit: true,
    needFit: true,
    timelineFit: false,
    technicalFit: true,
    fitSummary: 'Strong budget and authority, but Q4 timeline is constrained.',
    dealBlockers: { blocker: 'Legacy ERP integration required' },
    answers: { budget: '$75k', seats: 20 },
    qualifiedBy: 'MANUAL',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    mockPrismaClient = {
      lead: {
        findUnique: jest.fn(),
      },
      qualification: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };

    const mockPrismaService = { client: mockPrismaClient } as any;

    service = new QualificationsService(mockPrismaService);
  });

  describe('Qualification CRUD & Restriction Placeholder', () => {
    it('creates a Qualification record scoped to a Lead with explicit PENDING restriction status', async () => {
      mockPrismaClient.lead.findUnique.mockResolvedValue(mockLead);
      mockPrismaClient.qualification.create.mockResolvedValue(mockQualification);

      const result = await service.createQualification('lead-uuid-1', {
        budgetFit: true,
        authorityFit: true,
        needFit: true,
        timelineFit: false,
        technicalFit: true,
        fitSummary: 'Strong budget and authority, but Q4 timeline is constrained.',
      });

      expect(result.id).toBe('qual-uuid-101');
      expect(result.leadId).toBe('lead-uuid-1');
      expect(result.budgetFit).toBe(true);
      expect(result.restrictionEvaluationStatus).toBe('PENDING_RESTRICTION_ENGINE (Prompt 10)');
      expect(mockPrismaClient.qualification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          leadId: 'lead-uuid-1',
          budgetFit: true,
          timelineFit: false,
        }),
      });
    });

    it('rejects qualification creation with 404 NotFound if lead does not exist', async () => {
      mockPrismaClient.lead.findUnique.mockResolvedValue(null);

      await expect(
        service.createQualification('nonexistent-lead', { budgetFit: true }),
      ).rejects.toThrow(NotFoundException);
    });

    it('lists multiple qualification passes for a lead with restriction placeholders intact', async () => {
      mockPrismaClient.lead.findUnique.mockResolvedValue(mockLead);
      mockPrismaClient.qualification.findMany.mockResolvedValue([
        mockQualification,
        { ...mockQualification, id: 'qual-uuid-102', timelineFit: true },
      ]);

      const results = await service.getQualificationsByLead('lead-uuid-1');

      expect(results.length).toBe(2);
      expect(results[0].restrictionEvaluationStatus).toBe('PENDING_RESTRICTION_ENGINE (Prompt 10)');
      expect(results[1].restrictionEvaluationStatus).toBe('PENDING_RESTRICTION_ENGINE (Prompt 10)');
    });
  });
});
