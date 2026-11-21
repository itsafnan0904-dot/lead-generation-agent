import { NotFoundException } from '@nestjs/common';
import { ProjectsService, addValue } from './projects.service';

describe('addValue', () => {
  it('sums per currency without float drift', () => {
    const v: Record<string, number> = {};
    addValue(v, 'USD', 0.1);
    addValue(v, 'USD', 0.2);
    addValue(v, 'EUR', 5);
    expect(v).toEqual({ USD: 0.3, EUR: 5 });
  });
});

describe('ProjectsService', () => {
  let db: any, audit: any, priority: any, service: ProjectsService;
  const prio = (score: number) => ({ priorityScore: score, priorityLabel: 'WARM', readinessScore: 50, readinessLabel: 'ADVANCING', needsHuman: false, humanReasons: [], nextAction: 'x' });

  beforeEach(() => {
    db = {
      lead: { findUnique: jest.fn().mockResolvedValue({ id: 'l1' }), findMany: jest.fn() },
      project: {
        create: jest.fn().mockImplementation(async (a: any) => ({ id: 'p1', currency: 'USD', budget: null, ...a.data })),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue({ id: 'p1', leadId: 'l1', title: 'Redesign', budget: '1000', currency: 'USD' }),
        update: jest.fn().mockImplementation(async (a: any) => ({ id: 'p1', leadId: 'l1', budget: '2500', currency: 'USD', ...a.data })),
        delete: jest.fn().mockResolvedValue({}),
      },
    };
    audit = { log: jest.fn().mockResolvedValue({}) };
    priority = { enrich: jest.fn().mockImplementation(async (ls: any[]) => ls.map((l) => ({ ...l, priority: prio(l.score ?? 10) }))) };
    service = new ProjectsService({ client: db } as any, audit, priority);
  });

  it('creates a project for an existing lead, upper-casing the currency and defaulting to USD', async () => {
    const p = await service.create('l1', { title: 'Store redesign', budget: 5000, currency: 'eur' }, 'u1');
    expect(db.project.create.mock.calls[0][0].data).toMatchObject({ leadId: 'l1', title: 'Store redesign', budget: 5000, currency: 'EUR' });
    expect(p.currency).toBe('EUR');
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'PROJECT_CREATED', actorId: 'u1' }));

    await service.create('l1', { title: 'No currency' });
    expect(db.project.create.mock.calls[1][0].data.currency).toBe('USD');
  });

  it('404s for a missing lead or project and does not write', async () => {
    db.lead.findUnique.mockResolvedValue(null);
    await expect(service.create('nope', { title: 'x' })).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.listForLead('nope')).rejects.toBeInstanceOf(NotFoundException);
    expect(db.project.create).not.toHaveBeenCalled();

    db.project.findUnique.mockResolvedValue(null);
    await expect(service.update('nope', { title: 'x' })).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.remove('nope')).rejects.toBeInstanceOf(NotFoundException);
    expect(db.project.delete).not.toHaveBeenCalled();
  });

  it('records old and new budget when a project changes', async () => {
    await service.update('p1', { budget: 2500 }, 'u1');
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({
      action: 'PROJECT_UPDATED', oldState: { budget: '1000', currency: 'USD' }, newState: { budget: '2500', currency: 'USD' },
    }));
  });

  it('deletes and audits', async () => {
    expect(await service.remove('p1', 'u1')).toEqual({ deleted: true });
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'PROJECT_DELETED' }));
  });

  describe('getPipeline', () => {
    const lead = (id: string, status: string, projects: any[], score = 10) => ({
      id, status, score, company: { id: `c-${id}`, name: `Co ${id}` }, primaryContact: { firstName: 'Sam', lastName: 'Lee', email: 'a@b.com' }, projects,
    });
    const proj = (budget: number | null, currency = 'USD') => ({ id: `p${budget}${currency}`, title: 'Deal', budget: budget == null ? null : String(budget), currency, timeline: null });

    it('groups leads by stage, totals value per currency and splits open from won', async () => {
      db.lead.findMany.mockResolvedValue([
        lead('a', 'QUALIFIED', [proj(1000), proj(500)], 20),
        lead('b', 'QUALIFIED', [proj(2000, 'EUR')], 80),
        lead('c', 'DEAL_DISCUSSION', [proj(7000)], 50),
        lead('d', 'WON', [proj(3000)], 5),
        lead('e', 'INTERESTED', [], 40),
        lead('f', 'CONTACTED', [proj(900)]), // holds a deal but is in an earlier stage
      ]);
      const r = await service.getPipeline();

      const q = r.stages.find((s) => s.status === 'QUALIFIED')!;
      expect(q.count).toBe(2);
      expect(q.valueByCurrency).toEqual({ USD: 1500, EUR: 2000 });
      expect(q.items.map((i) => i.leadId)).toEqual(['b', 'a']); // highest priority first
      expect(r.stages.find((s) => s.status === 'INTERESTED')!.count).toBe(1);
      expect(r.totals.openValueByCurrency).toEqual({ USD: 8500, EUR: 2000 });
      expect(r.totals.wonValueByCurrency).toEqual({ USD: 3000 });
      expect(r.otherDealsInEarlierStages).toBe(1);
    });

    it('treats deals without a budget as zero value and excludes lost/restricted leads in the query', async () => {
      db.lead.findMany.mockResolvedValue([lead('a', 'QUALIFIED', [proj(null)])]);
      const r = await service.getPipeline();
      expect(r.stages.find((s) => s.status === 'QUALIFIED')!.valueByCurrency).toEqual({});
      expect(db.lead.findMany.mock.calls[0][0].where.NOT).toEqual({ status: { in: ['LOST', 'RESTRICTED'] } });
    });
  });
});
