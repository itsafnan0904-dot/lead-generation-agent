'use client';

import React, { useState } from 'react';
import Link from 'next/link';

interface RowResult {
  row: number;
  companyName: string;
  status: string;
  reason?: string;
  warnings?: string[];
  leadId?: string;
}
interface Summary {
  dryRun: boolean;
  total: number;
  counts: Record<string, number>;
  unknownColumns: string[];
  results: RowResult[];
}

const STATUS_COLOR: Record<string, string> = {
  CREATED: '#4cc38a', WOULD_CREATE: '#86a9f2', SKIPPED_DUPLICATE: '#a1a1a6',
  SKIPPED_OUT_OF_MARKET: '#e3a94d', SKIPPED_RESTRICTED: '#ee7378', INVALID: '#ee7378', ERROR: '#ee7378',
};

const input: React.CSSProperties = {
  width: '100%', padding: '10px', borderRadius: 8, border: '1px solid rgba(237, 237, 237, 0.09)', background: '#1e1e20',
  color: '#ededed', fontSize: '0.8125rem', fontFamily: 'ui-monospace, monospace',
};
const btn = (primary = false): React.CSSProperties => ({
  padding: '8px 16px', borderRadius: 8, fontSize: '0.8125rem', fontWeight: 500, cursor: 'pointer',
  border: primary ? '1px solid transparent' : '1px solid rgba(237, 237, 237, 0.09)',
  background: primary ? '#3d6fd8' : 'transparent', color: primary ? '#ffffff' : '#ededed',
});
const card: React.CSSProperties = { background: '#19191b', border: '1px solid rgba(237, 237, 237, 0.09)', borderRadius: 12, padding: 20 };

const SAMPLE = 'Company,Website,Country,Industry,Email,First Name,Last Name,Job Title\nAcme Retail,acme-retail.com,United States,Retail,sam@acme-retail.com,Sam,Lee,Head of Digital';

export function ImportProspects() {
  const [csv, setCsv] = useState('');
  const [createLeads, setCreateLeads] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) { setCsv(await f.text()); setSummary(null); setError(null); }
  };

  const run = async (dryRun: boolean) => {
    setBusy(true); setError(null);
    try {
      const res = await fetch('/api/discovery/import', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv, dryRun, createLeads }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        const msg = json?.error;
        setError(Array.isArray(msg) ? msg.join('; ') : msg || `Import failed (${res.status})`);
      } else setSummary(json);
    } catch { setError('Network error'); }
    setBusy(false);
  };

  return (
    <div style={{ padding: 24, maxWidth: 980, width: '100%', display: 'grid', gap: 16 }}>
      <p style={{ color: '#a1a1a6', fontSize: '0.8125rem', margin: 0 }}>
        Upload a CSV of prospects. Only companies inside your <Link href="/onboarding" style={{ color: '#86a9f2' }}>target countries and industries</Link> that
        pass your restriction rules are added. Always preview first.
      </p>

      <section style={card}>
        <input type="file" accept=".csv,text/csv,text/plain" onChange={onFile} style={{ color: '#a1a1a6', fontSize: '0.8125rem', marginBottom: 12 }} />
        <textarea style={{ ...input, minHeight: 180 }} value={csv} onChange={(e) => { setCsv(e.target.value); setSummary(null); }} placeholder={SAMPLE} spellCheck={false} />
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', color: '#a1a1a6', fontSize: '0.8125rem', margin: '12px 0' }}>
          <input type="checkbox" checked={createLeads} onChange={(e) => setCreateLeads(e.target.checked)} /> Create a lead for each imported company
        </label>
        <div style={{ display: 'flex', gap: 10 }}>
          <button style={btn()} disabled={busy || !csv.trim()} onClick={() => run(true)}>{busy ? 'Working…' : 'Preview (no changes)'}</button>
          <button style={btn(true)} disabled={busy || !csv.trim() || !summary?.dryRun} onClick={() => run(false)} title={summary?.dryRun ? '' : 'Preview first'}>Import</button>
        </div>
        <div style={{ color: '#85858b', fontSize: '0.75rem', marginTop: 10 }}>
          Recognised columns: company, domain, website, industry, size, location, country, email, first name, last name, job title. Max 500 rows.
        </div>
      </section>

      {error && <div role="alert" style={{ ...card, borderColor: '#e5484d', color: '#ee7378', fontSize: '0.8125rem' }}>{error}</div>}

      {summary && (
        <section style={card}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: 12, fontSize: '0.8125rem' }}>
            <strong style={{ color: '#ededed' }}>{summary.dryRun ? 'Preview' : 'Imported'}: {summary.total} rows</strong>
            {Object.entries(summary.counts).filter(([, n]) => n > 0).map(([k, n]) => (
              <span key={k} style={{ color: STATUS_COLOR[k] ?? '#a1a1a6' }}>{k.replace(/_/g, ' ').toLowerCase()}: {n}</span>
            ))}
          </div>
          {summary.unknownColumns.length > 0 && (
            <div style={{ color: '#e3a94d', fontSize: '0.75rem', marginBottom: 10 }}>Ignored columns: {summary.unknownColumns.join(', ')}</div>
          )}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
              <thead>
                <tr>{['#', 'Company', 'Result', 'Details'].map((h) => (
                  <th key={h} style={{ textAlign: 'left', padding: '6px 10px', color: '#a1a1a6', fontSize: '0.75rem', borderBottom: '1px solid rgba(237, 237, 237, 0.09)' }}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {summary.results.map((r) => (
                  <tr key={r.row}>
                    <td style={{ padding: '6px 10px', color: '#85858b' }}>{r.row}</td>
                    <td style={{ padding: '6px 10px', color: '#ededed' }}>
                      {r.leadId ? <Link href={`/leads/${r.leadId}`} style={{ color: '#ededed' }}>{r.companyName}</Link> : r.companyName}
                    </td>
                    <td style={{ padding: '6px 10px', color: STATUS_COLOR[r.status] ?? '#a1a1a6', fontWeight: 500 }}>{r.status.replace(/_/g, ' ')}</td>
                    <td style={{ padding: '6px 10px', color: '#a1a1a6' }}>{[r.reason, ...(r.warnings ?? [])].filter(Boolean).join(' · ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
