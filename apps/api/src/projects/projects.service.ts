import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { LeadPriorityService } from '../leads/services/lead-priority.service';
import { CreateProjectDto, UpdateProjectDto } from './dto/project.dto';
import { LeadLifecycleStatus } from '@ai-sales-agent/database';

/** Stages shown on the opportunities board, left to right. */
export const OPPORTUNITY_STAGES: LeadLifecycleStatus[] = [
  LeadLifecycleStatus.INTERESTED,
  LeadLifecycleStatus.GATHERING_REQUIREMENTS,
  LeadLifecycleStatus.QUALIFIED,
  LeadLifecycleStatus.DEAL_DISCUSSION,
  LeadLifecycleStatus.WON,
];

export type ValueByCurrency = Record<string, number>;

export function addValue(target: ValueByCurrency, currency: string, amount: number) {
  target[currency] = Math.round(((target[currency] ?? 0) + amount) * 100) / 100;
}

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly priority: LeadPriorityService,
  ) {}

  async create(leadId: string, dto: CreateProjectDto, userId?: string) {
    await this.requireLead(leadId);
    const { scope, currency, ...rest } = dto;
    const project = await this.prisma.client.project.create({
      data: {
        leadId,
        ...rest,
        currency: currency?.toUpperCase() ?? 'USD',
        ...(scope ? { scope: scope as any } : {}),
      },
    });
    await this.audit.log({
      actorType: 'USER', actorId: userId, userId, action: 'PROJECT_CREATED', entityType: 'PROJECT', entityId: project.id,
      metadata: { leadId, budget: dto.budget, currency: project.currency },
    });
    return project;
  }

  async listForLead(leadId: string) {
    await this.requireLead(leadId);
    return this.prisma.client.project.findMany({ where: { leadId }, orderBy: { createdAt: 'desc' } });
  }

  async update(id: string, dto: UpdateProjectDto, userId?: string) {
    const existing = await this.requireProject(id);
    const { scope, currency, ...rest } = dto;
    const project = await this.prisma.client.project.update({
      where: { id },
      data: {
        ...rest,
        ...(currency ? { currency: currency.toUpperCase() } : {}),
        ...(scope ? { scope: scope as any } : {}),
      },
    });
    await this.audit.log({
      actorType: 'USER', actorId: userId, userId, action: 'PROJECT_UPDATED', entityType: 'PROJECT', entityId: id,
      oldState: { budget: existing.budget?.toString() ?? null, currency: existing.currency },
      newState: { budget: project.budget?.toString() ?? null, currency: project.currency },
      metadata: { leadId: existing.leadId },
    });
    return project;
  }

  async remove(id: string, userId?: string) {
    const existing = await this.requireProject(id);
    await this.prisma.client.project.delete({ where: { id } });
    await this.audit.log({
      actorType: 'USER', actorId: userId, userId, action: 'PROJECT_DELETED', entityType: 'PROJECT', entityId: id,
      metadata: { leadId: existing.leadId, title: existing.title },
    });
    return { deleted: true };
  }

  /**
   * Opportunities board: every lead in a deal stage, or holding a deal, grouped by stage with value totals.
   * Values are kept per currency (never summed across currencies). LOST and RESTRICTED leads are excluded.
   */
  async getPipeline() {
    const leads = await this.prisma.client.lead.findMany({
      where: {
        OR: [{ status: { in: OPPORTUNITY_STAGES } }, { projects: { some: {} } }],
        NOT: { status: { in: [LeadLifecycleStatus.LOST, LeadLifecycleStatus.RESTRICTED] } },
      },
      include: {
        company: { select: { id: true, name: true } },
        primaryContact: { select: { firstName: true, lastName: true, email: true } },
        projects: { orderBy: { createdAt: 'desc' } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 500,
    });

    const enriched = await this.priority.enrich(leads);

    const stages = OPPORTUNITY_STAGES.map((status) => ({
      status,
      count: 0,
      valueByCurrency: {} as ValueByCurrency,
      items: [] as any[],
    }));
    const byStatus = new Map(stages.map((s) => [s.status as string, s]));
    const openValue: ValueByCurrency = {};
    const wonValue: ValueByCurrency = {};
    let other = 0;

    for (const lead of enriched) {
      const stage = byStatus.get(lead.status);
      if (!stage) { other++; continue; } // holds a deal but sits in an earlier stage (e.g. CONTACTED)

      const value: ValueByCurrency = {};
      for (const p of lead.projects) if (p.budget != null) addValue(value, p.currency, Number(p.budget));

      stage.count++;
      for (const [cur, amt] of Object.entries(value)) {
        addValue(stage.valueByCurrency, cur, amt);
        addValue(lead.status === LeadLifecycleStatus.WON ? wonValue : openValue, cur, amt);
      }
      stage.items.push({
        leadId: lead.id,
        company: lead.company.name,
        contact: lead.primaryContact ? `${lead.primaryContact.firstName} ${lead.primaryContact.lastName ?? ''}`.trim() : null,
        status: lead.status,
        valueByCurrency: value,
        projects: lead.projects.map((p) => ({ id: p.id, title: p.title, budget: p.budget != null ? Number(p.budget) : null, currency: p.currency, timeline: p.timeline })),
        priority: lead.priority,
      });
    }

    for (const s of stages) {
      s.items.sort((a, b) => b.priority.priorityScore - a.priority.priorityScore);
    }
    return { stages, totals: { openValueByCurrency: openValue, wonValueByCurrency: wonValue }, otherDealsInEarlierStages: other };
  }

  private async requireLead(leadId: string) {
    const lead = await this.prisma.client.lead.findUnique({ where: { id: leadId }, select: { id: true } });
    if (!lead) throw new NotFoundException(`Lead with ID '${leadId}' not found.`);
  }

  private async requireProject(id: string) {
    const p = await this.prisma.client.project.findUnique({ where: { id } });
    if (!p) throw new NotFoundException(`Project with ID '${id}' not found.`);
    return p;
  }
}
