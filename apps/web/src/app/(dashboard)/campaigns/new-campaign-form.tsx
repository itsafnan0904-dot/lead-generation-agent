'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { sendJson } from './shared';

const input: React.CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(237, 237, 237, 0.09)', background: '#1e1e20', color: '#ededed', fontSize: '0.8125rem', fontFamily: 'inherit' };
const label: React.CSSProperties = { display: 'block', fontSize: '0.75rem', color: '#a1a1a6', marginBottom: 6 };

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
    <section style={{ background: '#19191b', border: '1px solid rgba(237, 237, 237, 0.09)', borderRadius: 12, padding: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr auto', gap: 10, alignItems: 'end' }}>
        <div><label style={label}>New campaign name *</label><input style={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Q4 retail outreach" /></div>
        <div><label style={label}>Description</label><input style={input} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
        <button
          disabled={busy || !name.trim()} onClick={create}
          style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid transparent', background: '#3d6fd8', color: '#ffffff', fontSize: '0.8125rem', fontWeight: 500, cursor: 'pointer' }}
        >{busy ? 'Creating…' : 'Create campaign'}</button>
      </div>
      {error && <div role="alert" style={{ color: '#ee7378', fontSize: '0.8125rem', marginTop: 10 }}>{error}</div>}
    </section>
  );
}
