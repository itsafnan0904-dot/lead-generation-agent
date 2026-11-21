import { computeLeadPriority, PriorityInput } from './lead-priority.util';
import { LeadLifecycleStatus, AIControlState } from '@ai-sales-agent/database';

const NOW = new Date('2026-09-20T12:00:00Z');
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000);

const base = (over: Partial<PriorityInput> = {}): PriorityInput => ({
  status: LeadLifecycleStatus.COLD_LEAD,
  aiControlState: AIControlState.AI_ACTIVE,
  scoreTotal: 0,
  qualification: null,
  inboundCount: 0,
  outboundCount: 0,
  lastInboundAt: null,
  latestInboundText: null,
  hasPendingHumanReview: false,
  maxProjectBudget: null,
  interventionRules: [],
  now: NOW,
  ...over,
});

const fullQual = { budgetFit: true, authorityFit: true, needFit: true, timelineFit: true, technicalFit: true };

describe('computeLeadPriority', () => {
  it('rates a fresh unscored lead cold and not ready, suggesting scoring', () => {
    const r = computeLeadPriority(base());
    expect(r.priorityLabel).toBe('COLD');
    expect(r.readinessLabel).toBe('NOT_READY');
    expect(r.needsHuman).toBe(false);
    expect(r.nextAction).toBe('Score this lead');
  });

  it('ranks a qualified, engaged, recently replying lead as HOT and READY', () => {
    const r = computeLeadPriority(base({
      status: LeadLifecycleStatus.QUALIFIED, scoreTotal: 85, qualification: fullQual,
      inboundCount: 3, outboundCount: 3, lastInboundAt: hoursAgo(5),
    }));
    expect(r.readinessScore).toBeGreaterThanOrEqual(75);
    expect(r.readinessLabel).toBe('READY');
    expect(r.priorityLabel).toBe('HOT');
  });

  it('uses only true qualification fits and keeps scores within 0-100', () => {
    const r = computeLeadPriority(base({
      status: LeadLifecycleStatus.GATHERING_REQUIREMENTS, scoreTotal: 500,
      qualification: { budgetFit: true, authorityFit: false, needFit: null, timelineFit: true, technicalFit: true },
    }));
    expect(r.breakdown.qualification).toBe(60);
    expect(r.breakdown.fit).toBe(100);
    expect(r.priorityScore).toBeLessThanOrEqual(100);
  });

  it('decays recency with the age of the last inbound reply', () => {
    const recent = computeLeadPriority(base({ status: LeadLifecycleStatus.RESPONDED, inboundCount: 1, lastInboundAt: hoursAgo(10) }));
    const stale = computeLeadPriority(base({ status: LeadLifecycleStatus.RESPONDED, inboundCount: 1, lastInboundAt: hoursAgo(24 * 20) }));
    expect(recent.breakdown.recency).toBe(100);
    expect(stale.breakdown.recency).toBe(20);
    expect(recent.priorityScore).toBeGreaterThan(stale.priorityScore);
  });

  it('flags a human only for triggers the seller configured', () => {
    const msg = 'Thanks! Could you send a quote and set up a call?';
    const none = computeLeadPriority(base({ status: LeadLifecycleStatus.RESPONDED, inboundCount: 1, latestInboundText: msg }));
    expect(none.needsHuman).toBe(false);

    const withRules = computeLeadPriority(base({
      status: LeadLifecycleStatus.RESPONDED, inboundCount: 1, lastInboundAt: hoursAgo(1), latestInboundText: msg,
      interventionRules: [{ trigger: 'PRICING_DISCUSSION' }, { trigger: 'MEETING_REQUESTED' }],
    }));
    expect(withRules.needsHuman).toBe(true);
    expect(withRules.humanReasons).toEqual(['Client is asking about pricing', 'Client wants a call or meeting']);
    expect(withRules.nextAction).toContain('Step in personally');
    expect(withRules.priorityScore).toBeGreaterThan(none.priorityScore);
  });

  it('applies readiness, deal value and keyword thresholds', () => {
    const r = computeLeadPriority(base({
      status: LeadLifecycleStatus.DEAL_DISCUSSION, scoreTotal: 90, qualification: fullQual, inboundCount: 3,
      maxProjectBudget: 50000, latestInboundText: 'We need an NDA first',
      interventionRules: [
        { trigger: 'READINESS_ABOVE', threshold: 80 },
        { trigger: 'DEAL_VALUE_ABOVE', threshold: 20000 },
        { trigger: 'CUSTOM_KEYWORD', keyword: 'nda' },
        { trigger: 'DEAL_VALUE_ABOVE', threshold: 100000 },
      ],
    }));
    expect(r.humanReasons).toHaveLength(3);
    expect(r.humanReasons.join(' ')).toContain('50000');
    expect(r.humanReasons.join(' ')).toContain('“nda”');
  });

  it('flags a pending human review', () => {
    const r = computeLeadPriority(base({ status: LeadLifecycleStatus.INTERESTED, hasPendingHumanReview: true }));
    expect(r.needsHuman).toBe(true);
    expect(r.humanReasons).toEqual(['A human review is pending']);
  });

  it('marks restricted leads BLOCKED and closed leads CLOSED with zero priority', () => {
    const blocked = computeLeadPriority(base({ status: LeadLifecycleStatus.RESTRICTED, scoreTotal: 95, hasPendingHumanReview: true }));
    expect(blocked.priorityLabel).toBe('BLOCKED');
    expect(blocked.priorityScore).toBe(0);
    expect(blocked.readinessScore).toBe(0);
    expect(blocked.nextAction).toBe('Resolve the restriction review');

    const won = computeLeadPriority(base({ status: LeadLifecycleStatus.WON, scoreTotal: 90 }));
    expect(won.priorityLabel).toBe('CLOSED');
    expect(won.readinessScore).toBe(100);
    expect(won.needsHuman).toBe(false);
  });

  it('reflects takeover / pause in the suggested next action', () => {
    expect(computeLeadPriority(base({ scoreTotal: 40, aiControlState: AIControlState.TAKEN_OVER })).nextAction).toMatch(/taken over/);
    expect(computeLeadPriority(base({ scoreTotal: 40, aiControlState: AIControlState.PAUSED })).nextAction).toMatch(/paused/);
  });
});
