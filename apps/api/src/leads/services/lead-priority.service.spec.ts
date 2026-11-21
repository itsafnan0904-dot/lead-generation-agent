import { LeadPriorityService } from './lead-priority.service';
import { LeadsService } from '../leads.service';

describe('LeadPriorityService & ranked lead listing', () => {
  let db: any;
  let priority: LeadPriorityService;

  const lead = (id: string, over: any = {}) => ({
    id, status: 'COLD_LEAD', aiControlState: 'AI_ACTIVE', scoreTotal: 0, assignedUserId: 'u1', ...over,
  });

  beforeEach(() => {
    db = {
      qualification: { findMany: jest.fn().mockResolvedValue([]) },
      message: { findMany: jest.fn().mockResolvedValue([]) },
      humanReview: { findMany: jest.fn().mockResolvedValue([]) },
      project: { findMany: jest.fn().mockResolvedValue([]) },
      sellerProfile: { findUnique: jest.fn().mockResolvedValue({ id: 'p1' }), findFirst: jest.fn() },
      interventionRule: {
        findMany: jest.fn().mockResolvedValue([{ trigger: 'PRICING_DISCUSSION', threshold: null, keyword: null }]),
      },
      lead: { findMany: jest.fn(), count: jest.fn() },
    };
    priority = new LeadPriorityService({ client: db } as any);
  });

  it('returns an empty list without querying', async () => {
    expect(await priority.enrich([])).toEqual([]);
    expect(db.qualification.findMany).not.toHaveBeenCalled();
  });

  it('derives message stats, reviews and rules per lead from batched queries', async () => {
    const recent = new Date(Date.now() - 3_600_000);
    db.message.findMany.mockResolvedValue([
      { direction: 'INBOUND', sentAt: recent, bodyText: 'What is your pricing?', conversation: { leadId: 'a' } },
      { direction: 'OUTBOUND', sentAt: new Date(Date.now() - 7_200_000), bodyText: 'Hello', conversation: { leadId: 'a' } },
    ]);
    db.humanReview.findMany.mockResolvedValue([{ leadId: 'b' }]);

    const [a, b] = await priority.enrich([lead('a', { status: 'RESPONDED', scoreTotal: 60 }), lead('b', { status: 'INTERESTED' })]);

    expect(a.priority.needsHuman).toBe(true);
    expect(a.priority.humanReasons).toEqual(['Client is asking about pricing']);
    expect(b.priority.humanReasons).toEqual(['A human review is pending']);
    expect(db.qualification.findMany).toHaveBeenCalledTimes(1); // batched, not per lead
    expect(db.interventionRule.findMany).toHaveBeenCalledTimes(1); // one assignee, rules loaded once
  });

  it('ranks by priority and filters needsHuman in listLeads', async () => {
    db.lead.findMany.mockResolvedValue([
      lead('low', { scoreTotal: 10 }),
      lead('high', { scoreTotal: 90, status: 'QUALIFIED' }),
      lead('review', { scoreTotal: 20 }),
    ]);
    db.humanReview.findMany.mockResolvedValue([{ leadId: 'review' }]);
    const svc = new LeadsService({ client: db } as any, {} as any, {} as any, priority);

    const ranked: any = await svc.listLeads({ sort: 'priority', page: 1, limit: 10 } as any);
    expect(ranked.items.map((l: any) => l.id)).toEqual(['high', 'review', 'low']);
    expect(ranked.total).toBe(3);

    const human: any = await svc.listLeads({ needsHuman: true, page: 1, limit: 10 } as any);
    expect(human.items.map((l: any) => l.id)).toEqual(['review']);
    expect(human.total).toBe(1);
  });

  it('paginates the ranked list in memory', async () => {
    db.lead.findMany.mockResolvedValue([lead('a', { scoreTotal: 30 }), lead('b', { scoreTotal: 60 }), lead('c', { scoreTotal: 90 })]);
    const svc = new LeadsService({ client: db } as any, {} as any, {} as any, priority);
    const page2: any = await svc.listLeads({ sort: 'priority', page: 2, limit: 2 } as any);
    expect(page2.items.map((l: any) => l.id)).toEqual(['a']);
    expect(page2.totalPages).toBe(2);
  });
});
