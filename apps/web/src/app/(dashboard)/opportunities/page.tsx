import React from 'react';
import Link from 'next/link';
import { Header } from '@/components/header';
import { serverApiFetch } from '@/lib/server-api-client';
import { LeadPriority, PriorityBadge, ReadinessMeter, NeedsYouBadge } from '@/components/lead-priority';

type ValueByCurrency = Record<string, number>;
interface Item {
  leadId: string;
  company: string;
  contact: string | null;
  status: string;
  valueByCurrency: ValueByCurrency;
  projects: { id: string; title: string; budget: number | null; currency: string; timeline: string | null }[];
  priority: LeadPriority;
}
interface Pipeline {
  stages: { status: string; count: number; valueByCurrency: ValueByCurrency; items: Item[] }[];
  totals: { openValueByCurrency: ValueByCurrency; wonValueByCurrency: ValueByCurrency };
  otherDealsInEarlierStages: number;
}

const money = (v: ValueByCurrency) => {
  const parts = Object.entries(v).map(([cur, amt]) => {
    try { return new Intl.NumberFormat(undefined, { style: 'currency', currency: cur, maximumFractionDigits: 0 }).format(amt); }
    catch { return `${cur} ${amt}`; }
  });
  return parts.length ? parts.join(' + ') : '—';
};

const panel: React.CSSProperties = { background: '#19191b', border: '1px solid rgba(237, 237, 237, 0.09)', borderRadius: 12 };

export default async function OpportunitiesPage() {
  const { data } = await serverApiFetch<Pipeline>('/opportunities');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      <Header title="Opportunities" />
      <div style={{ padding: 24, display: 'grid', gap: 16 }}>
        {!data ? (
          <div style={{ ...panel, padding: 20, color: '#ee7378', fontSize: '0.8125rem' }}>Could not load the deal pipeline.</div>
        ) : (
          <>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
              <div style={{ ...panel, padding: '16px 20px', minWidth: 220 }}>
                <div style={{ color: '#a1a1a6', fontSize: '0.75rem', }}>Open pipeline value</div>
                <div style={{ color: '#ededed', fontSize: '1.25rem', fontWeight: 500 }}>{money(data.totals.openValueByCurrency)}</div>
              </div>
              <div style={{ ...panel, padding: '16px 20px', minWidth: 220 }}>
                <div style={{ color: '#a1a1a6', fontSize: '0.75rem', }}>Won</div>
                <div style={{ color: '#4cc38a', fontSize: '1.25rem', fontWeight: 500 }}>{money(data.totals.wonValueByCurrency)}</div>
              </div>
            </div>
            {data.otherDealsInEarlierStages > 0 && (
              <div style={{ color: '#a1a1a6', fontSize: '0.75rem' }}>
                {data.otherDealsInEarlierStages} more lead(s) have a deal recorded but are still in an earlier stage, so they are not shown here.
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12, alignItems: 'start' }}>
              {data.stages.map((stage) => (
                <section key={stage.status} style={{ ...panel, padding: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
                    <h2 style={{ margin: 0, fontSize: '0.75rem', fontWeight: 500, color: '#ededed', }}>
                      {stage.status.replace(/_/g, ' ')} <span style={{ color: '#85858b' }}>({stage.count})</span>
                    </h2>
                    <span style={{ color: '#a1a1a6', fontSize: '0.75rem' }}>{money(stage.valueByCurrency)}</span>
                  </div>
                  <div style={{ display: 'grid', gap: 8 }}>
                    {stage.items.length === 0 && <div style={{ color: '#85858b', fontSize: '0.75rem' }}>No deals in this stage.</div>}
                    {stage.items.map((it) => (
                      <Link key={it.leadId} href={`/leads/${it.leadId}`} style={{ display: 'grid', gap: 6, padding: 10, borderRadius: 8, background: '#1e1e20', border: '1px solid rgba(237, 237, 237, 0.06)', textDecoration: 'none' }}>
                        <div style={{ color: '#ededed', fontSize: '0.8125rem', fontWeight: 500 }}>{it.company}</div>
                        {it.contact && <div style={{ color: '#a1a1a6', fontSize: '0.75rem' }}>{it.contact}</div>}
                        <div style={{ color: '#c4c4c8', fontSize: '0.75rem' }}>
                          {it.projects.length === 0 ? 'No deal recorded yet' : it.projects.map((p) => p.title).join(', ')}
                          {Object.keys(it.valueByCurrency).length > 0 && <strong style={{ color: '#ededed' }}> · {money(it.valueByCurrency)}</strong>}
                        </div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                          <PriorityBadge priority={it.priority} />
                          <NeedsYouBadge priority={it.priority} />
                        </div>
                        <ReadinessMeter priority={it.priority} />
                      </Link>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
