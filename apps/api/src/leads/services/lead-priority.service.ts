import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  computeLeadPriority,
  InterventionRuleInput,
  PriorityResult,
} from '../utils/lead-priority.util';
import { HumanReviewStatus, MessageDirection } from '@ai-sales-agent/database';

type LeadLike = {
  id: string;
  status: any;
  aiControlState: any;
  scoreTotal: number;
  assignedUserId: string | null;
};

/**
 * Attaches priority / deal-readiness / human-needed data to leads.
 * Computed on read from live data, so it is never stale; batch queries keep it to a handful of round trips.
 */
@Injectable()
export class LeadPriorityService {
  constructor(private readonly prisma: PrismaService) {}

  async enrich<T extends LeadLike>(leads: T[]): Promise<(T & { priority: PriorityResult })[]> {
    if (leads.length === 0) return [];
    const leadIds = leads.map((l) => l.id);
    const db = this.prisma.client;

    const [qualifications, messages, reviews, projects] = await Promise.all([
      db.qualification.findMany({ where: { leadId: { in: leadIds } }, orderBy: { createdAt: 'desc' } }),
      db.message.findMany({
        where: { conversation: { leadId: { in: leadIds } } },
        select: { direction: true, sentAt: true, bodyText: true, conversation: { select: { leadId: true } } },
        orderBy: { sentAt: 'desc' },
        take: 5000,
      }),
      db.humanReview.findMany({
        where: { leadId: { in: leadIds }, status: { in: [HumanReviewStatus.PENDING, HumanReviewStatus.IN_REVIEW] } },
        select: { leadId: true },
      }),
      db.project.findMany({ where: { leadId: { in: leadIds } }, select: { leadId: true, budget: true } }),
    ]);

    const latestQual = new Map<string, (typeof qualifications)[number]>();
    for (const q of qualifications) if (!latestQual.has(q.leadId)) latestQual.set(q.leadId, q);

    const msgStats = new Map<string, { inbound: number; outbound: number; lastInboundAt: Date | null; lastInboundText: string | null }>();
    for (const m of messages) {
      const leadId = m.conversation.leadId;
      if (!leadId) continue;
      const s = msgStats.get(leadId) ?? { inbound: 0, outbound: 0, lastInboundAt: null, lastInboundText: null };
      if (m.direction === MessageDirection.INBOUND) {
        s.inbound++;
        if (!s.lastInboundAt) { s.lastInboundAt = m.sentAt; s.lastInboundText = m.bodyText; } // messages are newest-first
      } else {
        s.outbound++;
      }
      msgStats.set(leadId, s);
    }

    const pendingReview = new Set(reviews.map((r) => r.leadId).filter(Boolean) as string[]);

    const maxBudget = new Map<string, number>();
    for (const p of projects) {
      if (p.budget == null) continue;
      maxBudget.set(p.leadId, Math.max(maxBudget.get(p.leadId) ?? 0, Number(p.budget)));
    }

    // Intervention rules are per seller; resolve once per distinct assignee
    const rulesCache = new Map<string, InterventionRuleInput[]>();
    for (const l of leads) {
      const key = l.assignedUserId ?? '';
      if (!rulesCache.has(key)) rulesCache.set(key, await this.loadRules(l.assignedUserId));
    }

    const now = new Date();
    return leads.map((l) => {
      const s = msgStats.get(l.id);
      const priority = computeLeadPriority({
        status: l.status,
        aiControlState: l.aiControlState,
        scoreTotal: l.scoreTotal,
        qualification: latestQual.get(l.id) ?? null,
        inboundCount: s?.inbound ?? 0,
        outboundCount: s?.outbound ?? 0,
        lastInboundAt: s?.lastInboundAt ?? null,
        latestInboundText: s?.lastInboundText ?? null,
        hasPendingHumanReview: pendingReview.has(l.id),
        maxProjectBudget: maxBudget.get(l.id) ?? null,
        interventionRules: rulesCache.get(l.assignedUserId ?? '') ?? [],
        now,
      });
      return { ...l, priority };
    });
  }

  /** Active intervention rules of the assignee's profile, else the earliest completed profile. */
  private async loadRules(userId: string | null): Promise<InterventionRuleInput[]> {
    const db = this.prisma.client;
    let profile = userId ? await db.sellerProfile.findUnique({ where: { userId }, select: { id: true } }) : null;
    if (!profile) {
      profile = await db.sellerProfile.findFirst({
        where: { onboardingComplete: true },
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      });
    }
    if (!profile) return [];

    const rules = await db.interventionRule.findMany({ where: { profileId: profile.id, isActive: true } });
    return rules.map((r) => ({
      trigger: r.trigger,
      threshold: r.threshold != null ? Number(r.threshold) : null,
      keyword: r.keyword,
    }));
  }
}
