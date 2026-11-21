import { HandoffService } from './handoff.service';
import { buildHandoffBrief } from './handoff-brief.util';
import { LeadPriorityService } from '../leads/services/lead-priority.service';

describe('buildHandoffBrief', () => {
  const base = {
    companyName: 'Acme', contactName: 'Sam Lee', contactTitle: 'CTO', status: 'RESPONDED', fitScore: 70,
    readinessScore: 40, priorityLabel: 'WARM', reasons: ['Client is asking about pricing'],
    qualification: { budgetFit: true, authorityFit: null, needFit: false, timelineFit: true, technicalFit: true, fitSummary: 'Good fit' },
    projectBudget: { amount: 12000, currency: 'USD' },
    messages: Array.from({ length: 7 }, (_, i) => ({
      direction: (i % 2 ? 'OUTBOUND' : 'INBOUND') as 'INBOUND' | 'OUTBOUND',
      sentAt: new Date(2026, 8, i + 1), text: `message ${i} ${'x'.repeat(400)}`,
    })),
  };

  it('summarises situation, qualification, reasons and what to do first', () => {
    const b = buildHandoffBrief(base);
    expect(b.headline).toBe('Acme needs you: Client is asking about pricing');
    expect(b.situation).toEqual(expect.arrayContaining(['Contact: Sam Lee (CTO)', 'Stage: RESPONDED', 'Known budget: USD 12000']));
    expect(b.qualification).toEqual(expect.arrayContaining(['Budget: Yes', 'Authority: Unknown', 'Need: No']));
    expect(b.suggestedFocus[0]).toMatch(/pricing/i);
  });

  it('keeps only the last five messages, truncated', () => {
    const b = buildHandoffBrief(base);
    expect(b.recentMessages).toHaveLength(5);
    expect(b.recentMessages[4].excerpt.startsWith('message 6')).toBe(true);
    expect(b.recentMessages[0].excerpt.length).toBeLessThanOrEqual(281);
  });

  it('copes with no contact, qualification or reasons', () => {
    const b = buildHandoffBrief({ ...base, contactName: null, qualification: null, projectBudget: null, reasons: [], messages: [] });
    expect(b.headline).toBe('Acme: conversation summary');
    expect(b.situation).toContain('Contact: no named contact');
    expect(b.qualification).toEqual([]);
    expect(b.suggestedFocus).toEqual([]);
  });
});

describe('HandoffService.handleInboundMessage', () => {
  let db: any, audit: any, notifications: any, priority: any, service: HandoffService;
  const lead = { id: 'l1', status: 'RESPONDED', aiControlState: 'AI_ACTIVE', scoreTotal: 60, assignedUserId: 'u1', metadata: { keep: 1 } };
  const needsHuman = { needsHuman: true, humanReasons: ['Client is asking about pricing'], readinessScore: 50, priorityLabel: 'WARM' };

  beforeEach(() => {
    db = {
      lead: {
        findUnique: jest.fn().mockImplementation(async (args: any) =>
          args.include ? { ...lead, company: { name: 'Acme' }, primaryContact: null, qualifications: [], projects: [], conversations: [] } : lead),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    audit = { log: jest.fn().mockResolvedValue({}) };
    notifications = { create: jest.fn().mockResolvedValue([]) };
    priority = { enrich: jest.fn().mockImplementation(async (ls: any[]) => ls.map((l) => ({ ...l, priority: needsHuman }))) };
    service = new HandoffService({ client: db } as any, priority as LeadPriorityService, audit, notifications);
  });

  it('pauses the AI, stores the brief, audits and notifies the lead owner', async () => {
    const r = await service.handleInboundMessage('l1', 'm1');
    expect(r.handedOff).toBe(true);
    const data = db.lead.update.mock.calls[0][0].data;
    expect(data.aiControlState).toBe('PAUSED');
    expect(data.metadata.keep).toBe(1);
    expect(data.metadata.handoff.messageId).toBe('m1');
    expect(data.metadata.handoff.reasons).toEqual(['Client is asking about pricing']);
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'LEAD_AI_HANDOFF', entityId: 'l1' }));
    expect(notifications.create).toHaveBeenCalledWith(expect.objectContaining({ priority: 'ACTION_REQUIRED', userId: 'u1' }));
  });

  it('does nothing when no intervention rule fires', async () => {
    priority.enrich.mockImplementation(async (ls: any[]) => ls.map((l) => ({ ...l, priority: { ...needsHuman, needsHuman: false, humanReasons: [] } })));
    expect(await service.handleInboundMessage('l1', 'm1')).toEqual({ handedOff: false, reason: 'NO_TRIGGER' });
    expect(db.lead.update).not.toHaveBeenCalled();
    expect(notifications.create).not.toHaveBeenCalled();
  });

  it('leaves leads the human already paused or took over alone', async () => {
    db.lead.findUnique.mockResolvedValue({ ...lead, aiControlState: 'TAKEN_OVER' });
    expect(await service.handleInboundMessage('l1', 'm1')).toEqual({ handedOff: false, reason: 'AI_NOT_ACTIVE' });
    expect(db.lead.update).not.toHaveBeenCalled();
  });

  it('is idempotent per message and tolerates a missing lead', async () => {
    db.lead.findUnique.mockResolvedValue({ ...lead, metadata: { handoff: { messageId: 'm1' } } });
    expect(await service.handleInboundMessage('l1', 'm1')).toEqual({ handedOff: false, reason: 'ALREADY_HANDLED' });
    db.lead.findUnique.mockResolvedValue(null);
    expect(await service.handleInboundMessage('nope', 'm1')).toEqual({ handedOff: false, reason: 'LEAD_NOT_FOUND' });
  });
});
