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
  CREATED: '#34d399', WOULD_CREATE: '#a99ef2', SKIPPED_DUPLICATE: '#a1a3b8',
  SKIPPED_OUT_OF_MARKET: '#fbbf24', SKIPPED_RESTRICTED: '#fb7185', INVALID: '#fb7185', ERROR: '#fb7185',
};

const input: React.CSSProperties = {
  width: '100%', padding: '10px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: '#1a1b30',
  color: '#f4f4fa', fontSize: '0.8125rem', fontFamily: 'ui-monospace, monospace',
};
const btn = (primary = false): React.CSSProperties => ({
  padding: '8px 14px', borderRadius: 6, fontSize: '0.8125rem', fontWeight: 500, cursor: 'pointer',
  border: primary ? '1px solid transparent' : '1px solid rgba(255,255,255,0.1)',
  background: primary ? '#7c6ee0' : 'transparent', color: primary ? '#fff' : '#f4f4fa',
});
const card: React.CSSProperties = { background: '#151628', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: 20 };

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
      <p style={{ color: '#a1a3b8', fontSize: '0.8125rem', margin: 0 }}>
        Upload a CSV of prospects. Only companies inside your <Link href="/onboarding" style={{ color: '#a99ef2' }}>target countries and industries</Link> that
        pass your restriction rules are added. Always preview first.
      </p>

      <section style={card}>
        <input type="file" accept=".csv,text/csv,text/plain" onChange={onFile} style={{ color: '#a1a3b8', fontSize: '0.8125rem', marginBottom: 12 }} />
        <textarea style={{ ...input, minHeight: 180 }} value={csv} onChange={(e) => { setCsv(e.target.value); setSummary(null); }} placeholder={SAMPLE} spellCheck={false} />
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', color: '#a1a3b8', fontSize: '0.8125rem', margin: '12px 0' }}>
          <input type="checkbox" checked={createLeads} onChange={(e) => setCreateLeads(e.target.checked)} /> Create a lead for each imported company
        </label>
        <div style={{ display: 'flex', gap: 10 }}>
          <button style={btn()} disabled={busy || !csv.trim()} onClick={() => run(true)}>{busy ? 'Working…' : 'Preview (no changes)'}</button>
          <button style={btn(true)} disabled={busy || !csv.trim() || !summary?.dryRun} onClick={() => run(false)} title={summary?.dryRun ? '' : 'Preview first'}>Import</button>
        </div>
        <div style={{ color: '#6e7089', fontSize: '0.75rem', marginTop: 10 }}>
          Recognised columns: company, domain, website, industry, size, location, country, email, first name, last name, job title. Max 500 rows.
        </div>
      </section>

      {error && <div role="alert" style={{ ...card, borderColor: '#f43f5e', color: '#fb7185', fontSize: '0.8125rem' }}>{error}</div>}

      {summary && (
        <section style={card}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginBottom: 12, fontSize: '0.8125rem' }}>
            <strong style={{ color: '#f4f4fa' }}>{summary.dryRun ? 'Preview' : 'Imported'}: {summary.total} rows</strong>
            {Object.entries(summary.counts).filter(([, n]) => n > 0).map(([k, n]) => (
              <span key={k} style={{ color: STATUS_COLOR[k] ?? '#a1a3b8' }}>{k.replace(/_/g, ' ').toLowerCase()}: {n}</span>
            ))}
          </div>
          {summary.unknownColumns.length > 0 && (
            <div style={{ color: '#fbbf24', fontSize: '0.75rem', marginBottom: 10 }}>Ignored columns: {summary.unknownColumns.join(', ')}</div>
          )}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
              <thead>
                <tr>{['#', 'Company', 'Result', 'Details'].map((h) => (
                  <th key={h} style={{ textAlign: 'left', padding: '6px 10px', color: '#a1a3b8', fontSize: '0.6875rem', textTransform: 'uppercase', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {summary.results.map((r) => (
                  <tr key={r.row}>
                    <td style={{ padding: '6px 10px', color: '#6e7089' }}>{r.row}</td>
                    <td style={{ padding: '6px 10px', color: '#f4f4fa' }}>
                      {r.leadId ? <Link href={`/leads/${r.leadId}`} style={{ color: '#f4f4fa' }}>{r.companyName}</Link> : r.companyName}
                    </td>
                    <td style={{ padding: '6px 10px', color: STATUS_COLOR[r.status] ?? '#a1a3b8', fontWeight: 600 }}>{r.status.replace(/_/g, ' ')}</td>
                    <td style={{ padding: '6px 10px', color: '#a1a3b8' }}>{[r.reason, ...(r.warnings ?? [])].filter(Boolean).join(' · ')}</td>
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
