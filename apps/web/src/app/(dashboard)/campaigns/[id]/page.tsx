import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Header } from '@/components/header';
import { serverApiFetch } from '@/lib/server-api-client';
import { LeadPriority, PriorityBadge, ReadinessMeter, NeedsYouBadge } from '@/components/lead-priority';
import { CampaignSummary, STATUS_COLOR } from '../shared';
import { AddLeads, CampaignControls, PickableLead, RemoveLeadButton } from './campaign-controls';

interface CampaignLead {
  id: string;
  status: string;
  company: { name: string };
  primaryContact?: { firstName: string; lastName?: string | null; email: string } | null;
  priority: LeadPriority;
}
interface CampaignDetail extends CampaignSummary { leads: CampaignLead[] }

const panel: React.CSSProperties = { background: '#111318', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: 16 };
const th: React.CSSProperties = { textAlign: 'left', padding: '8px 12px', fontSize: '0.6875rem', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid rgba(255,255,255,0.06)' };
const td: React.CSSProperties = { padding: '10px 12px', fontSize: '0.8125rem', borderBottom: '1px solid rgba(255,255,255,0.04)' };

export default async function CampaignDetailPage({ params }: { params: { id: string } }) {
  const [campaignRes, candidatesRes] = await Promise.all([
    serverApiFetch<CampaignDetail>(`/campaigns/${params.id}`),
    serverApiFetch<{ items: PickableLead[] }>('/leads?unassigned=true&sort=priority&limit=100'),
  ]);
  if (!campaignRes.data) notFound();
  const c = campaignRes.data;
  const closed = c.status === 'COMPLETED' || c.status === 'ARCHIVED';
  const stat = (label: string, value: React.ReactNode) => (
    <div key={label}>
      <div style={{ color: '#f3f4f6', fontSize: '1.25rem', fontWeight: 600 }}>{value}</div>
      <div style={{ color: '#64748b', fontSize: '0.6875rem', textTransform: 'uppercase' }}>{label}</div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      <Header title={`Campaign: ${c.name}`} />
      <div style={{ padding: 24, display: 'grid', gap: 16 }}>
        <Link href="/campaigns" style={{ color: '#818cf8', fontSize: '0.8125rem' }}>← All campaigns</Link>

        <section style={{ ...panel, display: 'grid', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ color: STATUS_COLOR[c.status] ?? '#9ca3af', fontWeight: 700, fontSize: '0.75rem', letterSpacing: '0.05em' }}>{c.status}</span>
            {c.description && <span style={{ color: '#9ca3af', fontSize: '0.8125rem' }}>{c.description}</span>}
          </div>
          {c.status !== 'ACTIVE' && !closed && (
            <div style={{ color: '#fbbf24', fontSize: '0.8125rem' }}>
              The AI will not reply to or follow up this campaign's leads while it is {c.status.toLowerCase()}. You can still send manually.
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 12 }}>
            {stat('Leads', c.stats.totalLeads)}
            {stat('Contacted', c.stats.contacted)}
            {stat('Replied', c.stats.replied)}
            {stat('Reply rate', c.stats.replyRate == null ? '—' : `${c.stats.replyRate}%`)}
            {stat('Needs you', c.stats.needsHuman)}
            {stat('Won', c.stats.won)}
            {stat('Avg priority', c.stats.averagePriority ?? '—')}
          </div>
          <CampaignControls campaignId={c.id} status={c.status} transitions={c.allowedTransitions} />
        </section>

        <section style={panel}>
          <h2 style={{ margin: '0 0 12px', fontSize: '0.875rem', fontWeight: 600, color: '#f3f4f6' }}>Leads in this campaign</h2>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>{['Company', 'Priority', 'Deal readiness', 'Stage', ''].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
              <tbody>
                {c.leads.length === 0 && <tr><td colSpan={5} style={{ ...td, color: '#64748b', textAlign: 'center' }}>No leads yet. Add some below.</td></tr>}
                {c.leads.map((l) => (
                  <tr key={l.id}>
                    <td style={td}><Link href={`/leads/${l.id}`} style={{ color: '#f3f4f6', fontWeight: 600, textDecoration: 'none' }}>{l.company.name}</Link></td>
                    <td style={td}><span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}><PriorityBadge priority={l.priority} /><NeedsYouBadge priority={l.priority} /></span></td>
                    <td style={td}><ReadinessMeter priority={l.priority} /></td>
                    <td style={{ ...td, color: '#9ca3af' }}>{l.status.replace(/_/g, ' ')}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{!closed && <RemoveLeadButton campaignId={c.id} leadId={l.id} />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section style={panel}>
          <h2 style={{ margin: '0 0 12px', fontSize: '0.875rem', fontWeight: 600, color: '#f3f4f6' }}>Add leads</h2>
          <AddLeads campaignId={c.id} candidates={candidatesRes.data?.items ?? []} disabled={closed} />
        </section>
      </div>
    </div>
  );
}
