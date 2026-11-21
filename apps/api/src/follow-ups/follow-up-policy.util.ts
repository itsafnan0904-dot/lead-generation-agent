import { AutoReplyMode, resolveAutoReplyMode } from '../auto-reply/auto-reply-policy.util';
import { campaignAllowsAiActivity } from '../campaigns/campaign-lifecycle.util';

/**
 * Follow-up mode. Defaults to 'draft'. The global AUTO_REPLY_MODE is the master kill switch and also a ceiling:
 * AUTO_REPLY_MODE=off turns follow-ups off, and AUTO_REPLY_MODE=draft stops follow-ups from auto-sending.
 */
export function resolveFollowUpMode(
  raw: string | undefined = process.env.FOLLOW_UP_MODE,
  globalMode: AutoReplyMode = resolveAutoReplyMode(),
): AutoReplyMode {
  const v = (raw ?? 'draft').trim().toLowerCase();
  const own: AutoReplyMode = v === 'draft' || v === 'auto' || v === 'off' ? v : 'off';
  if (globalMode === 'off' || own === 'off') return 'off';
  if (globalMode === 'draft') return 'draft';
  return own;
}

export interface FollowUpGateInput {
  mode: AutoReplyMode;
  leadStatus: string;
  aiControlState: string;
  /** Status of the lead's campaign, if any. Anything but ACTIVE pauses follow-ups for the lead. */
  campaignStatus?: string | null;
  autonomousOptIn: boolean;
  contactEmail?: string | null;
  lastOutboundAt: Date | null;
  lastInboundAt: Date | null;
  now: Date;
  afterDays: number;
  followUpsSent: number;
  maxFollowUps: number;
  hasPendingFollowUpDraft: boolean;
}

export type FollowUpDecision =
  | { action: 'SKIP'; reason: string }
  | { action: 'DRAFT_FOR_APPROVAL'; reason: string; followUpNumber: number; isFinal: boolean }
  | { action: 'AUTO_SEND'; followUpNumber: number; isFinal: boolean };

const NO_FOLLOW_UP_STATUSES = new Set(['COLD_LEAD', 'RESTRICTED', 'WON', 'LOST', 'DISQUALIFIED', 'HUMAN_REVIEW']);

/**
 * Pure decision: should the AI nudge a lead that has gone quiet, and may it send without approval?
 * A lead is quiet only when WE spoke last and that was at least `afterDays` ago.
 */
export function decideFollowUp(g: FollowUpGateInput): FollowUpDecision {
  if (g.mode === 'off') return { action: 'SKIP', reason: 'KILL_SWITCH_OFF' };
  if (NO_FOLLOW_UP_STATUSES.has(g.leadStatus)) return { action: 'SKIP', reason: `LEAD_STATUS_${g.leadStatus}` };
  if (g.aiControlState !== 'AI_ACTIVE') return { action: 'SKIP', reason: `AI_${g.aiControlState}` };
  if (!campaignAllowsAiActivity(g.campaignStatus)) return { action: 'SKIP', reason: `CAMPAIGN_${g.campaignStatus}` };
  if (!g.contactEmail) return { action: 'SKIP', reason: 'NO_CONTACT_EMAIL' };
  if (!g.lastOutboundAt) return { action: 'SKIP', reason: 'NO_OUTBOUND_MESSAGE_YET' };
  if (g.lastInboundAt && g.lastInboundAt.getTime() >= g.lastOutboundAt.getTime()) {
    return { action: 'SKIP', reason: 'CLIENT_SPOKE_LAST' };
  }
  if (g.followUpsSent >= g.maxFollowUps) return { action: 'SKIP', reason: 'MAX_FOLLOW_UPS_REACHED' };
  if (g.hasPendingFollowUpDraft) return { action: 'SKIP', reason: 'FOLLOW_UP_DRAFT_ALREADY_PENDING' };
  const quietMs = g.now.getTime() - g.lastOutboundAt.getTime();
  if (quietMs < g.afterDays * 86_400_000) return { action: 'SKIP', reason: 'NOT_QUIET_LONG_ENOUGH' };

  const followUpNumber = g.followUpsSent + 1;
  const isFinal = followUpNumber >= g.maxFollowUps;
  if (g.mode === 'draft') return { action: 'DRAFT_FOR_APPROVAL', reason: 'DRAFT_MODE', followUpNumber, isFinal };
  if (!g.autonomousOptIn) return { action: 'DRAFT_FOR_APPROVAL', reason: 'LEAD_NOT_OPTED_IN_TO_AUTONOMOUS', followUpNumber, isFinal };
  return { action: 'AUTO_SEND', followUpNumber, isFinal };
}
