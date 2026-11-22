export interface CampaignStats {
  totalLeads: number; contacted: number; replied: number; replyRate: number | null;
  won: number; lost: number; needsHuman: number; averagePriority: number | null; byStatus: Record<string, number>;
}
export interface CampaignSummary {
  id: string; name: string; description?: string | null; status: string;
  startDate?: string | null; endDate?: string | null; allowedTransitions: string[]; stats: CampaignStats;
}

export const STATUS_COLOR: Record<string, string> = {
  DRAFT: '#a1a1a6', ACTIVE: '#4cc38a', PAUSED: '#e3a94d', COMPLETED: '#86a9f2', ARCHIVED: '#85858b',
};

export const TRANSITION_LABEL: Record<string, string> = {
  ACTIVE: 'Launch / resume', PAUSED: 'Pause', COMPLETED: 'Complete', ARCHIVED: 'Archive',
};

export async function sendJson(method: string, url: string, body?: unknown): Promise<{ ok: boolean; data: any; error: string | null }> {
  try {
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    const data = await res.json().catch(() => null);
    if (res.ok) return { ok: true, data, error: null };
    const msg = data?.error;
    return { ok: false, data: null, error: Array.isArray(msg) ? msg.join('; ') : msg || `Request failed (${res.status})` };
  } catch { return { ok: false, data: null, error: 'Network error' }; }
}
