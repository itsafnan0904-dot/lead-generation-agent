import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLeadDto, UpdateLeadDto, ListLeadsQueryDto } from './dto/lead.dto';
import { Lead, LeadLifecycleStatus } from '@ai-sales-agent/database';

@Injectable()
export class LeadsService {
  private readonly logger = new Logger(LeadsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Creates a Lead record.
   * REQUIRES an existing companyId.
   * Defaults status to COLD_LEAD. Scoring columns remain at 0 defaults (Prompt 09 computes them).
   */
  async createLead(dto: CreateLeadDto): Promise<Lead> {
    // 1. Verify Company exists
    const company = await this.prisma.client.company.findUnique({
      where: { id: dto.companyId },
    });

    if (!company) {
      throw new NotFoundException(`Company with ID '${dto.companyId}' not found. A Lead requires an existing company.`);
    }

    // 2. If primaryContactId is provided, verify Contact belongs to this Company
    if (dto.primaryContactId) {
      const contact = await this.prisma.client.contact.findUnique({
        where: { id: dto.primaryContactId },
      });
      if (!contact) {
        throw new NotFoundException(`Contact with ID '${dto.primaryContactId}' not found.`);
      }
      if (contact.companyId !== dto.companyId) {
        throw new BadRequestException(
          `Contact with ID '${dto.primaryContactId}' belongs to Company '${contact.companyId}', not '${dto.companyId}'.`,
        );
      }
    }

    // 3. If campaignId provided, verify Campaign exists
    if (dto.campaignId) {
      const campaign = await this.prisma.client.campaign.findUnique({
        where: { id: dto.campaignId },
      });
      if (!campaign) {
        throw new NotFoundException(`Campaign with ID '${dto.campaignId}' not found.`);
      }
    }

    // 4. If assignedUserId provided, verify User exists
    if (dto.assignedUserId) {
      const user = await this.prisma.client.user.findUnique({
        where: { id: dto.assignedUserId },
      });
      if (!user) {
        throw new NotFoundException(`User with ID '${dto.assignedUserId}' not found.`);
      }
    }

    return this.prisma.client.lead.create({
      data: {
        companyId: dto.companyId,
        primaryContactId: dto.primaryContactId || null,
        campaignId: dto.campaignId || null,
        assignedUserId: dto.assignedUserId || null,
        status: LeadLifecycleStatus.COLD_LEAD,
        metadata: dto.metadata || undefined,
      },
      include: {
        company: true,
        primaryContact: true,
        assignedUser: {
          select: { id: true, email: true, name: true, role: true },
        },
      },
    });
  }

  /**
   * Retrieves a single Lead with associated Company, Contact, and User.
   */
  async getLeadById(id: string): Promise<Lead> {
    const lead = await this.prisma.client.lead.findUnique({
      where: { id },
      include: {
        company: true,
        primaryContact: true,
        campaign: true,
        assignedUser: {
          select: { id: true, email: true, name: true, role: true },
        },
        research: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!lead) {
      throw new NotFoundException(`Lead with ID '${id}' not found.`);
    }

    return lead;
  }

  /**
   * Lists Leads with pagination and filtering.
   */
  async listLeads(query: ListLeadsQueryDto): Promise<{
    items: Lead[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.companyId) where.companyId = query.companyId;
    if (query.assignedUserId) where.assignedUserId = query.assignedUserId;
    if (query.status) where.status = query.status;

    const [items, total] = await Promise.all([
      this.prisma.client.lead.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          company: { select: { id: true, name: true, domain: true, industry: true } },
          primaryContact: { select: { id: true, email: true, firstName: true, lastName: true } },
          assignedUser: { select: { id: true, name: true, email: true } },
        },
      }),
      this.prisma.client.lead.count({ where }),
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
   * Updates an existing Lead.
   */
  async updateLead(id: string, dto: UpdateLeadDto): Promise<Lead> {
    const existing = await this.getLeadById(id);

    if (dto.primaryContactId) {
      const contact = await this.prisma.client.contact.findUnique({
        where: { id: dto.primaryContactId },
      });
      if (!contact) {
        throw new NotFoundException(`Contact with ID '${dto.primaryContactId}' not found.`);
      }
      if (contact.companyId !== existing.companyId) {
        throw new BadRequestException(
          `Contact with ID '${dto.primaryContactId}' belongs to Company '${contact.companyId}', not '${existing.companyId}'.`,
        );
      }
    }

    if (dto.assignedUserId) {
      const user = await this.prisma.client.user.findUnique({
        where: { id: dto.assignedUserId },
      });
      if (!user) {
        throw new NotFoundException(`User with ID '${dto.assignedUserId}' not found.`);
      }
    }

    return this.prisma.client.lead.update({
      where: { id },
      data: {
        ...(dto.primaryContactId !== undefined ? { primaryContactId: dto.primaryContactId } : {}),
        ...(dto.campaignId !== undefined ? { campaignId: dto.campaignId } : {}),
        ...(dto.assignedUserId !== undefined ? { assignedUserId: dto.assignedUserId } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.metadata !== undefined ? { metadata: dto.metadata } : {}),
      },
      include: {
        company: true,
        primaryContact: true,
        assignedUser: {
          select: { id: true, email: true, name: true, role: true },
        },
      },
    });
  }
}
