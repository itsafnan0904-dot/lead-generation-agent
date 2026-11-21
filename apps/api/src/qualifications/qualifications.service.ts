import {
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateQualificationDto, UpdateQualificationDto } from './dto/qualification.dto';
import { Qualification } from '@ai-sales-agent/database';

@Injectable()
export class QualificationsService {
  private readonly logger = new Logger(QualificationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Creates a Qualification record scoped to a Lead.
   * NOTE on restriction handling: `restrictionEvaluationStatus` reports the lead's most recent
   * RestrictionCheck result (CLEAR / RESTRICTED / HUMAN_REVIEW), or NOT_EVALUATED when none exists.
   * Saving a qualification does not itself run a restriction check.
   */
  async createQualification(leadId: string, dto: CreateQualificationDto): Promise<Qualification & { restrictionEvaluationStatus: string }> {
    const lead = await this.prisma.client.lead.findUnique({
      where: { id: leadId },
    });

    if (!lead) {
      throw new NotFoundException(`Lead with ID '${leadId}' not found.`);
    }

    const qualification = await this.prisma.client.qualification.create({
      data: {
        leadId,
        budgetFit: dto.budgetFit,
        authorityFit: dto.authorityFit,
        needFit: dto.needFit,
        timelineFit: dto.timelineFit,
        technicalFit: dto.technicalFit,
        fitSummary: dto.fitSummary || null,
        dealBlockers: dto.dealBlockers || undefined,
        answers: dto.answers || undefined,
        qualifiedBy: dto.qualifiedBy || 'MANUAL',
      },
    });

    return {
      ...qualification,
      restrictionEvaluationStatus: await this.getRestrictionStatus(leadId),
    };
  }

  /**
   * Retrieves all Qualification passes for a given Lead.
   */
  async getQualificationsByLead(leadId: string): Promise<(Qualification & { restrictionEvaluationStatus: string })[]> {
    const lead = await this.prisma.client.lead.findUnique({
      where: { id: leadId },
    });

    if (!lead) {
      throw new NotFoundException(`Lead with ID '${leadId}' not found.`);
    }

    const qualifications = await this.prisma.client.qualification.findMany({
      where: { leadId },
      orderBy: { createdAt: 'desc' },
    });

    const restrictionEvaluationStatus = await this.getRestrictionStatus(leadId);
    return qualifications.map((q) => ({ ...q, restrictionEvaluationStatus }));
  }

  /**
   * Retrieves a single Qualification by ID.
   */
  async getQualificationById(id: string): Promise<Qualification & { restrictionEvaluationStatus: string }> {
    const qualification = await this.prisma.client.qualification.findUnique({
      where: { id },
      include: {
        lead: {
          select: { id: true, companyId: true, status: true },
        },
      },
    });

    if (!qualification) {
      throw new NotFoundException(`Qualification with ID '${id}' not found.`);
    }

    return {
      ...qualification,
      restrictionEvaluationStatus: await this.getRestrictionStatus(qualification.leadId),
    };
  }

  /**
   * Updates an existing Qualification record.
   */
  async updateQualification(id: string, dto: UpdateQualificationDto): Promise<Qualification & { restrictionEvaluationStatus: string }> {
    await this.getQualificationById(id);

    const updated = await this.prisma.client.qualification.update({
      where: { id },
      data: {
        ...(dto.budgetFit !== undefined ? { budgetFit: dto.budgetFit } : {}),
        ...(dto.authorityFit !== undefined ? { authorityFit: dto.authorityFit } : {}),
        ...(dto.needFit !== undefined ? { needFit: dto.needFit } : {}),
        ...(dto.timelineFit !== undefined ? { timelineFit: dto.timelineFit } : {}),
        ...(dto.technicalFit !== undefined ? { technicalFit: dto.technicalFit } : {}),
        ...(dto.fitSummary !== undefined ? { fitSummary: dto.fitSummary } : {}),
        ...(dto.dealBlockers !== undefined ? { dealBlockers: dto.dealBlockers } : {}),
        ...(dto.answers !== undefined ? { answers: dto.answers } : {}),
        ...(dto.qualifiedBy !== undefined ? { qualifiedBy: dto.qualifiedBy } : {}),
      },
    });

    return {
      ...updated,
      restrictionEvaluationStatus: await this.getRestrictionStatus(updated.leadId),
    };
  }

  /** Latest restriction check result for the lead, or NOT_EVALUATED if none has run. */
  private async getRestrictionStatus(leadId: string): Promise<string> {
    const latest = await this.prisma.client.restrictionCheck.findFirst({
      where: { leadId },
      orderBy: { createdAt: 'desc' },
      select: { result: true },
    });
    return latest?.result ?? 'NOT_EVALUATED';
  }
}
