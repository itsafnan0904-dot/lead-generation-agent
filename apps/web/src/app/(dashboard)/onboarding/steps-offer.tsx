'use client';

import React, { useState } from 'react';
import { StepProps, COUNTRIES, api, btn, csv, empty, hint, input, label, row } from './shared';

export function ServicesStep({ profile, busy, run }: StepProps) {
  const blank = { name: '', description: '', keywords: '', priceMin: '', priceMax: '', currency: 'USD' };
  const [f, setF] = useState(blank);
  const set = (k: keyof typeof blank) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  const add = async () => {
    const body: Record<string, unknown> = { name: f.name.trim(), currency: f.currency || 'USD' };
    if (f.description.trim()) body.description = f.description.trim();
    if (f.keywords.trim()) body.keywords = csv(f.keywords);
    if (f.priceMin !== '') body.priceMin = Number(f.priceMin);
    if (f.priceMax !== '') body.priceMax = Number(f.priceMax);
    if (await run(() => api('/services', 'POST', body))) setF({ ...blank, currency: f.currency });
  };

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <p style={hint}>What services will the agent sell on your behalf? Add at least one.</p>
      <div style={{ display: 'grid', gap: 8 }}>
        {profile.services.length === 0 && <div style={empty}>No services yet.</div>}
        {profile.services.map((s) => (
          <div key={s.id} style={row}>
            <div>
              <div style={{ fontSize: '0.8125rem', fontWeight: 600 }}>{s.name}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                {s.keywords.join(', ')}{(s.priceMin || s.priceMax) && ` · ${s.currency} ${s.priceMin ?? '…'}–${s.priceMax ?? '…'}`}
              </div>
            </div>
            <button style={btn()} disabled={busy} onClick={() => run(() => api(`/services/${s.id}`, 'DELETE'))}>Remove</button>
          </div>
        ))}
      </div>
      <div style={{ display: 'grid', gap: 10, borderTop: '1px solid var(--border-subtle)', paddingTop: 16 }}>
        <div><label style={label}>Service name *</label><input style={input} value={f.name} onChange={set('name')} placeholder="e.g. Website development" /></div>
        <div><label style={label}>Description</label><textarea style={{ ...input, minHeight: 60 }} value={f.description} onChange={set('description')} /></div>
        <div><label style={label}>Keywords (comma separated)</label><input style={input} value={f.keywords} onChange={set('keywords')} /></div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 90px', gap: 10 }}>
          <div><label style={label}>Min price</label><input style={input} type="number" min={0} value={f.priceMin} onChange={set('priceMin')} /></div>
          <div><label style={label}>Max price</label><input style={input} type="number" min={0} value={f.priceMax} onChange={set('priceMax')} /></div>
          <div><label style={label}>Currency</label><input style={input} maxLength={3} value={f.currency} onChange={(e) => setF({ ...f, currency: e.target.value.toUpperCase() })} /></div>
        </div>
        <div><button style={btn(true)} disabled={busy || !f.name.trim()} onClick={add}>Add service</button></div>
      </div>
    </div>
  );
}

export function MarketsStep({ profile, busy, run }: StepProps) {
  const [code, setCode] = useState('');
  const [industries, setIndustries] = useState('');

  const add = async () => {
    const body: Record<string, unknown> = { countryCode: code.trim().toUpperCase() };
    if (industries.trim()) body.industries = csv(industries);
    if (await run(() => api('/target-markets', 'POST', body))) { setCode(''); setIndustries(''); }
  };

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <p style={hint}>Which countries should the agent target? Add at least one.</p>
      <div style={{ display: 'grid', gap: 8 }}>
        {profile.targetMarkets.length === 0 && <div style={empty}>No countries yet.</div>}
        {profile.targetMarkets.map((m) => (
          <div key={m.id} style={row}>
            <div style={{ fontSize: '0.8125rem' }}>
              <strong>{COUNTRIES[m.countryCode] ?? m.countryCode}</strong> ({m.countryCode})
              {m.industries.length > 0 && <span style={{ color: 'var(--text-secondary)' }}> · {m.industries.join(', ')}</span>}
            </div>
            <button style={btn()} disabled={busy} onClick={() => run(() => api(`/target-markets/${m.id}`, 'DELETE'))}>Remove</button>
          </div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10, borderTop: '1px solid var(--border-subtle)', paddingTop: 16 }}>
        <div>
          <label style={label}>Country (2-letter code) *</label>
          <input style={input} list="country-codes" maxLength={2} value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="US" />
          <datalist id="country-codes">{Object.entries(COUNTRIES).map(([c, n]) => <option key={c} value={c}>{n}</option>)}</datalist>
        </div>
        <div><label style={label}>Industries to focus on (optional)</label><input style={input} value={industries} onChange={(e) => setIndustries(e.target.value)} placeholder="Retail, Healthcare…" /></div>
        <div><button style={btn(true)} disabled={busy || code.trim().length !== 2} onClick={add}>Add country</button></div>
      </div>
    </div>
  );
}
