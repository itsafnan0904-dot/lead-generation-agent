'use client';

import React, { useState } from 'react';
import { StepProps, Restriction, TRIGGERS, api, btn, empty, hint, input, label, row } from './shared';

export function RestrictionsStep({ profile, busy, run }: StepProps) {
  const [type, setType] = useState<Restriction['type']>('SERVICE');
  const [value, setValue] = useState('');
  const [reason, setReason] = useState('');

  const add = async () => {
    const body: Record<string, unknown> = { type, value: value.trim() };
    if (reason.trim()) body.reason = reason.trim();
    if (await run(() => api('/restriction-rules', 'POST', body))) { setValue(''); setReason(''); }
  };

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <p style={hint}>What should the agent <strong>never</strong> sell or pursue? Leads matching these are blocked or sent for review.</p>
      <div style={{ display: 'grid', gap: 8 }}>
        {profile.restrictionRules.length === 0 && <div style={empty}>No restrictions yet.</div>}
        {profile.restrictionRules.map((r) => (
          <div key={r.id} style={row}>
            <div style={{ fontSize: '0.8125rem' }}>
              <span style={{ color: 'var(--accent-danger)', fontWeight: 600 }}>{r.type}</span> · {r.value}
              {r.reason && <span style={{ color: 'var(--text-secondary)' }}> — {r.reason}</span>}
            </div>
            <button style={btn()} disabled={busy} onClick={() => run(() => api(`/restriction-rules/${r.id}`, 'DELETE'))}>Remove</button>
          </div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 10, borderTop: '1px solid var(--border-subtle)', paddingTop: 16 }}>
        <div>
          <label style={label}>Type</label>
          <select style={input} value={type} onChange={(e) => setType(e.target.value as Restriction['type'])}>
            <option value="SERVICE">Service</option><option value="INDUSTRY">Industry</option><option value="KEYWORD">Keyword</option>
          </select>
        </div>
        <div><label style={label}>Value *</label><input style={input} value={value} onChange={(e) => setValue(e.target.value)} placeholder="e.g. Gambling" /></div>
        <div style={{ gridColumn: '1 / -1' }}><label style={label}>Reason (optional)</label><input style={input} value={reason} onChange={(e) => setReason(e.target.value)} /></div>
        <div><button style={btn(true)} disabled={busy || !value.trim()} onClick={add}>Add restriction</button></div>
      </div>
    </div>
  );
}

export function HandoffStep({ profile, busy, run }: StepProps) {
  const [trigger, setTrigger] = useState('PRICING_DISCUSSION');
  const [threshold, setThreshold] = useState('');
  const [keyword, setKeyword] = useState('');
  const meta = TRIGGERS[trigger];

  const add = async () => {
    const body: Record<string, unknown> = { trigger };
    if (meta.needs === 'threshold') body.threshold = Number(threshold);
    if (meta.needs === 'keyword') body.keyword = keyword.trim();
    if (await run(() => api('/intervention-rules', 'POST', body))) { setThreshold(''); setKeyword(''); }
  };
  const canAdd = meta.needs === 'threshold' ? threshold !== '' : meta.needs === 'keyword' ? !!keyword.trim() : true;

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <p style={hint}>When should the AI stop and hand the conversation to you? The agent pauses and notifies you when any of these happen.</p>
      <div style={{ display: 'grid', gap: 8 }}>
        {profile.interventionRules.length === 0 && <div style={empty}>No handoff rules yet.</div>}
        {profile.interventionRules.map((r) => (
          <div key={r.id} style={row}>
            <div style={{ fontSize: '0.8125rem' }}>
              {TRIGGERS[r.trigger]?.label ?? r.trigger}{r.threshold && ` ${Number(r.threshold)}`}{r.keyword && ` “${r.keyword}”`}
            </div>
            <button style={btn()} disabled={busy} onClick={() => run(() => api(`/intervention-rules/${r.id}`, 'DELETE'))}>Remove</button>
          </div>
        ))}
      </div>
      <div style={{ display: 'grid', gap: 10, borderTop: '1px solid var(--border-subtle)', paddingTop: 16 }}>
        <div>
          <label style={label}>Hand off to me when…</label>
          <select style={input} value={trigger} onChange={(e) => { setTrigger(e.target.value); setThreshold(''); setKeyword(''); }}>
            {Object.entries(TRIGGERS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
        {meta.needs === 'threshold' && (
          <div>
            <label style={label}>Threshold ({meta.hint})</label>
            <input style={input} type="number" min={0} max={trigger === 'READINESS_ABOVE' ? 100 : undefined} value={threshold} onChange={(e) => setThreshold(e.target.value)} />
          </div>
        )}
        {meta.needs === 'keyword' && <div><label style={label}>Keyword</label><input style={input} value={keyword} onChange={(e) => setKeyword(e.target.value)} /></div>}
        <div><button style={btn(true)} disabled={busy || !canAdd} onClick={add}>Add rule</button></div>
      </div>
    </div>
  );
}

export function ReviewStep({ profile, busy, run, onDone }: StepProps & { onDone: () => void }) {
  const checks = [
    { ok: !!profile.displayName, text: 'Profile saved', optional: false },
    { ok: profile.services.length > 0, text: `${profile.services.length} service(s) added`, optional: false },
    { ok: profile.targetMarkets.length > 0, text: `${profile.targetMarkets.length} target country(ies)`, optional: false },
    { ok: profile.restrictionRules.length > 0, text: `${profile.restrictionRules.length} restriction(s) — optional`, optional: true },
    { ok: profile.interventionRules.length > 0, text: `${profile.interventionRules.length} handoff rule(s) — optional`, optional: true },
  ];
  const ready = profile.services.length > 0 && profile.targetMarkets.length > 0;

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 8 }}>
        {checks.map((c) => (
          <li key={c.text} style={{ fontSize: '0.8125rem', color: c.ok ? '#34d399' : c.optional ? 'var(--text-muted)' : '#fb7185' }}>
            {c.ok ? '✓' : c.optional ? '○' : '✗'} {c.text}
          </li>
        ))}
      </ul>
      {profile.onboardingComplete && <div style={{ fontSize: '0.8125rem', color: '#34d399' }}>Onboarding is already complete. You can keep editing any step.</div>}
      <div>
        <button style={btn(true)} disabled={busy || !ready} onClick={async () => { if (await run(() => api('/complete-onboarding', 'POST'))) onDone(); }}>
          {busy ? 'Finishing…' : profile.onboardingComplete ? 'Save & go to dashboard' : 'Finish setup'}
        </button>
      </div>
    </div>
  );
}
