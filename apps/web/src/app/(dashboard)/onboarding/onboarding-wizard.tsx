'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Profile, RunFn, STEPS, api, btn, card } from './shared';
import { ProfileStep, ResumeStep } from './steps-profile';
import { ServicesStep, MarketsStep } from './steps-offer';
import { RestrictionsStep, HandoffStep, ReviewStep } from './steps-rules';

export function OnboardingWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const r = await api<Profile>('');
    if (r.ok) setProfile(r.data);
    else if (r.status !== 404) setError(r.error);
    setLoading(false);
  }, []);
  useEffect(() => { reload(); }, [reload]);

  /** Runs a mutation, refreshes the profile, and surfaces any error. */
  const run: RunFn = async (fn, okMsg) => {
    setBusy(true); setError(null); setNotice(null);
    const r = await fn();
    if (!r.ok) setError(r.error); else { await reload(); if (okMsg) setNotice(okMsg); }
    setBusy(false);
    return r.ok;
  };

  if (loading) return <div style={{ padding: 24, color: 'var(--text-muted)', fontSize: '0.8125rem' }}>Loading…</div>;

  const needsProfile = step > 0 && !profile;
  const last = step === STEPS.length - 1;
  const go = (i: number) => { setStep(i); setError(null); setNotice(null); };

  return (
    <div style={{ padding: 24, maxWidth: 860, width: '100%' }}>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem', marginBottom: 16 }}>
        Tell the agent who you are, what you sell, where to sell it and what to avoid. The agent uses this to find, pitch and hand off leads.
      </p>

      <ol style={{ display: 'flex', flexWrap: 'wrap', gap: 6, listStyle: 'none', padding: 0, margin: '0 0 20px' }}>
        {STEPS.map((s, i) => (
          <li key={s}>
            <button onClick={() => go(i)} style={{ ...btn(i === step), padding: '5px 10px', fontSize: '0.75rem', opacity: i > 0 && !profile ? 0.5 : 1 }}>
              {i + 1}. {s}
            </button>
          </li>
        ))}
      </ol>

      {error && <div role="alert" style={{ ...card, marginBottom: 12, padding: 12, borderColor: 'var(--accent-danger)', color: '#fb7185', fontSize: '0.8125rem' }}>{error}</div>}
      {notice && <div role="status" style={{ ...card, marginBottom: 12, padding: 12, borderColor: 'var(--accent-success)', color: '#34d399', fontSize: '0.8125rem' }}>{notice}</div>}

      <div style={card}>
        {needsProfile ? (
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem', margin: 0 }}>Save your profile in step 1 first.</p>
        ) : step === 0 ? <ProfileStep profile={profile} busy={busy} run={run} onSaved={() => go(1)} />
        : step === 1 ? <ResumeStep profile={profile!} busy={busy} run={run} />
        : step === 2 ? <ServicesStep profile={profile!} busy={busy} run={run} />
        : step === 3 ? <MarketsStep profile={profile!} busy={busy} run={run} />
        : step === 4 ? <RestrictionsStep profile={profile!} busy={busy} run={run} />
        : step === 5 ? <HandoffStep profile={profile!} busy={busy} run={run} />
        : <ReviewStep profile={profile!} busy={busy} run={run} onDone={() => router.push('/overview')} />}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16 }}>
        <button style={btn()} disabled={step === 0} onClick={() => go(step - 1)}>Back</button>
        {!last && <button style={btn(true)} disabled={!profile} onClick={() => go(step + 1)}>Next</button>}
      </div>
    </div>
  );
}
