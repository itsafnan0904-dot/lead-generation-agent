'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { sendJson, TRANSITION_LABEL } from '../shared';

export interface PickableLead { id: string; company: { name: string }; status: string; priorityLabel?: string }

const btn = (primary = false, danger = false): React.CSSProperties => ({
  padding: '7px 12px', borderRadius: 6, fontSize: '0.8125rem', fontWeight: 500, cursor: 'pointer',
  border: primary ? '1px solid transparent' : `1px solid ${danger ? 'rgba(244,63,94,0.4)' : 'rgba(255,255,255,0.12)'}`,
  background: primary ? '#4f46e5' : 'transparent', color: primary ? '#fff' : danger ? '#fb7185' : '#f3f4f6',
});

export function CampaignControls({ campaignId, status, transitions }: { campaignId: string; status: string; transitions: string[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const change = async (next: string) => {
    if ((next === 'COMPLETED' || next === 'ARCHIVED') && !window.confirm(`${TRANSITION_LABEL[next]} this campaign? This cannot be undone.`)) return;
    setBusy(true); setError(null);
    const r = await sendJson('PATCH', `/api/campaigns/${campaignId}`, { status: next });
    if (!r.ok) setError(r.error); else router.refresh();
    setBusy(false);
  };

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {transitions.length === 0 && <span style={{ color: '#64748b', fontSize: '0.8125rem' }}>No further actions: this campaign is {status}.</span>}
        {transitions.map((t) => (
          <button key={t} style={btn(t === 'ACTIVE', t === 'ARCHIVED')} disabled={busy} onClick={() => change(t)}>
            {t === 'ACTIVE' && status === 'PAUSED' ? 'Resume' : t === 'ACTIVE' ? 'Launch' : TRANSITION_LABEL[t]}
          </button>
        ))}
      </div>
      {error && <div role="alert" style={{ color: '#fb7185', fontSize: '0.8125rem' }}>{error}</div>}
    </div>
  );
}

export function AddLeads({ campaignId, candidates, disabled }: { campaignId: string; candidates: PickableLead[]; disabled: boolean }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const add = async () => {
    setBusy(true); setMsg(null);
    const r = await sendJson('POST', `/api/campaigns/${campaignId}/leads`, { leadIds: Array.from(selected) });
    if (!r.ok) setMsg({ ok: false, text: r.error ?? 'Failed' });
    else {
      setMsg({ ok: true, text: `Added ${r.data.assigned} lead(s)${r.data.skipped?.length ? `, skipped ${r.data.skipped.length}` : ''}.` });
      setSelected(new Set());
      router.refresh();
    }
    setBusy(false);
  };

  if (disabled) return <div style={{ color: '#64748b', fontSize: '0.8125rem' }}>This campaign is closed to new leads.</div>;
  if (candidates.length === 0) return <div style={{ color: '#64748b', fontSize: '0.8125rem' }}>Every lead already belongs to a campaign. Import more prospects to add new ones.</div>;

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div style={{ maxHeight: 220, overflowY: 'auto', display: 'grid', gap: 4, border: '1px solid rgba(255,255,255,0.06)', borderRadius: 6, padding: 8 }}>
        {candidates.map((l) => (
          <label key={l.id} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: '0.8125rem', color: '#d1d5db', cursor: 'pointer' }}>
            <input type="checkbox" checked={selected.has(l.id)} onChange={() => toggle(l.id)} />
            <span style={{ flex: 1 }}>{l.company.name}</span>
            <span style={{ color: '#64748b', fontSize: '0.75rem' }}>{l.status.replace(/_/g, ' ')}</span>
          </label>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <button style={btn(true)} disabled={busy || selected.size === 0} onClick={add}>{busy ? 'Adding…' : `Add ${selected.size || ''} selected`}</button>
        {msg && <span role="status" style={{ color: msg.ok ? '#34d399' : '#fb7185', fontSize: '0.8125rem' }}>{msg.text}</span>}
      </div>
    </div>
  );
}

export function RemoveLeadButton({ campaignId, leadId }: { campaignId: string; leadId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      style={{ ...btn(false, true), padding: '3px 8px', fontSize: '0.75rem' }} disabled={busy}
      onClick={async () => { setBusy(true); const r = await sendJson('DELETE', `/api/campaigns/${campaignId}/leads/${leadId}`); if (r.ok) router.refresh(); setBusy(false); }}
    >Remove</button>
  );
}
