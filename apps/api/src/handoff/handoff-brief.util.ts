export interface BriefMessage {
  direction: 'INBOUND' | 'OUTBOUND';
  sentAt: Date;
  text: string;
}

export interface BriefInput {
  companyName: string;
  contactName: string | null;
  contactTitle: string | null;
  status: string;
  fitScore: number;
  readinessScore: number;
  priorityLabel: string;
  reasons: string[];
  qualification: {
    budgetFit: boolean | null;
    authorityFit: boolean | null;
    needFit: boolean | null;
    timelineFit: boolean | null;
    technicalFit: boolean | null;
    fitSummary: string | null;
  } | null;
  projectBudget: { amount: number; currency: string } | null;
  messages: BriefMessage[]; // oldest -> newest
}

export interface HandoffBrief {
  headline: string;
  reasons: string[];
  situation: string[];
  qualification: string[];
  recentMessages: { direction: string; sentAt: string; excerpt: string }[];
  suggestedFocus: string[];
}

const excerpt = (t: string, n = 280) => {
  const clean = t.replace(/\s+/g, ' ').trim();
  return clean.length > n ? `${clean.slice(0, n)}…` : clean;
};

const yn = (v: boolean | null) => (v === true ? 'Yes' : v === false ? 'No' : 'Unknown');

/** Where the conversation stands, per handoff reason, so the human knows what to do first. */
function focusFor(reason: string): string | null {
  const r = reason.toLowerCase();
  if (r.includes('pricing')) return 'Answer the pricing question with a clear figure or range, and confirm scope first.';
  if (r.includes('contract') || r.includes('legal')) return 'Review the contract/legal point yourself; do not let the AI commit to terms.';
  if (r.includes('call') || r.includes('meeting')) return 'Propose specific meeting times and send a calendar invite.';
  if (r.includes('objection')) return 'Address the concern directly and acknowledge it before pitching again.';
  if (r.includes('deal value')) return 'High-value deal: confirm scope, budget and decision-makers personally.';
  if (r.includes('readiness')) return 'Lead looks ready to close: move toward a proposal or next commitment.';
  if (r.includes('contains')) return 'Read the flagged message carefully and respond to that point.';
  if (r.includes('review')) return 'Resolve the pending human review before engaging further.';
  return null;
}

/**
 * Deterministic handoff brief: what the AI knows, why you were pulled in, and what to do first.
 * No AI call, so it is instant, free and cannot fail or hallucinate.
 */
export function buildHandoffBrief(input: BriefInput): HandoffBrief {
  const who = input.contactName ? `${input.contactName}${input.contactTitle ? ` (${input.contactTitle})` : ''}` : 'no named contact';

  const situation = [
    `Company: ${input.companyName}`,
    `Contact: ${who}`,
    `Stage: ${input.status.replace(/_/g, ' ')}`,
    `Fit score ${input.fitScore}/100 · Deal readiness ${input.readinessScore}/100 · Priority ${input.priorityLabel}`,
  ];
  if (input.projectBudget) situation.push(`Known budget: ${input.projectBudget.currency} ${input.projectBudget.amount}`);

  const qualification: string[] = [];
  if (input.qualification) {
    const q = input.qualification;
    qualification.push(
      `Budget: ${yn(q.budgetFit)}`, `Authority: ${yn(q.authorityFit)}`, `Need: ${yn(q.needFit)}`,
      `Timeline: ${yn(q.timelineFit)}`, `Technical fit: ${yn(q.technicalFit)}`,
    );
    if (q.fitSummary) qualification.push(`Summary: ${q.fitSummary}`);
  }

  const focus = [...new Set(input.reasons.map(focusFor).filter((f): f is string => !!f))];

  return {
    headline: input.reasons.length
      ? `${input.companyName} needs you: ${input.reasons[0]}`
      : `${input.companyName}: conversation summary`,
    reasons: input.reasons,
    situation,
    qualification,
    recentMessages: input.messages.slice(-5).map((m) => ({
      direction: m.direction,
      sentAt: m.sentAt.toISOString(),
      excerpt: excerpt(m.text),
    })),
    suggestedFocus: focus,
  };
}
