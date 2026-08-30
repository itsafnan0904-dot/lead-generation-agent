import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { CompaniesService } from './companies.service';
import { PrismaService } from '../prisma/prisma.service';
import { AIOrchestratorService } from '../ai/services/ai-orchestrator.service';
import { checkPreliminaryRestrictionKeywords } from './utils/restriction-keywords.util';

describe('CompaniesService & Preliminary Restriction Scan', () => {
  let service: CompaniesService;
  let prismaService: any;
  let aiOrchestrator: any;

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

  beforeEach(async () => {
    prismaService = {
      client: {
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
      },
    };

    aiOrchestrator = {
      analyzeResearch: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CompaniesService,
        { provide: PrismaService, useValue: prismaService },
        { provide: AIOrchestratorService, useValue: aiOrchestrator },
      ],
    }).compile();

    service = module.get<CompaniesService>(CompaniesService);
  });

  describe('Company Creation & Deduplication', () => {
    it('successfully creates a company when domain is unique', async () => {
      prismaService.client.company.findUnique.mockResolvedValue(null);
      prismaService.client.company.create.mockResolvedValue(mockCompany);

      const result = await service.createCompany({
        name: 'Apex Industrial Supply',
        domain: 'apexindustrial.com',
        industry: 'Manufacturing',
      });

      expect(result.id).toBe('comp-uuid-1');
      expect(prismaService.client.company.findUnique).toHaveBeenCalledWith({
        where: { domain: 'apexindustrial.com' },
      });
      expect(prismaService.client.company.create).toHaveBeenCalled();
    });

    it('rejects company creation with 409 Conflict when domain already exists', async () => {
      prismaService.client.company.findUnique.mockResolvedValue(mockCompany);

      await expect(
        service.createCompany({
          name: 'Apex Copycat',
          domain: 'apexindustrial.com',
        }),
      ).rejects.toThrow(ConflictException);

      expect(prismaService.client.company.create).not.toHaveBeenCalled();
    });

    it('rejects company creation with 409 Conflict when name matches case-insensitively without domain', async () => {
      prismaService.client.company.findFirst.mockResolvedValue(mockCompany);

      await expect(
        service.createCompany({
          name: 'apex industrial supply',
        }),
      ).rejects.toThrow(ConflictException);

      expect(prismaService.client.company.findFirst).toHaveBeenCalledWith({
        where: {
          name: { equals: 'apex industrial supply', mode: 'insensitive' },
        },
      });
      expect(prismaService.client.company.create).not.toHaveBeenCalled();
    });
  });

  describe('POST /companies/:id/research & Preliminary Restriction Scan', () => {
    it('calls AIOrchestratorService.analyzeResearch and persists Research record linked to Company', async () => {
      prismaService.client.company.findUnique.mockResolvedValue(mockCompany);
      aiOrchestrator.analyzeResearch.mockResolvedValue({
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

      const mockCreatedResearch = {
        id: 'research-uuid-101',
        companyId: mockCompany.id,
        companySummary: 'Apex provides general industrial manufacturing and supply chain logistics.',
        completedAt: new Date(),
      };
      prismaService.client.research.create.mockResolvedValue(mockCreatedResearch);

      const result = await service.triggerResearch(mockCompany.id, {});

      expect(aiOrchestrator.analyzeResearch).toHaveBeenCalledWith({
        companyName: mockCompany.name,
        rawResearchText: expect.stringContaining('Apex Industrial Supply'),
      });
      expect(prismaService.client.research.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          companyId: mockCompany.id,
          companySummary: expect.any(String),
          keyInsights: expect.any(Array),
        }),
      });
      expect(result.preliminaryRestrictionFlag).toBe(false);
      expect(result.preliminaryRestrictionDetails.matchedKeywords.length).toBe(0);
    });

    it('triggers preliminary restriction flag when restricted keywords are detected in company data or AI output', async () => {
      prismaService.client.company.findUnique.mockResolvedValue({
        ...mockCompany,
        industry: 'Commercial Steel Decking & Framing',
      });

      aiOrchestrator.analyzeResearch.mockResolvedValue({
        data: {
          summary: 'Company specializes in OWSJ open-web steel joists and K-Series joist girders.',
          keyInsights: ['Major supplier of Steel decking'],
          techStack: ['Tekla Structures'],
          painPoints: ['Supply chain bottlenecks'],
          recentEvents: ['Expanded joist production line'],
          confidenceScore: 0.95,
        },
        metadata: {
          modelUsed: 'gpt-4o-mini',
          usage: { promptTokens: 150, completionTokens: 80, totalTokens: 230 },
          latencyMs: 350,
          timestamp: new Date(),
        },
      });

      prismaService.client.research.create.mockResolvedValue({ id: 'res-1' });

      const result = await service.triggerResearch(mockCompany.id, {
        rawResearchText: 'Specializing in LH-Series and DLH-Series longspan steel joists.',
      });

      expect(result.preliminaryRestrictionFlag).toBe(true);
      expect(result.preliminaryRestrictionDetails.matchedKeywords).toContain('OWSJ');
      expect(result.preliminaryRestrictionDetails.matchedKeywords).toContain('K-Series');
      expect(result.preliminaryRestrictionDetails.matchedKeywords).toContain('LH-Series');
      expect(result.preliminaryRestrictionDetails.matchedKeywords).toContain('Steel decking');
    });
  });

  describe('checkPreliminaryRestrictionKeywords utility', () => {
    it('identifies exact restricted steel & joist keywords accurately', () => {
      const sampleText = 'We fabricate Joist girders and provide complete Decking for roofs.';
      const res = checkPreliminaryRestrictionKeywords(sampleText);

      expect(res.flagged).toBe(true);
      expect(res.matchedKeywords).toEqual(['Joist girders', 'Decking']);
    });

    it('does not trigger false positives on ordinary unrelated text', () => {
      const sampleText = 'Cloud software development, SaaS CRM platforms, and database administration.';
      const res = checkPreliminaryRestrictionKeywords(sampleText);

      expect(res.flagged).toBe(false);
      expect(res.matchedKeywords).toEqual([]);
    });
  });
});
