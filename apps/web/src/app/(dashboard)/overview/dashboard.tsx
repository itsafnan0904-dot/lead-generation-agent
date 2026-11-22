import React from 'react';
import Link from 'next/link';
import { LeadPriority, PriorityBadge, ReadinessMeter, NeedsYouBadge } from '@/components/lead-priority';

type ValueByCurrency = Record<string, number>;
interface LeadRow {
  id: string;
  status: string;
  company: { name: string };
  priority: LeadPriority;
}

export interface DashboardData {
  health: { status: 'ok' | 'degraded' | 'error' } | null;
  totalLeads: number;
  byStatus: Record<string, number>;
  unread: number;
  needsYou: LeadRow[];
  needsYouTotal: number;
  top: LeadRow[];
  pipeline: { totals: { openValueByCurrency: ValueByCurrency; wonValueByCurrency: ValueByCurrency } } | null;
  activeCampaigns: number;
}

const REPLIED = ['RESPONDED', 'INTERESTED', 'GATHERING_REQUIREMENTS', 'QUALIFIED', 'DEAL_DISCUSSION', 'WON', 'WAITING_FOR_CLIENT'];
const FUNNEL: { status: string; label: string }[] = [
  { status: 'COLD_LEAD', label: 'New' },
  { status: 'CONTACTED', label: 'Contacted' },
  { status: 'RESPONDED', label: 'Replied' },
  { status: 'INTERESTED', label: 'Interested' },
  { status: 'QUALIFIED', label: 'Qualified' },
  { status: 'DEAL_DISCUSSION', label: 'Deal' },
  { status: 'WON', label: 'Won' },
];

const money = (v?: ValueByCurrency) => {
  const parts = Object.entries(v ?? {}).map(([cur, amt]) => {
    try { return new Intl.NumberFormat('en-US', { style: 'currency', currency: cur, maximumFractionDigits: 0 }).format(amt); }
    catch { return `${cur} ${amt}`; }
  });
  return parts.length ? parts.join(' + ') : '$0';
};
const count = (by: Record<string, number>, statuses: string[]) => statuses.reduce((n, s) => n + (by[s] ?? 0), 0);

function Icon({ d }: { d: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
  );
}

export function Dashboard({ data }: { data: DashboardData }) {
  const { byStatus: by } = data;
  const contacted = Object.entries(by).filter(([s]) => s !== 'COLD_LEAD' && s !== 'RESTRICTED').reduce((n, [, c]) => n + c, 0);
  const replied = count(by, REPLIED);
  const replyRate = contacted > 0 ? Math.round((replied / contacted) * 100) : null;
  const active = Object.entries(by).filter(([s]) => !['WON', 'LOST', 'RESTRICTED', 'DISQUALIFIED'].includes(s)).reduce((n, [, c]) => n + c, 0);
  const won = by.WON ?? 0;
  const healthy = data.health?.status === 'ok';
  const max = Math.max(1, ...FUNNEL.map((f) => by[f.status] ?? 0));

  return (
    <div className="dash">
      {/* Row 1: headline number + two quick counts */}
      <div className="dash-top">
        <section className="hero" aria-label="Pipeline value">
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <div className="hero-label">Open pipeline value</div>
              <div className="hero-value">{money(data.pipeline?.totals.openValueByCurrency)}</div>
              <div className="hero-sub">{won > 0 ? `${money(data.pipeline?.totals.wonValueByCurrency)} won · ` : ''}{active} lead{active === 1 ? '' : 's'} in play</div>
            </div>
            <span className="pill pill-light" style={{ alignSelf: 'flex-start' }}>{data.health ? (healthy ? 'System healthy' : 'System degraded') : 'Status unavailable'}</span>
          </div>
          <div className="hero-stats">
            <div className="hero-stat"><b>{data.totalLeads}</b><span>Total leads</span></div>
            <div className="hero-stat"><b>{data.needsYouTotal}</b><span>Need you</span></div>
            <div className="hero-stat"><b>{replyRate === null ? '—' : `${replyRate}%`}</b><span>Reply rate</span></div>
            <div className="hero-stat"><b>{won}</b><span>Won</span></div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 20, flexWrap: 'wrap' }}>
            <Link href="/opportunities" className="btn btn-light">View pipeline</Link>
            <Link href="/discovery" className="btn btn-ghost-light">Import prospects</Link>
          </div>
        </section>

        <div className="dash-side">
          <Link href="/leads" className="card stat" aria-label="Leads that need you">
            <div>
              <div className="stat-value">{data.needsYouTotal}</div>
              <div className="stat-label">Waiting on you</div>
            </div>
            <span className="stat-icon"><Icon d="M12 8v4l3 3M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" /></span>
          </Link>
          <Link href="/notifications" className="card stat" aria-label="Unread notifications">
            <div>
              <div className="stat-value">{data.unread}</div>
              <div className="stat-label">Unread notifications</div>
            </div>
            <span className="stat-icon"><Icon d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" /></span>
          </Link>
        </div>
      </div>

      {/* Row 2: at a glance + pipeline by stage */}
      <div className="dash-mid">
        <section className="card" aria-label="At a glance">
          <div className="card-head"><div><h2 className="card-title">At a glance</h2><p className="card-sub">Where your leads stand</p></div></div>
          <div className="rows">
            <div className="row"><span className="row-label">Contacted</span><span className="row-value">{contacted}</span></div>
            <div className="row"><span className="row-label">Replied</span><span className="row-value">{replied}</span></div>
            <div className="row"><span className="row-label">Qualified or further</span><span className="row-value">{count(by, ['QUALIFIED', 'DEAL_DISCUSSION', 'WON'])}</span></div>
            <div className="row"><span className="row-label">Active campaigns</span><span className="row-value">{data.activeCampaigns}</span></div>
            <div className="row"><span className="row-label">Blocked by restrictions</span><span className="row-value">{by.RESTRICTED ?? 0}</span></div>
          </div>
        </section>

        <section className="card" aria-label="Pipeline by stage">
          <div className="card-head">
            <div><h2 className="card-title">Pipeline by stage</h2><p className="card-sub">{data.totalLeads > 100 ? 'Your 100 most recent leads' : 'All leads'}</p></div>
          </div>
          <div className="bars" role="img" aria-label={FUNNEL.map((f) => `${f.label}: ${by[f.status] ?? 0}`).join(', ')}>
            {FUNNEL.map((f) => {
              const n = by[f.status] ?? 0;
              return (
                <div className="bar-col" key={f.status}>
                  <div style={{ alignSelf: 'end', width: '100%', display: 'flex', justifyContent: 'center', height: '100%', alignItems: 'flex-end' }}>
                    <div className={`bar${n === max ? " lead" : ""}`} style={{ height: `${Math.max(2, (n / max) * 100)}%` }} />
                  </div>
                  <span className="bar-num">{n}</span>
                  <span className="bar-label">{f.label}</span>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* Row 3: top leads + who needs you */}
      <div className="dash-bottom">
        <section className="card" aria-label="Top priority leads">
          <div className="card-head">
            <div><h2 className="card-title">Top priority leads</h2><p className="card-sub">Ranked by fit, readiness and recent replies</p></div>
            <Link href="/leads" style={{ color: 'var(--accent-primary-light)', fontSize: '0.75rem', fontWeight: 500 }}>View all</Link>
          </div>
          <div className="table-wrap">
            <table className="tbl">
              <thead><tr><th>Company</th><th>Priority</th><th>Readiness</th><th>Stage</th><th>Next action</th></tr></thead>
              <tbody>
                {data.top.length === 0 && <tr><td colSpan={5} style={{ color: 'var(--text-muted)', textAlign: 'center' }}>No leads yet. Import prospects to get started.</td></tr>}
                {data.top.map((l) => (
                  <tr key={l.id}>
                    <td><Link href={`/leads/${l.id}`} style={{ fontWeight: 500 }}>{l.company.name}</Link></td>
                    <td><span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}><PriorityBadge priority={l.priority} /><NeedsYouBadge priority={l.priority} /></span></td>
                    <td><ReadinessMeter priority={l.priority} /></td>
                    <td style={{ color: 'var(--text-secondary)' }}>{l.status.replace(/_/g, ' ').toLowerCase()}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{l.priority.nextAction}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card" aria-label="Needs your attention">
          <div className="card-head"><div><h2 className="card-title">Needs your attention</h2><p className="card-sub">The AI has stepped back on these</p></div></div>
          {data.needsYou.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>Nothing needs you right now. The AI is handling your leads.</p>
          ) : (
            <div className="rows">
              {data.needsYou.map((l) => (
                <Link key={l.id} href={`/leads/${l.id}`} className="row" style={{ alignItems: 'flex-start' }}>
                  <span className="row-label" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{l.company.name}</span>
                    <span style={{ fontSize: '0.75rem' }}>{l.priority.humanReasons.join(' · ') || l.priority.nextAction}</span>
                  </span>
                  <span className="pill pill-warn">Your turn</span>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
