export type CampaignStatusName = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'ARCHIVED';

const ALLOWED: Record<CampaignStatusName, CampaignStatusName[]> = {
  DRAFT: ['ACTIVE', 'ARCHIVED'],
  ACTIVE: ['PAUSED', 'COMPLETED'],
  PAUSED: ['ACTIVE', 'COMPLETED', 'ARCHIVED'],
  COMPLETED: ['ARCHIVED'],
  ARCHIVED: [],
};

export function canTransition(from: string, to: string): boolean {
  return (ALLOWED[from as CampaignStatusName] ?? []).includes(to as CampaignStatusName);
}

export function allowedTransitions(from: string): CampaignStatusName[] {
  return ALLOWED[from as CampaignStatusName] ?? [];
}

/**
 * Whether the AI may reply to or follow up leads of a campaign in this status.
 * Leads outside any campaign (null) are unaffected. Anything but ACTIVE pauses AI activity for the campaign's leads;
 * a human can still send manually.
 */
export function campaignAllowsAiActivity(status: string | null | undefined): boolean {
  return status == null || status === 'ACTIVE';
}

/** Lifecycle statuses that count as "got a reply" for campaign statistics. */
export const REPLIED_STATUSES = new Set([
  'RESPONDED', 'INTERESTED', 'GATHERING_REQUIREMENTS', 'QUALIFIED', 'DEAL_DISCUSSION', 'WON', 'WAITING_FOR_CLIENT',
]);

export interface CampaignStats {
  totalLeads: number;
  contacted: number;
  replied: number;
  replyRate: number | null; // replied / contacted, null until something is contacted
  won: number;
  lost: number;
  needsHuman: number;
  averagePriority: number | null;
  byStatus: Record<string, number>;
}

export function computeCampaignStats(
  leads: { status: string; priority?: { priorityScore: number; needsHuman: boolean } }[],
): CampaignStats {
  const byStatus: Record<string, number> = {};
  let contacted = 0, replied = 0, won = 0, lost = 0, needsHuman = 0, prioritySum = 0, priorityCount = 0;

  for (const l of leads) {
    byStatus[l.status] = (byStatus[l.status] ?? 0) + 1;
    if (l.status !== 'COLD_LEAD' && l.status !== 'RESTRICTED') contacted++;
    if (REPLIED_STATUSES.has(l.status)) replied++;
    if (l.status === 'WON') won++;
    if (l.status === 'LOST') lost++;
    if (l.priority) {
      if (l.priority.needsHuman) needsHuman++;
      if (l.status !== 'WON' && l.status !== 'LOST' && l.status !== 'RESTRICTED') { prioritySum += l.priority.priorityScore; priorityCount++; }
    }
  }
  return {
    totalLeads: leads.length,
    contacted,
    replied,
    replyRate: contacted > 0 ? Math.round((replied / contacted) * 1000) / 10 : null,
    won,
    lost,
    needsHuman,
    averagePriority: priorityCount > 0 ? Math.round(prioritySum / priorityCount) : null,
    byStatus,
  };
}
