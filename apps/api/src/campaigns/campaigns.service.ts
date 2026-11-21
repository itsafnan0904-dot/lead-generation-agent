import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { LeadPriorityService } from '../leads/services/lead-priority.service';
import { AssignLeadsDto, CreateCampaignDto, UpdateCampaignDto } from './dto/campaign.dto';
import { allowedTransitions, canTransition, computeCampaignStats } from './campaign-lifecycle.util';

const DETAIL_LEAD_LIMIT = 500;
const CLOSED_FOR_NEW_LEADS = ['COMPLETED', 'ARCHIVED'];

@Injectable()
export class CampaignsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly priority: LeadPriorityService,
  ) {}

  async create(dto: CreateCampaignDto, userId?: string) {
    this.assertDates(dto.startDate, dto.endDate);
    const campaign = await this.prisma.client.campaign.create({
      data: {
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        targetCriteria: (dto.targetCriteria as any) ?? undefined,
        startDate: dto.startDate ? new Date(dto.startDate) : null,
        endDate: dto.endDate ? new Date(dto.endDate) : null,
      },
    });
    await this.audit.log({
      actorType: 'USER', actorId: userId, userId, action: 'CAMPAIGN_CREATED', entityType: 'CAMPAIGN', entityId: campaign.id,
      metadata: { name: campaign.name },
    });
    return campaign;
  }

  /** All campaigns with a lightweight stats summary (no priority scoring, to keep the list cheap). */
  async list(status?: string) {
    const campaigns = await this.prisma.client.campaign.findMany({
      where: status ? { status: status as any } : { status: { not: 'ARCHIVED' } },
      orderBy: { createdAt: 'desc' },
    });
    if (campaigns.length === 0) return [];

    const grouped = await this.prisma.client.lead.groupBy({
      by: ['campaignId', 'status'],
      where: { campaignId: { in: campaigns.map((c) => c.id) } },
      _count: { _all: true },
    });
    const leadsByCampaign = new Map<string, { status: string }[]>();
    for (const g of grouped) {
      const arr = leadsByCampaign.get(g.campaignId!) ?? [];
      for (let i = 0; i < g._count._all; i++) arr.push({ status: g.status });
      leadsByCampaign.set(g.campaignId!, arr);
    }

    return campaigns.map((c) => ({
      ...c,
      stats: computeCampaignStats(leadsByCampaign.get(c.id) ?? []),
      allowedTransitions: allowedTransitions(c.status),
    }));
  }

  async getById(id: string) {
    const campaign = await this.requireCampaign(id);
    const leads = await this.prisma.client.lead.findMany({
      where: { campaignId: id },
      include: {
        company: { select: { id: true, name: true } },
        primaryContact: { select: { firstName: true, lastName: true, email: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: DETAIL_LEAD_LIMIT,
    });
    const enriched = await this.priority.enrich(leads);
    enriched.sort((a, b) => b.priority.priorityScore - a.priority.priorityScore);

    return {
      ...campaign,
      allowedTransitions: allowedTransitions(campaign.status),
      stats: computeCampaignStats(enriched),
      leads: enriched,
    };
  }

  async update(id: string, dto: UpdateCampaignDto, userId?: string) {
    const existing = await this.requireCampaign(id);
    this.assertDates(dto.startDate ?? existing.startDate?.toISOString(), dto.endDate ?? existing.endDate?.toISOString());

    if (dto.status && dto.status !== existing.status && !canTransition(existing.status, dto.status)) {
      throw new BadRequestException(
        `Cannot change campaign from ${existing.status} to ${dto.status}. Allowed: ${allowedTransitions(existing.status).join(', ') || 'none'}.`,
      );
    }

    const { status, targetCriteria, startDate, endDate, name, ...rest } = dto;
    const updated = await this.prisma.client.campaign.update({
      where: { id },
      data: {
        ...rest,
        ...(name ? { name: name.trim() } : {}),
        ...(status ? { status } : {}),
        ...(targetCriteria ? { targetCriteria: targetCriteria as any } : {}),
        ...(startDate ? { startDate: new Date(startDate) } : {}),
        ...(endDate ? { endDate: new Date(endDate) } : {}),
      },
    });

    if (status && status !== existing.status) {
      await this.audit.log({
        actorType: 'USER', actorId: userId, userId, action: 'CAMPAIGN_STATUS_CHANGED', entityType: 'CAMPAIGN', entityId: id,
        oldState: { status: existing.status }, newState: { status },
      });
    }
    return updated;
  }

  async assignLeads(id: string, dto: AssignLeadsDto, userId?: string) {
    const campaign = await this.requireCampaign(id);
    if (CLOSED_FOR_NEW_LEADS.includes(campaign.status)) {
      throw new BadRequestException(`Cannot add leads to a ${campaign.status} campaign.`);
    }

    const leadIds = [...new Set(dto.leadIds)];
    const leads = await this.prisma.client.lead.findMany({
      where: { id: { in: leadIds } },
      select: { id: true, campaignId: true },
    });
    const found = new Map(leads.map((l) => [l.id, l]));

    const toAssign: string[] = [];
    const skipped: { leadId: string; reason: string }[] = [];
    for (const leadId of leadIds) {
      const l = found.get(leadId);
      if (!l) skipped.push({ leadId, reason: 'LEAD_NOT_FOUND' });
      else if (l.campaignId === id) skipped.push({ leadId, reason: 'ALREADY_IN_THIS_CAMPAIGN' });
      else if (l.campaignId) skipped.push({ leadId, reason: 'ALREADY_IN_ANOTHER_CAMPAIGN' });
      else toAssign.push(leadId);
    }

    if (toAssign.length) {
      await this.prisma.client.lead.updateMany({ where: { id: { in: toAssign }, campaignId: null }, data: { campaignId: id } });
      await this.audit.log({
        actorType: 'USER', actorId: userId, userId, action: 'CAMPAIGN_LEADS_ASSIGNED', entityType: 'CAMPAIGN', entityId: id,
        metadata: { count: toAssign.length, leadIds: toAssign },
      });
    }
    return { assigned: toAssign.length, skipped };
  }

  async removeLead(id: string, leadId: string, userId?: string) {
    await this.requireCampaign(id);
    const result = await this.prisma.client.lead.updateMany({ where: { id: leadId, campaignId: id }, data: { campaignId: null } });
    if (result.count === 0) throw new NotFoundException(`Lead '${leadId}' is not in this campaign.`);
    await this.audit.log({
      actorType: 'USER', actorId: userId, userId, action: 'CAMPAIGN_LEAD_REMOVED', entityType: 'CAMPAIGN', entityId: id,
      metadata: { leadId },
    });
    return { removed: true };
  }

  private assertDates(start?: string | null, end?: string | null) {
    if (start && end && new Date(end).getTime() < new Date(start).getTime()) {
      throw new BadRequestException('endDate cannot be before startDate.');
    }
  }

  private async requireCampaign(id: string) {
    const c = await this.prisma.client.campaign.findUnique({ where: { id } });
    if (!c) throw new NotFoundException(`Campaign with ID '${id}' not found.`);
    return c;
  }
}
