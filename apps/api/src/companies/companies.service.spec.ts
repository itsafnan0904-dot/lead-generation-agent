import { ConflictException, NotFoundException } from '@nestjs/common';
import { CompaniesService } from './companies.service';
import { RestrictionCheckResult } from '@ai-sales-agent/database';

describe('CompaniesService & Restriction Engine Integration', () => {
  let service: CompaniesService;
  let mockPrismaClient: any;
  let mockAIOrchestrator: any;
  let mockRestrictionEngine: any;

  const mockCompany = {
    id: 'comp-uuid-1',
    name: 'Apex Industrial Supply',
    domain: 'apexindustrial.com',
    industry: 'Manufacturing',
    size: '100-250',
    location: 'Chicago, IL',
    country: 'USA',
    website: 'https://apexindustrial.com',
    linkedinUrl: 'https://linkedin.com/company/apexindustrial',
    metadata: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    mockPrismaClient = {
      company: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
      },
      research: {
        create: jest.fn(),
      },
    };

    mockAIOrchestrator = {
      analyzeResearch: jest.fn(),
    };

    mockRestrictionEngine = {
      evaluate: jest.fn(),
    };

    const mockPrismaService = { client: mockPrismaClient } as any;

    service = new CompaniesService(
      mockPrismaService,
      mockAIOrchestrator,
      mockRestrictionEngine,
    );
  });

  describe('Company Creation & Deduplication', () => {
    it('successfully creates a company when domain is unique', async () => {
      mockPrismaClient.company.findUnique.mockResolvedValue(null);
      mockPrismaClient.company.create.mockResolvedValue(mockCompany);

      const result = await service.createCompany({
        name: 'Apex Industrial Supply',
        domain: 'apexindustrial.com',
        industry: 'Manufacturing',
      });

      expect(result.id).toBe('comp-uuid-1');
      expect(mockPrismaClient.company.findUnique).toHaveBeenCalledWith({
        where: { domain: 'apexindustrial.com' },
      });
      expect(mockPrismaClient.company.create).toHaveBeenCalled();
    });

    it('rejects company creation with 409 Conflict when domain already exists', async () => {
      mockPrismaClient.company.findUnique.mockResolvedValue(mockCompany);

      await expect(
        service.createCompany({
          name: 'Apex Copycat',
          domain: 'apexindustrial.com',
        }),
      ).rejects.toThrow(ConflictException);

      expect(mockPrismaClient.company.create).not.toHaveBeenCalled();
    });

    it('rejects company creation with 409 Conflict when name matches case-insensitively without domain', async () => {
      mockPrismaClient.company.findFirst.mockResolvedValue(mockCompany);

      await expect(
        service.createCompany({
          name: 'apex industrial supply',
        }),
      ).rejects.toThrow(ConflictException);

      expect(mockPrismaClient.company.findFirst).toHaveBeenCalledWith({
        where: {
          name: { equals: 'apex industrial supply', mode: 'insensitive' },
        },
      });
      expect(mockPrismaClient.company.create).not.toHaveBeenCalled();
    });
  });

  describe('POST /companies/:id/research & Restriction Policy Engine', () => {
    it('calls AIOrchestratorService.analyzeResearch, executes RestrictionEngine, and persists Research record', async () => {
      mockPrismaClient.company.findUnique.mockResolvedValue(mockCompany);
      mockAIOrchestrator.analyzeResearch.mockResolvedValue({
        data: {
          summary: 'Apex provides general industrial manufacturing and supply chain logistics.',
          keyInsights: ['Expanding into Midwest', 'Upgrading automated warehouse'],
          techStack: ['SAP', 'Shopify Plus'],
          painPoints: ['Manual inventory reconciliation'],
          recentEvents: ['Opened new distribution center'],
          confidenceScore: 0.92,
        },
        metadata: {
          modelUsed: 'gpt-4o-mini',
          usage: { promptTokens: 120, completionTokens: 60, totalTokens: 180 },
          latencyMs: 310,
          timestamp: new Date(),
        },
      });

      const mockRestrictionCheck = {
        id: 'restr-check-101',
        entityType: 'COMPANY',
        result: RestrictionCheckResult.CLEAR,
        reason: 'Clean industrial equipment scope.',
      };
      mockRestrictionEngine.evaluate.mockResolvedValue(mockRestrictionCheck);

      const mockCreatedResearch = {
        id: 'research-uuid-101',
        companyId: mockCompany.id,
        companySummary: 'Apex provides general industrial manufacturing and supply chain logistics.',
        completedAt: new Date(),
      };
      mockPrismaClient.research.create.mockResolvedValue(mockCreatedResearch);

      const result = await service.triggerResearch(mockCompany.id, {});

      expect(mockAIOrchestrator.analyzeResearch).toHaveBeenCalledWith({
        companyName: mockCompany.name,
        rawResearchText: expect.stringContaining('Apex Industrial Supply'),
      });
      expect(mockRestrictionEngine.evaluate).toHaveBeenCalledWith(
        expect.objectContaining({
          companyId: mockCompany.id,
          sourceTrigger: 'research',
        }),
      );
      expect(mockPrismaClient.research.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          companyId: mockCompany.id,
          companySummary: expect.any(String),
          keyInsights: expect.any(Array),
        }),
      });
      expect(result.restrictionCheck.result).toBe(RestrictionCheckResult.CLEAR);
    });
  });
});

