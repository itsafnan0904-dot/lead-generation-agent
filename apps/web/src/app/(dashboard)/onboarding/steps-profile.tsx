'use client';

import React, { useState } from 'react';
import { Profile, StepProps, RunFn, api, btn, csv, hint, input, label } from './shared';

export function ProfileStep({ profile, busy, run, onSaved }: { profile: Profile | null; busy: boolean; run: RunFn; onSaved: () => void }) {
  const [f, setF] = useState({
    displayName: profile?.displayName ?? '', companyName: profile?.companyName ?? '', title: profile?.title ?? '',
    bio: profile?.bio ?? '', skills: (profile?.skills ?? []).join(', '), yearsExperience: profile?.yearsExperience?.toString() ?? '',
    tone: profile?.tone ?? '', signature: profile?.signature ?? '',
  });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  const save = async () => {
    const body: Record<string, unknown> = { displayName: f.displayName.trim(), skills: csv(f.skills) };
    for (const k of ['companyName', 'title', 'bio', 'tone', 'signature'] as const) if (f[k].trim()) body[k] = f[k].trim();
    if (f.yearsExperience.trim() !== '') body.yearsExperience = Number(f.yearsExperience);
    const ok = await run(() => api('', 'PUT', body), 'Profile saved.');
    if (ok && !profile) onSaved();
  };

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div><label style={label}>Your name *</label><input style={input} value={f.displayName} onChange={set('displayName')} /></div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div><label style={label}>Company / brand</label><input style={input} value={f.companyName} onChange={set('companyName')} /></div>
        <div><label style={label}>Title</label><input style={input} value={f.title} onChange={set('title')} placeholder="e.g. Full-stack developer" /></div>
      </div>
      <div><label style={label}>About you (the agent uses this to pitch)</label><textarea style={{ ...input, minHeight: 90 }} value={f.bio} onChange={set('bio')} /></div>
      <div><label style={label}>Skills (comma separated)</label><input style={input} value={f.skills} onChange={set('skills')} placeholder="React, Node.js, SEO…" /></div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12 }}>
        <div><label style={label}>Years of experience</label><input style={input} type="number" min={0} max={80} value={f.yearsExperience} onChange={set('yearsExperience')} /></div>
        <div><label style={label}>Email tone</label><input style={input} value={f.tone} onChange={set('tone')} placeholder="Friendly and concise" /></div>
      </div>
      <div><label style={label}>Email signature</label><textarea style={{ ...input, minHeight: 60 }} value={f.signature} onChange={set('signature')} /></div>
      <div><button style={btn(true)} disabled={busy || !f.displayName.trim()} onClick={save}>{busy ? 'Saving…' : 'Save profile'}</button></div>
    </div>
  );
}

export function ResumeStep({ profile, busy, run }: StepProps) {
  const [text, setText] = useState('');
  const [fileName, setFileName] = useState(profile.resumeFileName ?? '');
  const [apply, setApply] = useState(true);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setText(await file.text());
  };

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <p style={hint}>
        Paste your resume text or load a plain-text file (.txt / .md). Skills and years of experience are extracted and can be merged into your profile.
        {profile.resumeFileName && <> Current resume: <strong>{profile.resumeFileName}</strong>.</>}
      </p>
      <input type="file" accept=".txt,.md,text/plain,text/markdown" onChange={onFile} style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem' }} />
      <textarea style={{ ...input, minHeight: 220 }} value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste resume text here…" />
      <label style={{ ...label, display: 'flex', gap: 8, alignItems: 'center', marginBottom: 0 }}>
        <input type="checkbox" checked={apply} onChange={(e) => setApply(e.target.checked)} /> Merge extracted skills into my profile
      </label>
      <div>
        <button
          style={btn(true)}
          disabled={busy || !text.trim()}
          onClick={() => run(() => api('/resume', 'PUT', { resumeText: text, resumeFileName: fileName || undefined, applyToProfile: apply }), 'Resume saved and analysed.')}
        >{busy ? 'Saving…' : 'Save resume'}</button>
      </div>
    </div>
  );
}
