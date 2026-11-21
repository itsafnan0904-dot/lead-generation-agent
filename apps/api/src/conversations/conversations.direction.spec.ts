import { ConversationsService } from './conversations.service';
import { MessageDirection } from '@ai-sales-agent/database';

describe('ConversationsService: own mail vs client replies, and thread matching', () => {
  let db: any, gmail: any, ai: any, restrictions: any, audit: any, notifications: any, handoff: any, autoReply: any;
  let service: ConversationsService;

  const lead = { id: 'lead-1', status: 'CONTACTED', aiControlState: 'AI_ACTIVE', companyId: 'c1', primaryContactId: 'ct1', assignedUserId: 'u1', metadata: {}, company: { name: 'Harbor & Pine' } };
  const sentDraft = { id: 'd1', gmailThreadId: 'thread-1', status: 'SENT', lead };
  const msg = (over: any = {}) => ({
    id: 'gm-1', threadId: 'thread-1', from: 'Client <client@gmail.com>', to: 'Seller <seller@gmail.com>',
    subject: 'Re: Hello', date: new Date().toUTCString(), bodyText: 'Could you tell me more?', ...over,
  });

  beforeEach(() => {
    db = {
      contact: { findUnique: jest.fn().mockResolvedValue(null) },
      lead: { findUnique: jest.fn().mockResolvedValue({ id: 'lead-1', status: 'CONTACTED' }), update: jest.fn() },
      conversation: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockImplementation(async (a: any) => ({ id: 'conv-1', ...a.create })),
      },
      message: { findUnique: jest.fn(), create: jest.fn().mockImplementation(async (a: any) => ({ id: 'm1', ...a.data })), update: jest.fn() },
      outreachDraft: { findFirst: jest.fn().mockResolvedValue(null) },
      humanReview: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn() },
    };
    gmail = { getActiveAccountEmail: jest.fn().mockResolvedValue('seller@gmail.com') };
    ai = { analyzeReply: jest.fn().mockResolvedValue({ data: { intent: 'MORE_INFO_REQUESTED', sentiment: 'POSITIVE' }, metadata: { actionId: 'a1' } }) };
    restrictions = { evaluate: jest.fn().mockResolvedValue({ result: 'CLEAR' }) };
    audit = { log: jest.fn().mockResolvedValue({}) };
    notifications = { create: jest.fn().mockResolvedValue([]) };
    handoff = { handleInboundMessage: jest.fn().mockResolvedValue({ handedOff: false }) };
    autoReply = { handleInboundMessage: jest.fn().mockResolvedValue({ action: 'SKIPPED' }) };
    service = new ConversationsService({ client: db } as any, gmail, ai, restrictions, audit, notifications, handoff, autoReply);
  });

  it('stores mail sent by the connected mailbox as OUTBOUND and runs no client-reply processing', async () => {
    db.outreachDraft.findFirst.mockResolvedValue(sentDraft);
    const r = await service.ingestSingleInboundMessage(msg({ from: 'Seller <SELLER@gmail.com>', to: 'client@gmail.com' }));
    expect(db.message.create.mock.calls[0][0].data.direction).toBe(MessageDirection.OUTBOUND);
    expect(r.aiAnalysisPerformed).toBe(false);
    expect(ai.analyzeReply).not.toHaveBeenCalled();
    expect(restrictions.evaluate).not.toHaveBeenCalled();
    expect(handoff.handleInboundMessage).not.toHaveBeenCalled();
    expect(autoReply.handleInboundMessage).not.toHaveBeenCalled();
    expect(r.leadId).toBe('lead-1'); // still attached to the right lead through its outreach thread
  });

  it('treats the Gmail SENT label as our own mail even when the address check cannot run', async () => {
    gmail.getActiveAccountEmail.mockRejectedValue(new Error('db down'));
    await service.ingestSingleInboundMessage(msg({ from: 'someone@else.com', labelIds: ['SENT'] }));
    expect(db.message.create.mock.calls[0][0].data.direction).toBe(MessageDirection.OUTBOUND);
    expect(ai.analyzeReply).not.toHaveBeenCalled();
  });

  it('a lookup failure never turns a client reply into "our own mail"', async () => {
    gmail.getActiveAccountEmail.mockRejectedValue(new Error('db down'));
    db.outreachDraft.findFirst.mockResolvedValue(sentDraft);
    await service.ingestSingleInboundMessage(msg());
    expect(db.message.create.mock.calls[0][0].data.direction).toBe(MessageDirection.INBOUND);
    expect(ai.analyzeReply).toHaveBeenCalled();
  });

  it('does not guess a lead for our own unplaceable mail from the sender address', async () => {
    db.contact.findUnique.mockResolvedValue({ leads: [lead] });
    const r = await service.ingestSingleInboundMessage(msg({ from: 'seller@gmail.com' }));
    expect(r.leadId).toBeNull();
    expect(r.assignmentStatus).toBe('NEEDS_HUMAN_ASSIGNMENT');
    expect(db.contact.findUnique).not.toHaveBeenCalled();
  });

  it('attaches a client reply to the lead whose outreach started the thread, even from an unrelated address', async () => {
    db.outreachDraft.findFirst.mockResolvedValue(sentDraft);
    const r = await service.ingestSingleInboundMessage(msg({ from: 'Test Mailbox <tester@gmail.com>' }));
    expect(db.outreachDraft.findFirst.mock.calls[0][0].where).toEqual({ gmailThreadId: 'thread-1', status: 'SENT' });
    expect(r.leadId).toBe('lead-1');
    expect(r.assignmentStatus).toBe('ASSIGNED');
    expect(db.message.create.mock.calls[0][0].data.direction).toBe(MessageDirection.INBOUND);
    expect(ai.analyzeReply).toHaveBeenCalled();
    expect(handoff.handleInboundMessage).toHaveBeenCalledWith('lead-1', 'm1');
  });

  it('ignores the thread match for a closed (won/lost/restricted) lead and falls back to the sender', async () => {
    db.outreachDraft.findFirst.mockResolvedValue({ ...sentDraft, lead: { ...lead, status: 'LOST' } });
    const r = await service.ingestSingleInboundMessage(msg());
    expect(r.leadId).toBeNull();
    expect(r.assignmentStatus).toBe('NEEDS_HUMAN_ASSIGNMENT');
  });

  it('an existing conversation attachment still wins over everything else', async () => {
    db.conversation.findUnique.mockResolvedValue({ id: 'conv-9', leadId: 'lead-1', lead, metadata: {} });
    await service.ingestSingleInboundMessage(msg());
    expect(db.outreachDraft.findFirst).not.toHaveBeenCalled();
  });
});
