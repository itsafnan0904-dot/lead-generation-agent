import {
  Injectable,
  ConflictException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateCompanyDto,
  UpdateCompanyDto,
  ListCompaniesQueryDto,
  TriggerResearchDto,
} from './dto/company.dto';
import { AIOrchestratorService } from '../ai/services/ai-orchestrator.service';
import { checkPreliminaryRestrictionKeywords } from './utils/restriction-keywords.util';
import { Company, Research } from '@ai-sales-agent/database';

@Injectable()
export class CompaniesService {
  private readonly logger = new Logger(CompaniesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiOrchestrator: AIOrchestratorService,
  ) {}

  /**
   * Creates a new Company record with deduplication checks:
   * 1. Exact domain match check (if domain provided).
   * 2. Normalized name check (if domain is absent).
   * Throws 409 Conflict with details if duplicate detected.
   */
  async createCompany(dto: CreateCompanyDto): Promise<Company> {
    const normalizedName = dto.name.trim();
    const normalizedDomain = dto.domain ? dto.domain.toLowerCase().trim() : null;

    // 1. Exact Domain Deduplication
    if (normalizedDomain) {
      const existingByDomain = await this.prisma.client.company.findUnique({
        where: { domain: normalizedDomain },
      });

      if (existingByDomain) {
        throw new ConflictException({
          statusCode: 409,
          message: `Company with domain '${normalizedDomain}' already exists.`,
          existingCompanyId: existingByDomain.id,
          existingCompanyName: existingByDomain.name,
        });
      }
    } else {
      // 2. Normalized Name Deduplication (Case-insensitive)
      const existingByName = await this.prisma.client.company.findFirst({
        where: {
          name: {
            equals: normalizedName,
            mode: 'insensitive',
          },
        },
      });

      if (existingByName) {
        throw new ConflictException({
          statusCode: 409,
          message: `Company with name '${normalizedName}' already exists (ID: ${existingByName.id}). Please provide a distinct domain or update the existing company.`,
          existingCompanyId: existingByName.id,
          existingCompanyName: existingByName.name,
        });
      }
    }

    return this.prisma.client.company.create({
      data: {
        name: normalizedName,
        domain: normalizedDomain,
        industry: dto.industry?.trim() || null,
        size: dto.size?.trim() || null,
        location: dto.location?.trim() || null,
        country: dto.country?.trim() || null,
        website: dto.website?.trim() || (normalizedDomain ? `https://${normalizedDomain}` : null),
        linkedinUrl: dto.linkedinUrl?.trim() || null,
        metadata: dto.metadata || undefined,
      },
    });
  }

  /**
   * Retrieves a single company by ID including contacts count and leads count.
   */
  async getCompanyById(id: string): Promise<Company & { contacts: any[]; leads: any[]; research: any[] }> {
    const company = await this.prisma.client.company.findUnique({
      where: { id },
      include: {
        contacts: {
          orderBy: { createdAt: 'desc' },
        },
        leads: {
          orderBy: { createdAt: 'desc' },
        },
        research: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!company) {
      throw new NotFoundException(`Company with ID '${id}' not found.`);
    }

    return company;
  }

  /**
   * Lists companies with pagination and optional search filter.
   */
  async listCompanies(query: ListCompaniesQueryDto): Promise<{
    items: Company[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (query.search) {
      const term = query.search.trim();
      where.OR = [
        { name: { contains: term, mode: 'insensitive' } },
        { domain: { contains: term, mode: 'insensitive' } },
        { industry: { contains: term, mode: 'insensitive' } },
        { location: { contains: term, mode: 'insensitive' } },
      ];
    }

    if (query.industry) {
      where.industry = { equals: query.industry.trim(), mode: 'insensitive' };
    }

    const [items, total] = await Promise.all([
      this.prisma.client.company.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.client.company.count({ where }),
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
   * Updates an existing Company.
   */
  async updateCompany(id: string, dto: UpdateCompanyDto): Promise<Company> {
    await this.getCompanyById(id);

    if (dto.domain) {
      const normalizedDomain = dto.domain.toLowerCase().trim();
      const existingDomain = await this.prisma.client.company.findUnique({
        where: { domain: normalizedDomain },
      });
      if (existingDomain && existingDomain.id !== id) {
        throw new ConflictException(`Company with domain '${normalizedDomain}' already exists.`);
      }
      dto.domain = normalizedDomain;
    }

    return this.prisma.client.company.update({
      where: { id },
      data: {
        ...(dto.name ? { name: dto.name.trim() } : {}),
        ...(dto.domain !== undefined ? { domain: dto.domain } : {}),
        ...(dto.industry !== undefined ? { industry: dto.industry } : {}),
        ...(dto.size !== undefined ? { size: dto.size } : {}),
        ...(dto.location !== undefined ? { location: dto.location } : {}),
        ...(dto.country !== undefined ? { country: dto.country } : {}),
        ...(dto.website !== undefined ? { website: dto.website } : {}),
        ...(dto.linkedinUrl !== undefined ? { linkedinUrl: dto.linkedinUrl } : {}),
        ...(dto.metadata !== undefined ? { metadata: dto.metadata } : {}),
      },
    });
  }

  /**
   * Triggers AI research for a company, scans for preliminary restriction keywords,
   * and persists a new Research record linked to the Company.
   */
  async triggerResearch(
    companyId: string,
    dto: TriggerResearchDto,
  ): Promise<{
    research: Research;
    preliminaryRestrictionFlag: boolean;
    preliminaryRestrictionDetails: {
      matchedKeywords: string[];
      explanation: string;
    };
  }> {
    const company = await this.getCompanyById(companyId);

    const rawResearchInput =
      dto.rawResearchText ||
      `Company Name: ${company.name}\nDomain: ${company.domain || 'N/A'}\nIndustry: ${company.industry || 'N/A'}\nSize: ${company.size || 'N/A'}\nLocation: ${company.location || 'N/A'}\nWebsite: ${company.website || 'N/A'}`;

    // 1. Call AIOrchestratorService.analyzeResearch()
    const aiResponse = await this.aiOrchestrator.analyzeResearch({
      companyName: company.name,
      rawResearchText: rawResearchInput,
    });

    const researchData = aiResponse.data;

    // 2. Perform Preliminary Restriction Keyword Check
    // Aggregates known company text + AI generated summary & insights
    const corpusToScan = [
      company.name,
      company.industry || '',
      rawResearchInput,
      researchData.summary,
      ...(researchData.keyInsights || []),
      ...(researchData.painPoints || []),
      ...(researchData.techStack || []),
    ].join(' ');

    const restrictionScan = checkPreliminaryRestrictionKeywords(corpusToScan);

    // 3. Persist Research record linked to Company
    const research = await this.prisma.client.research.create({
      data: {
        companyId: company.id,
        companySummary: researchData.summary,
        keyInsights: researchData.keyInsights,
        techStack: researchData.techStack,
        painPoints: researchData.painPoints,
        newsAndEvents: researchData.recentEvents,
        rawResearchData: {
          rawInput: rawResearchInput,
          confidenceScore: researchData.confidenceScore,
          metadata: aiResponse.metadata as any,
          preliminaryRestrictionScan: restrictionScan as any,
        } as any,
        completedAt: new Date(),
      },
    });


    return {
      research,
      preliminaryRestrictionFlag: restrictionScan.flagged,
      preliminaryRestrictionDetails: {
        matchedKeywords: restrictionScan.matchedKeywords,
        explanation: restrictionScan.explanation,
      },
    };
  }
}
