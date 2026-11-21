import { LeadLifecycleStatus, AIControlState } from '@ai-sales-agent/database';

export type PriorityLabel = 'HOT' | 'WARM' | 'COOL' | 'COLD' | 'BLOCKED' | 'CLOSED';
export type ReadinessLabel = 'READY' | 'ADVANCING' | 'EARLY' | 'NOT_READY';

export interface InterventionRuleInput {
  trigger: string;
  threshold?: number | null;
  keyword?: string | null;
}

export interface PriorityInput {
  status: LeadLifecycleStatus;
  aiControlState: AIControlState;
  /** Fit score 0-100 (Lead.scoreTotal). */
  scoreTotal: number;
  qualification: {
    budgetFit: boolean | null;
    authorityFit: boolean | null;
    needFit: boolean | null;
    timelineFit: boolean | null;
    technicalFit: boolean | null;
  } | null;
  inboundCount: number;
  outboundCount: number;
  lastInboundAt: Date | null;
  latestInboundText: string | null;
  hasPendingHumanReview: boolean;
  maxProjectBudget: number | null;
  interventionRules: InterventionRuleInput[];
  now?: Date;
}

export interface PriorityResult {
  priorityScore: number;
  priorityLabel: PriorityLabel;
  readinessScore: number;
  readinessLabel: ReadinessLabel;
  needsHuman: boolean;
  humanReasons: string[];
  nextAction: string;
  breakdown: {
    fit: number;
    stage: number;
    qualification: number;
    engagement: number;
    recency: number;
  };
}

const STAGE_SCORE: Record<string, number> = {
  COLD_LEAD: 5,
  CONTACTED: 15,
  FOLLOW_UP_REQUIRED: 25,
  RESPONDED: 30,
  WAITING_FOR_CLIENT: 35,
  INTERESTED: 45,
  GATHERING_REQUIREMENTS: 60,
  QUALIFIED: 80,
  DEAL_DISCUSSION: 92,
  HUMAN_REVIEW: 20,
  WON: 100,
  LOST: 0,
  RESTRICTED: 0,
};

/** Message-text detectors for conversation-based intervention triggers. */
const TEXT_TRIGGERS: Record<string, { re: RegExp; reason: string }> = {
  PRICING_DISCUSSION: {
    re: /\b(price|prices|pricing|quote|quotation|cost|costs|how much|rates?|proposal|estimate)\b/i,
    reason: 'Client is asking about pricing',
  },
  CONTRACT_OR_LEGAL: {
    re: /\b(contract|agreement|nda|terms and conditions|legal|msa|sow|liability)\b/i,
    reason: 'Contract or legal terms mentioned',
  },
  MEETING_REQUESTED: {
    re: /\b(call|meeting|meet|demo|zoom|teams|schedule|calendar|catch up)\b/i,
    reason: 'Client wants a call or meeting',
  },
  OBJECTION_RAISED: {
    re: /\b(too expensive|not interested|concern|concerned|competitor|already (have|use)|not sure|worried|hesitant)\b/i,
    reason: 'Client raised an objection',
  },
};

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));
const DAY = 86_400_000;

/**
 * Deterministic, explainable lead prioritisation. No AI involved: the same inputs always give the
 * same scores, and every human-handoff reason is spelled out.
 *
 * readiness = 50% pipeline stage + 30% qualification checklist + 20% engagement
 * priority  = 35% fit + 40% readiness + 15% reply recency (+10 when a human is needed)
 */
export function computeLeadPriority(input: PriorityInput): PriorityResult {
  const now = input.now ?? new Date();

  // ------------------------------------------------------------ readiness
  const stage = STAGE_SCORE[input.status] ?? 0;

  let qualification = 0;
  if (input.qualification) {
    const q = input.qualification;
    const fits = [q.budgetFit, q.authorityFit, q.needFit, q.timelineFit, q.technicalFit];
    qualification = (fits.filter((f) => f === true).length / fits.length) * 100;
  }

  const engagement = input.inboundCount >= 3 ? 100 : input.inboundCount === 2 ? 75 : input.inboundCount === 1 ? 50 : 0;

  let readinessScore = Math.round(stage * 0.5 + qualification * 0.3 + engagement * 0.2);
  if (input.status === LeadLifecycleStatus.WON) readinessScore = 100;
  if (input.status === LeadLifecycleStatus.LOST || input.status === LeadLifecycleStatus.RESTRICTED) readinessScore = 0;
  readinessScore = clamp(readinessScore);

  const readinessLabel: ReadinessLabel =
    readinessScore >= 75 ? 'READY' : readinessScore >= 45 ? 'ADVANCING' : readinessScore >= 20 ? 'EARLY' : 'NOT_READY';

  // --------------------------------------------------------------- recency
  let recency = 0;
  if (input.lastInboundAt) {
    const age = now.getTime() - input.lastInboundAt.getTime();
    recency = age <= 2 * DAY ? 100 : age <= 7 * DAY ? 70 : age <= 14 * DAY ? 40 : 20;
  } else if (input.status === LeadLifecycleStatus.CONTACTED) {
    recency = 10;
  }

  // ------------------------------------------------ human-intervention need
  const humanReasons: string[] = [];
  if (input.hasPendingHumanReview) humanReasons.push('A human review is pending');

  for (const rule of input.interventionRules) {
    switch (rule.trigger) {
      case 'READINESS_ABOVE':
        if (rule.threshold != null && readinessScore > rule.threshold) {
          humanReasons.push(`Deal readiness ${readinessScore} is above your threshold of ${rule.threshold}`);
        }
        break;
      case 'DEAL_VALUE_ABOVE':
        if (rule.threshold != null && input.maxProjectBudget != null && input.maxProjectBudget > rule.threshold) {
          humanReasons.push(`Deal value ${input.maxProjectBudget} is above your threshold of ${rule.threshold}`);
        }
        break;
      case 'CUSTOM_KEYWORD': {
        const kw = rule.keyword?.trim();
        if (kw && input.latestInboundText && input.latestInboundText.toLowerCase().includes(kw.toLowerCase())) {
          humanReasons.push(`Client message contains “${kw}”`);
        }
        break;
      }
      default: {
        const t = TEXT_TRIGGERS[rule.trigger];
        if (t && input.latestInboundText && t.re.test(input.latestInboundText)) {
          humanReasons.push(t.reason);
        }
      }
    }
  }
  const reasons = [...new Set(humanReasons)];
  const needsHuman = reasons.length > 0 && input.status !== LeadLifecycleStatus.WON && input.status !== LeadLifecycleStatus.LOST;

  // -------------------------------------------------------------- priority
  const fit = clamp(input.scoreTotal);
  let priorityScore = clamp(Math.round(fit * 0.35 + readinessScore * 0.4 + recency * 0.15 + (needsHuman ? 10 : 0)));

  let priorityLabel: PriorityLabel =
    priorityScore >= 70 ? 'HOT' : priorityScore >= 45 ? 'WARM' : priorityScore >= 25 ? 'COOL' : 'COLD';

  if (input.status === LeadLifecycleStatus.RESTRICTED) {
    priorityLabel = 'BLOCKED';
    priorityScore = 0;
  } else if (input.status === LeadLifecycleStatus.WON || input.status === LeadLifecycleStatus.LOST) {
    priorityLabel = 'CLOSED';
    priorityScore = 0;
  }

  return {
    priorityScore,
    priorityLabel,
    readinessScore,
    readinessLabel,
    needsHuman,
    humanReasons: reasons,
    nextAction: pickNextAction(input, needsHuman, reasons, priorityLabel),
    breakdown: {
      fit,
      stage,
      qualification: Math.round(qualification),
      engagement,
      recency,
    },
  };
}

function pickNextAction(input: PriorityInput, needsHuman: boolean, reasons: string[], label: PriorityLabel): string {
  if (label === 'BLOCKED') return input.hasPendingHumanReview ? 'Resolve the restriction review' : 'Blocked by restriction policy';
  if (label === 'CLOSED') return input.status === LeadLifecycleStatus.WON ? 'Deal won' : 'Closed as lost';
  if (needsHuman) return `Step in personally: ${reasons[0]}`;
  if (input.aiControlState === AIControlState.TAKEN_OVER) return 'You have taken over: continue the conversation';
  if (input.aiControlState === AIControlState.PAUSED) return 'AI is paused: resume it or reply yourself';
  if (input.scoreTotal === 0) return 'Score this lead';
  if (input.status === LeadLifecycleStatus.COLD_LEAD) return 'Draft and send first outreach';
  if (input.status === LeadLifecycleStatus.FOLLOW_UP_REQUIRED) return 'Send a follow-up';
  if (!input.qualification && input.inboundCount > 0) return 'Qualify this lead';
  return 'AI is handling this lead';
}
