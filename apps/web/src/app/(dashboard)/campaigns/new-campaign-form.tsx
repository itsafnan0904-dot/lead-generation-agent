'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { sendJson } from './shared';

const input: React.CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: '#1a1b30', color: '#f4f4fa', fontSize: '0.8125rem', fontFamily: 'inherit' };
const label: React.CSSProperties = { display: 'block', fontSize: '0.75rem', color: '#a1a3b8', marginBottom: 6 };

export function NewCampaignForm() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = async () => {
    setBusy(true); setError(null);
    const body: Record<string, unknown> = { name: name.trim() };
    if (description.trim()) body.description = description.trim();
    const r = await sendJson('POST', '/api/campaigns', body);
    if (!r.ok) setError(r.error);
    else if (r.data?.id) router.push(`/campaigns/${r.data.id}`);
    setBusy(false);
  };

  return (
    <section style={{ background: '#151628', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr auto', gap: 10, alignItems: 'end' }}>
        <div><label style={label}>New campaign name *</label><input style={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Q4 retail outreach" /></div>
        <div><label style={label}>Description</label><input style={input} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
        <button
          disabled={busy || !name.trim()} onClick={create}
          style={{ padding: '8px 14px', borderRadius: 6, border: '1px solid transparent', background: '#7c6ee0', color: '#fff', fontSize: '0.8125rem', fontWeight: 500, cursor: 'pointer' }}
        >{busy ? 'Creating…' : 'Create campaign'}</button>
      </div>
      {error && <div role="alert" style={{ color: '#fb7185', fontSize: '0.8125rem', marginTop: 10 }}>{error}</div>}
    </section>
  );
}
