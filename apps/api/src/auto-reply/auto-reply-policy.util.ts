import { campaignAllowsAiActivity } from '../campaigns/campaign-lifecycle.util';

export type AutoReplyMode = 'off' | 'draft' | 'auto';

/** Global kill switch. AUTO_REPLY_MODE=off disables everything; unknown values fail safe to 'off'. Default: draft. */
export function resolveAutoReplyMode(raw: string | undefined = process.env.AUTO_REPLY_MODE): AutoReplyMode {
  const v = (raw ?? 'draft').trim().toLowerCase();
  return v === 'draft' || v === 'auto' || v === 'off' ? v : 'off';
}

export interface ReplyGateInput {
  mode: AutoReplyMode;
  leadStatus: string;
  aiControlState: string;
  /** Status of the lead's campaign, if any. Anything but ACTIVE pauses AI replies for the lead. */
  campaignStatus?: string | null;
  autonomousOptIn: boolean;
  analysisRequiresHuman: boolean;
  intent?: string | null;
  contactEmail?: string | null;
  replyAlreadyExists: boolean;
  autoRepliesSentLast24h: number;
  maxAutoRepliesPerDay: number;
}

export type ReplyDecision =
  | { action: 'SKIP'; reason: string }
  | { action: 'DRAFT_FOR_APPROVAL'; reason: string }
  | { action: 'AUTO_SEND' };

const NO_REPLY_STATUSES = new Set(['RESTRICTED', 'WON', 'LOST', 'DISQUALIFIED', 'HUMAN_REVIEW']);
const NO_REPLY_INTENTS = new Set(['NOT_INTERESTED', 'UNSUBSCRIBE']);

/**
 * Pure decision function: should the AI answer this inbound message, and may it send without approval?
 * Hard blocks (SKIP) always win. Auto-send needs mode=auto AND the per-lead admin opt-in AND under the daily cap;
 * anything short of that falls back to a draft a human approves.
 */
export function decideAutoReply(g: ReplyGateInput): ReplyDecision {
  if (g.mode === 'off') return { action: 'SKIP', reason: 'KILL_SWITCH_OFF' };
  if (NO_REPLY_STATUSES.has(g.leadStatus)) return { action: 'SKIP', reason: `LEAD_STATUS_${g.leadStatus}` };
  if (g.aiControlState !== 'AI_ACTIVE') return { action: 'SKIP', reason: `AI_${g.aiControlState}` };
  if (!campaignAllowsAiActivity(g.campaignStatus)) return { action: 'SKIP', reason: `CAMPAIGN_${g.campaignStatus}` };
  if (g.analysisRequiresHuman) return { action: 'SKIP', reason: 'AI_ANALYSIS_REQUIRES_HUMAN' };
  if (g.intent && NO_REPLY_INTENTS.has(g.intent)) return { action: 'SKIP', reason: `INTENT_${g.intent}` };
  if (!g.contactEmail) return { action: 'SKIP', reason: 'NO_CONTACT_EMAIL' };
  if (g.replyAlreadyExists) return { action: 'SKIP', reason: 'REPLY_ALREADY_DRAFTED' };

  if (g.mode === 'draft') return { action: 'DRAFT_FOR_APPROVAL', reason: 'DRAFT_MODE' };
  if (!g.autonomousOptIn) return { action: 'DRAFT_FOR_APPROVAL', reason: 'LEAD_NOT_OPTED_IN_TO_AUTONOMOUS' };
  if (g.autoRepliesSentLast24h >= g.maxAutoRepliesPerDay) {
    return { action: 'DRAFT_FOR_APPROVAL', reason: 'PER_LEAD_DAILY_CAP_REACHED' };
  }
  return { action: 'AUTO_SEND' };
}
