import { decideFollowUp, resolveFollowUpMode, FollowUpGateInput } from './follow-up-policy.util';
import { FollowUpService } from './follow-up.service';
import { isFollowUpAutomationEnabled, getFollowUpScanIntervalMinutes } from '../jobs/follow-up.jobs';

const NOW = new Date('2026-09-20T12:00:00Z');
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000);

const gate = (over: Partial<FollowUpGateInput> = {}): FollowUpGateInput => ({
  mode: 'auto', leadStatus: 'CONTACTED', aiControlState: 'AI_ACTIVE', autonomousOptIn: true, contactEmail: 'a@b.com',
  lastOutboundAt: daysAgo(4), lastInboundAt: null, now: NOW, afterDays: 3, followUpsSent: 0, maxFollowUps: 2,
  hasPendingFollowUpDraft: false, ...over,
});

describe('resolveFollowUpMode', () => {
  it('defaults to draft and fails safe to off on unknown values', () => {
    expect(resolveFollowUpMode(undefined, 'auto')).toBe('draft');
    expect(resolveFollowUpMode('auto', 'auto')).toBe('auto');
    expect(resolveFollowUpMode('banana', 'auto')).toBe('off');
  });
  it('is capped by the global AUTO_REPLY_MODE kill switch', () => {
    expect(resolveFollowUpMode('auto', 'off')).toBe('off');
    expect(resolveFollowUpMode('draft', 'off')).toBe('off');
    expect(resolveFollowUpMode('auto', 'draft')).toBe('draft');
  });
});

describe('decideFollowUp', () => {
  it('auto-sends follow-up #1 to a quiet, opted-in lead', () => {
    expect(decideFollowUp(gate())).toEqual({ action: 'AUTO_SEND', followUpNumber: 1, isFinal: false });
  });
  it('marks the last allowed follow-up as final', () => {
    expect(decideFollowUp(gate({ followUpsSent: 1 }))).toEqual({ action: 'AUTO_SEND', followUpNumber: 2, isFinal: true });
  });
  it.each([
    [{ mode: 'off' }, 'KILL_SWITCH_OFF'],
    [{ leadStatus: 'COLD_LEAD' }, 'LEAD_STATUS_COLD_LEAD'],
    [{ leadStatus: 'RESTRICTED' }, 'LEAD_STATUS_RESTRICTED'],
    [{ aiControlState: 'PAUSED' }, 'AI_PAUSED'],
    [{ contactEmail: null }, 'NO_CONTACT_EMAIL'],
    [{ lastOutboundAt: null }, 'NO_OUTBOUND_MESSAGE_YET'],
    [{ lastInboundAt: daysAgo(1) }, 'CLIENT_SPOKE_LAST'],
    [{ followUpsSent: 2 }, 'MAX_FOLLOW_UPS_REACHED'],
    [{ hasPendingFollowUpDraft: true }, 'FOLLOW_UP_DRAFT_ALREADY_PENDING'],
    [{ lastOutboundAt: daysAgo(2) }, 'NOT_QUIET_LONG_ENOUGH'],
  ])('skips %j', (over, reason) => {
    expect(decideFollowUp(gate(over as any))).toEqual({ action: 'SKIP', reason });
  });
  it('treats a client reply after our last message as not quiet, but an older reply as quiet', () => {
    expect(decideFollowUp(gate({ lastInboundAt: daysAgo(10) })).action).toBe('AUTO_SEND');
  });
  it('only drafts in draft mode or without the per-lead opt-in', () => {
    expect(decideFollowUp(gate({ mode: 'draft' }))).toMatchObject({ action: 'DRAFT_FOR_APPROVAL', reason: 'DRAFT_MODE' });
    expect(decideFollowUp(gate({ autonomousOptIn: false }))).toMatchObject({ action: 'DRAFT_FOR_APPROVAL', reason: 'LEAD_NOT_OPTED_IN_TO_AUTONOMOUS' });
  });
});

describe('job switches', () => {
  it('follow-up automation is OFF unless explicitly enabled', () => {
    expect(isFollowUpAutomationEnabled(undefined)).toBe(false);
    expect(isFollowUpAutomationEnabled('')).toBe(false);
    expect(isFollowUpAutomationEnabled('true')).toBe(true);
    expect(isFollowUpAutomationEnabled('1')).toBe(true);
  });
  it('falls back to a 60 minute scan interval on bad input', () => {
    expect(getFollowUpScanIntervalMinutes('abc')).toBe(60);
    expect(getFollowUpScanIntervalMinutes('-5')).toBe(60);
    expect(getFollowUpScanIntervalMinutes('15')).toBe(15);
  });
});

describe('FollowUpService.scanAndProcess', () => {
  let db: any, ai: any, audit: any, notifications: any, outreach: any, seller: any, service: FollowUpService;
  const lead = (id: string, over: any = {}) => ({
    id, status: 'CONTACTED', aiControlState: 'AI_ACTIVE', assignedUserId: 'u1', metadata: { autonomousConversationMode: true },
    company: { name: `Co ${id}`, industry: 'Retail' }, primaryContact: { firstName: 'Sam', lastName: 'Lee', email: `${id}@x.com` },
    assignedUser: { name: 'Jane', email: 'j@x.com' }, ...over,
  });
  const sentDraft = (leadId: string, days: number, kind?: string) => ({
    leadId, status: 'SENT', sentAt: new Date(Date.now() - days * 86_400_000), subject: 'Intro', gmailThreadId: `thr-${leadId}`,
    aiUsageMetadata: kind ? { kind } : {},
  });

  beforeEach(() => {
    process.env.AUTO_REPLY_MODE = 'auto';
    process.env.FOLLOW_UP_MODE = 'auto';
    db = {
      lead: { findMany: jest.fn().mockResolvedValue([lead('a')]) },
      message: { findMany: jest.fn().mockResolvedValue([]) },
      outreachDraft: { findMany: jest.fn().mockResolvedValue([sentDraft('a', 5)]), create: jest.fn().mockResolvedValue({ id: 'd1' }) },
    };
    ai = { generateEmail: jest.fn().mockResolvedValue({ data: { subject: 'x', bodyText: 'Just checking in', callToAction: 'Reply', rationale: 'r', personalizationPointsUsed: [] }, metadata: {} }) };
    audit = { log: jest.fn().mockResolvedValue({}) };
    notifications = { create: jest.fn().mockResolvedValue([]) };
    outreach = { sendDraft: jest.fn().mockResolvedValue({}) };
    seller = { getContext: jest.fn().mockResolvedValue(null) };
    service = new FollowUpService({ client: db } as any, ai, audit, notifications, outreach, seller);
  });
  afterEach(() => { delete process.env.AUTO_REPLY_MODE; delete process.env.FOLLOW_UP_MODE; });

  it('does nothing when switched off', async () => {
    process.env.AUTO_REPLY_MODE = 'off';
    const r = await service.scanAndProcess(new Date());
    expect(r.mode).toBe('off');
    expect(db.lead.findMany).not.toHaveBeenCalled();
  });

  it('drafts a threaded follow-up and sends it via sendDraft for a quiet, opted-in lead', async () => {
    const r = await service.scanAndProcess(new Date());
    expect(r).toMatchObject({ considered: 1, sent: 1, drafted: 0, failed: 0 });
    const data = db.outreachDraft.create.mock.calls[0][0].data;
    expect(data.subject).toBe('Re: Intro');
    expect(data.gmailThreadId).toBe('thr-a');
    expect(data.aiUsageMetadata).toMatchObject({ kind: 'AUTO_FOLLOW_UP', followUpNumber: 1 });
    expect(ai.generateEmail.mock.calls[0][0]).toMatchObject({ isFollowUp: true, followUpIsFinal: false });
    expect(outreach.sendDraft).toHaveBeenCalledWith('d1');
  });

  it('counts earlier follow-ups, flags the last one as final, and stops at the cap', async () => {
    db.outreachDraft.findMany.mockResolvedValue([sentDraft('a', 4), sentDraft('a', 8, 'FOLLOW_UP')]);
    await service.scanAndProcess(new Date());
    expect(ai.generateEmail.mock.calls[0][0].followUpIsFinal).toBe(true);

    ai.generateEmail.mockClear();
    db.outreachDraft.findMany.mockResolvedValue([sentDraft('a', 4), sentDraft('a', 8, 'FOLLOW_UP'), sentDraft('a', 12, 'AUTO_FOLLOW_UP')]);
    const r = await service.scanAndProcess(new Date());
    expect(r.skipped).toBe(1);
    expect(ai.generateEmail).not.toHaveBeenCalled();
  });

  it('skips leads where the client answered after our last message', async () => {
    db.message.findMany.mockResolvedValue([{ direction: 'INBOUND', sentAt: new Date(), conversation: { leadId: 'a', gmailThreadId: 't', subject: 's' } }]);
    const r = await service.scanAndProcess(new Date());
    expect(r.skipped).toBe(1);
    expect(ai.generateEmail).not.toHaveBeenCalled();
  });

  it('only drafts in draft mode, notifying the owner, and never sends', async () => {
    process.env.FOLLOW_UP_MODE = 'draft';
    const r = await service.scanAndProcess(new Date());
    expect(r).toMatchObject({ drafted: 1, sent: 0 });
    expect(outreach.sendDraft).not.toHaveBeenCalled();
    expect(notifications.create).toHaveBeenCalledWith(expect.objectContaining({ title: 'Follow-Up Draft Ready for Approval' }));
  });

  it('alerts a human and keeps the draft when sendDraft refuses; one bad lead does not stop the scan', async () => {
    db.lead.findMany.mockResolvedValue([lead('a'), lead('b')]);
    db.outreachDraft.findMany.mockResolvedValue([sentDraft('a', 5), sentDraft('b', 5)]);
    outreach.sendDraft.mockRejectedValueOnce(new Error('daily limit')).mockResolvedValueOnce({});
    const r = await service.scanAndProcess(new Date());
    expect(r).toMatchObject({ considered: 2, failed: 1, sent: 1 });
    expect(notifications.create).toHaveBeenCalledWith(expect.objectContaining({ title: 'Follow-Up Not Sent: Review Needed' }));
  });

  it('counts AI failures without throwing', async () => {
    ai.generateEmail.mockRejectedValue(new Error('openai down'));
    const r = await service.scanAndProcess(new Date());
    expect(r.failed).toBe(1);
    expect(outreach.sendDraft).not.toHaveBeenCalled();
  });
});
