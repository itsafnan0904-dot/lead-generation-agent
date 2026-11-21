import { decideAutoReply, resolveAutoReplyMode, ReplyGateInput } from './auto-reply-policy.util';
import { AutoReplyService } from './auto-reply.service';

const gate = (over: Partial<ReplyGateInput> = {}): ReplyGateInput => ({
  mode: 'auto', leadStatus: 'RESPONDED', aiControlState: 'AI_ACTIVE', autonomousOptIn: true,
  analysisRequiresHuman: false, intent: 'MORE_INFO_REQUESTED', contactEmail: 'a@b.com',
  replyAlreadyExists: false, autoRepliesSentLast24h: 0, maxAutoRepliesPerDay: 3, ...over,
});

describe('resolveAutoReplyMode (kill switch)', () => {
  it('defaults to draft, honours off/auto, and fails safe to off on unknown values', () => {
    expect(resolveAutoReplyMode(undefined)).toBe('draft');
    expect(resolveAutoReplyMode(' AUTO ')).toBe('auto');
    expect(resolveAutoReplyMode('off')).toBe('off');
    expect(resolveAutoReplyMode('yes please')).toBe('off');
  });
});

describe('decideAutoReply', () => {
  it('sends automatically only when every gate passes', () => {
    expect(decideAutoReply(gate())).toEqual({ action: 'AUTO_SEND' });
  });

  it('kill switch off skips everything', () => {
    expect(decideAutoReply(gate({ mode: 'off' }))).toEqual({ action: 'SKIP', reason: 'KILL_SWITCH_OFF' });
  });

  it.each([
    [{ leadStatus: 'RESTRICTED' }, 'LEAD_STATUS_RESTRICTED'],
    [{ leadStatus: 'WON' }, 'LEAD_STATUS_WON'],
    [{ aiControlState: 'PAUSED' }, 'AI_PAUSED'],
    [{ aiControlState: 'TAKEN_OVER' }, 'AI_TAKEN_OVER'],
    [{ analysisRequiresHuman: true }, 'AI_ANALYSIS_REQUIRES_HUMAN'],
    [{ intent: 'UNSUBSCRIBE' }, 'INTENT_UNSUBSCRIBE'],
    [{ intent: 'NOT_INTERESTED' }, 'INTENT_NOT_INTERESTED'],
    [{ contactEmail: null }, 'NO_CONTACT_EMAIL'],
    [{ replyAlreadyExists: true }, 'REPLY_ALREADY_DRAFTED'],
  ])('hard-skips %j', (over, reason) => {
    expect(decideAutoReply(gate(over as any))).toEqual({ action: 'SKIP', reason });
  });

  it('falls back to a draft for approval in draft mode, without opt-in, or past the per-lead cap', () => {
    expect(decideAutoReply(gate({ mode: 'draft' }))).toMatchObject({ action: 'DRAFT_FOR_APPROVAL', reason: 'DRAFT_MODE' });
    expect(decideAutoReply(gate({ autonomousOptIn: false }))).toMatchObject({ action: 'DRAFT_FOR_APPROVAL', reason: 'LEAD_NOT_OPTED_IN_TO_AUTONOMOUS' });
    expect(decideAutoReply(gate({ autoRepliesSentLast24h: 3 }))).toMatchObject({ action: 'DRAFT_FOR_APPROVAL', reason: 'PER_LEAD_DAILY_CAP_REACHED' });
  });
});

describe('AutoReplyService', () => {
  let db: any, ai: any, audit: any, notifications: any, outreach: any, seller: any, service: AutoReplyService;
  const lead = {
    id: 'l1', status: 'RESPONDED', aiControlState: 'AI_ACTIVE', assignedUserId: 'u1', metadata: { autonomousConversationMode: true },
    company: { name: 'Acme' }, primaryContact: { firstName: 'Sam', lastName: 'Lee', email: 's@acme.com' }, assignedUser: { name: 'Jane', email: 'j@x.com' },
  };
  const message = { id: 'm1', direction: 'INBOUND', conversationId: 'c1', subject: 'Pricing?', conversation: { gmailThreadId: 'thr-1' } };

  beforeEach(() => {
    process.env.AUTO_REPLY_MODE = 'auto';
    db = {
      lead: { findUnique: jest.fn().mockResolvedValue(lead) },
      message: { findUnique: jest.fn().mockResolvedValue(message), findMany: jest.fn().mockResolvedValue([{ direction: 'INBOUND', sentAt: new Date(), bodyText: 'Can you help?' }]) },
      outreachDraft: { findFirst: jest.fn().mockResolvedValue(null), count: jest.fn().mockResolvedValue(0), create: jest.fn().mockResolvedValue({ id: 'd1' }) },
    };
    ai = { generateEmail: jest.fn().mockResolvedValue({ data: { subject: 'x', bodyText: 'Happy to help', callToAction: 'Reply', rationale: 'r', personalizationPointsUsed: [] }, metadata: { actionId: 'a1' } }) };
    audit = { log: jest.fn().mockResolvedValue({}) };
    notifications = { create: jest.fn().mockResolvedValue([]) };
    outreach = { sendDraft: jest.fn().mockResolvedValue({}) };
    seller = { getContext: jest.fn().mockResolvedValue({ displayName: 'Jane', title: 'Founder', companyName: 'JD', tone: 'warm', signature: 'Jane', pitchContext: 'ctx' }) };
    service = new AutoReplyService({ client: db } as any, ai, audit, notifications, outreach, seller);
  });
  afterEach(() => { delete process.env.AUTO_REPLY_MODE; });

  const run = () => service.handleInboundMessage('l1', 'm1', { intent: 'MORE_INFO_REQUESTED' });

  it('does nothing at all when the kill switch is off', async () => {
    process.env.AUTO_REPLY_MODE = 'off';
    expect(await run()).toEqual({ action: 'SKIPPED', reason: 'KILL_SWITCH_OFF' });
    expect(db.lead.findUnique).not.toHaveBeenCalled();
    expect(ai.generateEmail).not.toHaveBeenCalled();
  });

  it('drafts a threaded "Re:" reply and sends it through sendDraft when all gates pass', async () => {
    expect(await run()).toEqual({ action: 'SENT', draftId: 'd1' });
    const data = db.outreachDraft.create.mock.calls[0][0].data;
    expect(data.subject).toBe('Re: Pricing?');
    expect(data.gmailThreadId).toBe('thr-1');
    expect(data.aiUsageMetadata).toMatchObject({ kind: 'AUTO_REPLY', inReplyToMessageId: 'm1' });
    expect(ai.generateEmail.mock.calls[0][0].isReply).toBe(true);
    expect(outreach.sendDraft).toHaveBeenCalledWith('d1');
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'AUTO_REPLY_SENT' }));
  });

  it('only drafts for approval (no send) in draft mode, and notifies the owner', async () => {
    process.env.AUTO_REPLY_MODE = 'draft';
    expect(await run()).toMatchObject({ action: 'DRAFTED', draftId: 'd1' });
    expect(outreach.sendDraft).not.toHaveBeenCalled();
    expect(notifications.create).toHaveBeenCalledWith(expect.objectContaining({ title: 'Reply Draft Ready for Approval', userId: 'u1' }));
  });

  it('drafts instead of sending when the lead has not been opted in to autonomous mode', async () => {
    db.lead.findUnique.mockResolvedValue({ ...lead, metadata: { autonomousConversationMode: false } });
    expect(await run()).toMatchObject({ action: 'DRAFTED', reason: 'LEAD_NOT_OPTED_IN_TO_AUTONOMOUS' });
    expect(outreach.sendDraft).not.toHaveBeenCalled();
  });

  it('never replies to a paused lead (e.g. just handed off to a human)', async () => {
    db.lead.findUnique.mockResolvedValue({ ...lead, aiControlState: 'PAUSED' });
    expect(await run()).toEqual({ action: 'SKIPPED', reason: 'AI_PAUSED' });
    expect(ai.generateEmail).not.toHaveBeenCalled();
  });

  it('keeps the draft and alerts a human when sendDraft refuses (limits, hours, restriction)', async () => {
    outreach.sendDraft.mockRejectedValue(new Error('Sending refused: daily limit'));
    const r = await run();
    expect(r).toMatchObject({ action: 'FAILED', draftId: 'd1' });
    expect(notifications.create).toHaveBeenCalledWith(expect.objectContaining({ priority: 'ACTION_REQUIRED', title: 'Auto-Reply Not Sent: Review Needed' }));
  });

  it('survives AI failures without throwing or sending', async () => {
    ai.generateEmail.mockRejectedValue(new Error('openai down'));
    expect(await run()).toMatchObject({ action: 'FAILED' });
    expect(outreach.sendDraft).not.toHaveBeenCalled();
  });

  it('skips when a reply for this message already exists', async () => {
    db.outreachDraft.findFirst.mockResolvedValue({ id: 'old' });
    expect(await run()).toEqual({ action: 'SKIPPED', reason: 'REPLY_ALREADY_DRAFTED' });
  });
});
