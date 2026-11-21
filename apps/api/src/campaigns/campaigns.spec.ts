import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CampaignsService } from './campaigns.service';
import { campaignAllowsAiActivity, canTransition, computeCampaignStats, allowedTransitions } from './campaign-lifecycle.util';
import { decideAutoReply } from '../auto-reply/auto-reply-policy.util';
import { decideFollowUp } from '../follow-ups/follow-up-policy.util';

describe('campaign lifecycle', () => {
  it('allows only sensible transitions', () => {
    expect(canTransition('DRAFT', 'ACTIVE')).toBe(true);
    expect(canTransition('ACTIVE', 'PAUSED')).toBe(true);
    expect(canTransition('PAUSED', 'ACTIVE')).toBe(true);
    expect(canTransition('DRAFT', 'PAUSED')).toBe(false);
    expect(canTransition('ACTIVE', 'DRAFT')).toBe(false);
    expect(canTransition('COMPLETED', 'ACTIVE')).toBe(false);
    expect(allowedTransitions('ARCHIVED')).toEqual([]);
  });

  it('only an active campaign (or no campaign) allows AI activity', () => {
    expect(campaignAllowsAiActivity(null)).toBe(true);
    expect(campaignAllowsAiActivity(undefined)).toBe(true);
    expect(campaignAllowsAiActivity('ACTIVE')).toBe(true);
    for (const s of ['DRAFT', 'PAUSED', 'COMPLETED', 'ARCHIVED']) expect(campaignAllowsAiActivity(s)).toBe(false);
  });
});

describe('campaign status gates AI replies and follow-ups', () => {
  const reply = {
    mode: 'auto' as const, leadStatus: 'RESPONDED', aiControlState: 'AI_ACTIVE', autonomousOptIn: true, analysisRequiresHuman: false,
    intent: 'MORE_INFO_REQUESTED', contactEmail: 'a@b.com', replyAlreadyExists: false, autoRepliesSentLast24h: 0, maxAutoRepliesPerDay: 3,
  };
  const followUp = {
    mode: 'auto' as const, leadStatus: 'CONTACTED', aiControlState: 'AI_ACTIVE', autonomousOptIn: true, contactEmail: 'a@b.com',
    lastOutboundAt: new Date(Date.now() - 5 * 86_400_000), lastInboundAt: null, now: new Date(), afterDays: 3, followUpsSent: 0, maxFollowUps: 2,
    hasPendingFollowUpDraft: false,
  };

  it('replies are skipped for a paused or draft campaign but unaffected otherwise', () => {
    expect(decideAutoReply({ ...reply, campaignStatus: 'PAUSED' })).toEqual({ action: 'SKIP', reason: 'CAMPAIGN_PAUSED' });
    expect(decideAutoReply({ ...reply, campaignStatus: 'DRAFT' })).toEqual({ action: 'SKIP', reason: 'CAMPAIGN_DRAFT' });
    expect(decideAutoReply({ ...reply, campaignStatus: 'ACTIVE' })).toEqual({ action: 'AUTO_SEND' });
    expect(decideAutoReply({ ...reply, campaignStatus: null })).toEqual({ action: 'AUTO_SEND' });
    expect(decideAutoReply(reply)).toEqual({ action: 'AUTO_SEND' });
  });

  it('follow-ups are skipped for a completed or paused campaign but unaffected otherwise', () => {
    expect(decideFollowUp({ ...followUp, campaignStatus: 'COMPLETED' })).toEqual({ action: 'SKIP', reason: 'CAMPAIGN_COMPLETED' });
    expect(decideFollowUp({ ...followUp, campaignStatus: 'PAUSED' })).toEqual({ action: 'SKIP', reason: 'CAMPAIGN_PAUSED' });
    expect(decideFollowUp({ ...followUp, campaignStatus: 'ACTIVE' }).action).toBe('AUTO_SEND');
    expect(decideFollowUp(followUp).action).toBe('AUTO_SEND');
  });
});

describe('computeCampaignStats', () => {
  it('computes funnel numbers, reply rate and average priority of open leads', () => {
    const p = (score: number, needsHuman = false) => ({ priorityScore: score, needsHuman });
    const s = computeCampaignStats([
      { status: 'COLD_LEAD', priority: p(10) },
      { status: 'CONTACTED', priority: p(20) },
      { status: 'RESPONDED', priority: p(60, true) },
      { status: 'QUALIFIED', priority: p(80) },
      { status: 'WON', priority: p(0) },
      { status: 'LOST', priority: p(0) },
      { status: 'RESTRICTED', priority: p(0) },
    ]);
    expect(s).toMatchObject({ totalLeads: 7, contacted: 5, replied: 3, won: 1, lost: 1, needsHuman: 1 });
    expect(s.replyRate).toBe(60);
    expect(s.averagePriority).toBe(Math.round((10 + 20 + 60 + 80) / 4));
    expect(s.byStatus).toMatchObject({ COLD_LEAD: 1, QUALIFIED: 1 });
  });

  it('has null rates for an empty or uncontacted campaign', () => {
    expect(computeCampaignStats([])).toMatchObject({ totalLeads: 0, replyRate: null, averagePriority: null });
    expect(computeCampaignStats([{ status: 'COLD_LEAD' }]).replyRate).toBeNull();
  });
});

describe('CampaignsService', () => {
  let db: any, audit: any, priority: any, service: CampaignsService;
  const campaign = (over: any = {}) => ({ id: 'c1', name: 'Q4', status: 'DRAFT', startDate: null, endDate: null, ...over });

  beforeEach(() => {
    db = {
      campaign: {
        create: jest.fn().mockImplementation(async (a: any) => ({ id: 'c1', status: 'DRAFT', ...a.data })),
        findUnique: jest.fn().mockResolvedValue(campaign()),
        findMany: jest.fn().mockResolvedValue([campaign()]),
        update: jest.fn().mockImplementation(async (a: any) => ({ ...campaign(), ...a.data })),
      },
      lead: {
        findMany: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        groupBy: jest.fn().mockResolvedValue([{ campaignId: 'c1', status: 'CONTACTED', _count: { _all: 2 } }, { campaignId: 'c1', status: 'RESPONDED', _count: { _all: 1 } }]),
      },
    };
    audit = { log: jest.fn().mockResolvedValue({}) };
    priority = { enrich: jest.fn().mockImplementation(async (ls: any[]) => ls.map((l) => ({ ...l, priority: { priorityScore: l.score ?? 0, needsHuman: false } }))) };
    service = new CampaignsService({ client: db } as any, audit, priority);
  });

  it('creates a campaign in DRAFT, trims the name and audits', async () => {
    const c = await service.create({ name: '  Q4 Retail  ', startDate: '2026-10-01', endDate: '2026-12-31' }, 'u1');
    expect(c.name).toBe('Q4 Retail');
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'CAMPAIGN_CREATED' }));
  });

  it('rejects an end date before the start date', async () => {
    await expect(service.create({ name: 'x', startDate: '2026-12-01', endDate: '2026-10-01' })).rejects.toBeInstanceOf(BadRequestException);
    expect(db.campaign.create).not.toHaveBeenCalled();
  });

  it('lists campaigns with stats built from grouped lead counts', async () => {
    const [c]: any = await service.list();
    expect(c.stats).toMatchObject({ totalLeads: 3, contacted: 3, replied: 1 });
    expect(c.allowedTransitions).toEqual(['ACTIVE', 'ARCHIVED']);
    expect(db.campaign.findMany.mock.calls[0][0].where).toEqual({ status: { not: 'ARCHIVED' } }); // archived hidden by default
  });

  it('enforces lifecycle transitions and audits status changes', async () => {
    await expect(service.update('c1', { status: 'PAUSED' as any })).rejects.toThrow(/Cannot change campaign from DRAFT to PAUSED/);
    expect(db.campaign.update).not.toHaveBeenCalled();
    await service.update('c1', { status: 'ACTIVE' as any }, 'u1');
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'CAMPAIGN_STATUS_CHANGED', oldState: { status: 'DRAFT' }, newState: { status: 'ACTIVE' } }));
  });

  it('404s for an unknown campaign', async () => {
    db.campaign.findUnique.mockResolvedValue(null);
    await expect(service.getById('x')).rejects.toBeInstanceOf(NotFoundException);
  });

  describe('assignLeads', () => {
    it('assigns free leads and reports the rest with reasons', async () => {
      db.lead.findMany.mockResolvedValue([
        { id: 'free', campaignId: null }, { id: 'same', campaignId: 'c1' }, { id: 'other', campaignId: 'c2' },
      ]);
      const r = await service.assignLeads('c1', { leadIds: ['free', 'same', 'other', 'ghost', 'free'] }, 'u1');
      expect(r.assigned).toBe(1);
      expect(r.skipped).toEqual(expect.arrayContaining([
        { leadId: 'same', reason: 'ALREADY_IN_THIS_CAMPAIGN' }, { leadId: 'other', reason: 'ALREADY_IN_ANOTHER_CAMPAIGN' }, { leadId: 'ghost', reason: 'LEAD_NOT_FOUND' },
      ]));
      expect(db.lead.updateMany).toHaveBeenCalledWith({ where: { id: { in: ['free'] }, campaignId: null }, data: { campaignId: 'c1' } });
    });

    it('refuses to add leads to a completed or archived campaign', async () => {
      db.campaign.findUnique.mockResolvedValue(campaign({ status: 'COMPLETED' }));
      await expect(service.assignLeads('c1', { leadIds: ['a'] })).rejects.toBeInstanceOf(BadRequestException);
      expect(db.lead.updateMany).not.toHaveBeenCalled();
    });
  });

  it('removes a lead only if it is in the campaign', async () => {
    expect(await service.removeLead('c1', 'l1', 'u1')).toEqual({ removed: true });
    db.lead.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.removeLead('c1', 'l2')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('getById ranks leads by priority and returns stats and allowed transitions', async () => {
    db.campaign.findUnique.mockResolvedValue(campaign({ status: 'ACTIVE' }));
    db.lead.findMany.mockResolvedValue([{ id: 'a', status: 'CONTACTED', score: 10 }, { id: 'b', status: 'RESPONDED', score: 70 }]);
    const r: any = await service.getById('c1');
    expect(r.leads.map((l: any) => l.id)).toEqual(['b', 'a']);
    expect(r.stats.totalLeads).toBe(2);
    expect(r.allowedTransitions).toEqual(['PAUSED', 'COMPLETED']);
  });
});
