import React from 'react';
import Link from 'next/link';
import { LeadPriority, PriorityBadge, ReadinessMeter, NeedsYouBadge } from '@/components/lead-priority';

export interface BoardLead {
  id: string;
  status: string;
  company: { name: string };
  priority: LeadPriority;
}

const th: React.CSSProperties = {
  textAlign: 'left', padding: '8px 12px', fontSize: '0.6875rem', fontWeight: 600, color: '#9ca3af',
  textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid rgba(255,255,255,0.06)',
};
const td: React.CSSProperties = { padding: '10px 12px', fontSize: '0.8125rem', borderBottom: '1px solid rgba(255,255,255,0.04)' };
const panel: React.CSSProperties = { background: '#111318', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, overflow: 'hidden' };
const heading: React.CSSProperties = { margin: 0, fontSize: '0.875rem', fontWeight: 600, color: '#f3f4f6' };

/** Dashboard section: leads that need the user, then the ranked pipeline. */
export function PriorityBoard({ needsYou, topLeads }: { needsYou: BoardLead[]; topLeads: BoardLead[] }) {
  return (
    <div style={{ display: 'grid', gap: 16, padding: '24px 24px 0' }}>
      <section style={panel}>
        <div style={{ padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <h2 style={heading}>Needs your attention ({needsYou.length})</h2>
          <Link href="/leads" style={{ color: '#818cf8', fontSize: '0.75rem' }}>All leads →</Link>
        </div>
        {needsYou.length === 0 ? (
          <div style={{ padding: 16, color: '#64748b', fontSize: '0.8125rem' }}>Nothing needs you right now. The AI is handling your leads.</div>
        ) : (
          <div>
            {needsYou.map((l) => (
              <Link key={l.id} href={`/leads/${l.id}`} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)', textDecoration: 'none', color: 'inherit' }}>
                <span style={{ fontWeight: 600, fontSize: '0.8125rem', color: '#f3f4f6', minWidth: 160 }}>{l.company.name}</span>
                <NeedsYouBadge priority={l.priority} />
                <span style={{ color: '#9ca3af', fontSize: '0.8125rem', flex: 1 }}>{l.priority.humanReasons.join(' · ')}</span>
                <ReadinessMeter priority={l.priority} />
              </Link>
            ))}
          </div>
        )}
      </section>

      <section style={panel}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <h2 style={heading}>Lead pipeline — ranked by priority</h2>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={th}>Company</th><th style={th}>Priority</th><th style={th}>Deal readiness</th>
                <th style={th}>Stage</th><th style={th}>Next action</th>
              </tr>
            </thead>
            <tbody>
              {topLeads.length === 0 && (
                <tr><td colSpan={5} style={{ ...td, color: '#64748b', textAlign: 'center' }}>No leads yet.</td></tr>
              )}
              {topLeads.map((l) => (
                <tr key={l.id}>
                  <td style={td}><Link href={`/leads/${l.id}`} style={{ color: '#f3f4f6', fontWeight: 600, textDecoration: 'none' }}>{l.company.name}</Link></td>
                  <td style={td}><span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}><PriorityBadge priority={l.priority} /><NeedsYouBadge priority={l.priority} /></span></td>
                  <td style={td}><ReadinessMeter priority={l.priority} /></td>
                  <td style={{ ...td, color: '#9ca3af' }}>{l.status.replace(/_/g, ' ')}</td>
                  <td style={{ ...td, color: '#9ca3af' }}>{l.priority.nextAction}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
