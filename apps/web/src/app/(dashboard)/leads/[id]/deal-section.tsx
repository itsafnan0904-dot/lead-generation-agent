'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

export interface DealItem {
  id: string;
  title: string;
  description?: string | null;
  budget?: string | number | null;
  currency: string;
  timeline?: string | null;
}

const box: React.CSSProperties = { background: '#151628', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: 20 };
const input: React.CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: '#1a1b30', color: '#f4f4fa', fontSize: '0.8125rem', fontFamily: 'inherit' };
const label: React.CSSProperties = { display: 'block', fontSize: '0.75rem', color: '#a1a3b8', marginBottom: 6 };
const btn = (primary = false, danger = false): React.CSSProperties => ({
  padding: '7px 12px', borderRadius: 6, fontSize: '0.8125rem', fontWeight: 500, cursor: 'pointer',
  border: primary ? '1px solid transparent' : `1px solid ${danger ? 'rgba(244,63,94,0.4)' : 'rgba(255,255,255,0.1)'}`,
  background: primary ? '#7c6ee0' : 'transparent', color: primary ? '#fff' : danger ? '#fb7185' : '#f4f4fa',
});

async function send(method: string, url: string, body?: unknown): Promise<string | null> {
  try {
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    if (res.ok) return null;
    const json = await res.json().catch(() => null);
    const msg = json?.error;
    return Array.isArray(msg) ? msg.join('; ') : msg || `Request failed (${res.status})`;
  } catch { return 'Network error'; }
}

/** Deal value and requirements for a lead; feeds the pipeline totals and the "deal value above X" handoff rule. */
export function DealSection({ leadId, status, deals }: { leadId: string; status: string; deals: DealItem[] }) {
  const router = useRouter();
  const [f, setF] = useState({ title: '', budget: '', currency: 'USD', timeline: '', description: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const closed = status === 'WON' || status === 'LOST';

  const run = async (fn: () => Promise<string | null>) => {
    setBusy(true); setError(null);
    const err = await fn();
    if (err) setError(err); else router.refresh();
    setBusy(false);
    return !err;
  };

  const add = async () => {
    const body: Record<string, unknown> = { title: f.title.trim(), currency: f.currency.trim().toUpperCase() || 'USD' };
    if (f.budget !== '') body.budget = Number(f.budget);
    if (f.timeline.trim()) body.timeline = f.timeline.trim();
    if (f.description.trim()) body.description = f.description.trim();
    if (await run(() => send('POST', `/api/leads/${leadId}/projects`, body))) setF({ ...f, title: '', budget: '', timeline: '', description: '' });
  };

  return (
    <section style={box}>
      <h2 style={{ margin: '0 0 12px', fontSize: '0.875rem', fontWeight: 600, color: '#f4f4fa' }}>Deal & requirements</h2>

      {error && <div role="alert" style={{ color: '#fb7185', fontSize: '0.8125rem', marginBottom: 10 }}>{error}</div>}

      <div style={{ display: 'grid', gap: 8, marginBottom: 14 }}>
        {deals.length === 0 && <div style={{ color: '#6e7089', fontSize: '0.8125rem' }}>No deal recorded yet. Add the client's project and budget once it is known.</div>}
        {deals.map((d) => (
          <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', padding: '10px 12px', borderRadius: 6, background: '#1a1b30', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontSize: '0.8125rem', color: '#c9cadb' }}>
              <strong style={{ color: '#f4f4fa' }}>{d.title}</strong>
              {d.budget != null && <span> · {d.currency} {Number(d.budget).toLocaleString()}</span>}
              {d.timeline && <span style={{ color: '#a1a3b8' }}> · {d.timeline}</span>}
              {d.description && <div style={{ color: '#a1a3b8', marginTop: 2 }}>{d.description}</div>}
            </div>
            <button style={btn(false, true)} disabled={busy} onClick={() => run(() => send('DELETE', `/api/projects/${d.id}`))}>Remove</button>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 80px 1fr', gap: 10, alignItems: 'end' }}>
        <div><label style={label}>Project / need *</label><input style={input} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="e.g. Store redesign" /></div>
        <div><label style={label}>Budget</label><input style={input} type="number" min={0} step="0.01" value={f.budget} onChange={(e) => setF({ ...f, budget: e.target.value })} /></div>
        <div><label style={label}>Currency</label><input style={input} maxLength={3} value={f.currency} onChange={(e) => setF({ ...f, currency: e.target.value.toUpperCase() })} /></div>
        <div><label style={label}>Timeline</label><input style={input} value={f.timeline} onChange={(e) => setF({ ...f, timeline: e.target.value })} placeholder="e.g. 6 weeks" /></div>
        <div style={{ gridColumn: '1 / 4' }}><label style={label}>Requirements / notes</label><input style={input} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
        <div><button style={btn(true)} disabled={busy || !f.title.trim()} onClick={add}>Add deal</button></div>
      </div>

      {!closed && (
        <div style={{ display: 'flex', gap: 10, marginTop: 16, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.06)', alignItems: 'center' }}>
          <span style={{ color: '#a1a3b8', fontSize: '0.75rem' }}>Close this opportunity:</span>
          <button style={{ ...btn(), color: '#34d399', borderColor: 'rgba(16,185,129,0.4)' }} disabled={busy}
            onClick={() => window.confirm('Mark this lead as WON?') && run(() => send('PATCH', `/api/leads/${leadId}`, { status: 'WON' }))}>Mark won</button>
          <button style={btn(false, true)} disabled={busy}
            onClick={() => window.confirm('Mark this lead as LOST? The AI will stop engaging it.') && run(() => send('PATCH', `/api/leads/${leadId}`, { status: 'LOST' }))}>Mark lost</button>
        </div>
      )}
      {closed && <div style={{ marginTop: 14, color: status === 'WON' ? '#34d399' : '#a1a3b8', fontSize: '0.8125rem' }}>This opportunity is {status}.</div>}
    </section>
  );
}
