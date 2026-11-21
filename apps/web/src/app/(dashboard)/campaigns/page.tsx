import React from 'react';
import Link from 'next/link';
import { Header } from '@/components/header';
import { serverApiFetch } from '@/lib/server-api-client';
import { CampaignSummary, STATUS_COLOR } from './shared';
import { NewCampaignForm } from './new-campaign-form';

const panel: React.CSSProperties = { background: '#151628', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10 };

export default async function CampaignsPage() {
  const { data } = await serverApiFetch<CampaignSummary[]>('/campaigns');
  const campaigns = data ?? [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      <Header title="Campaigns" />
      <div style={{ padding: 24, display: 'grid', gap: 16, maxWidth: 1100 }}>
        <p style={{ color: '#a1a3b8', fontSize: '0.8125rem', margin: 0 }}>
          Group leads into named campaigns. The AI only replies to and follows up leads in an <strong style={{ color: '#34d399' }}>active</strong> campaign
          (or in no campaign), so pausing a campaign stops the AI for all its leads at once.
        </p>

        <NewCampaignForm />

        {campaigns.length === 0 ? (
          <div style={{ ...panel, padding: 20, color: '#6e7089', fontSize: '0.8125rem' }}>No campaigns yet. Create one above, then add leads to it.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
            {campaigns.map((c) => (
              <Link key={c.id} href={`/campaigns/${c.id}`} style={{ ...panel, padding: 16, textDecoration: 'none', display: 'grid', gap: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: '#f4f4fa', fontWeight: 600, fontSize: '0.9375rem' }}>{c.name}</span>
                  <span style={{ color: STATUS_COLOR[c.status] ?? '#a1a3b8', fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.04em' }}>{c.status}</span>
                </div>
                {c.description && <div style={{ color: '#a1a3b8', fontSize: '0.8125rem' }}>{c.description}</div>}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                  {[
                    ['Leads', c.stats.totalLeads],
                    ['Contacted', c.stats.contacted],
                    ['Replied', c.stats.replied],
                    ['Won', c.stats.won],
                  ].map(([label, value]) => (
                    <div key={label as string}>
                      <div style={{ color: '#f4f4fa', fontSize: '1.125rem', fontWeight: 600 }}>{value}</div>
                      <div style={{ color: '#6e7089', fontSize: '0.6875rem', textTransform: 'uppercase' }}>{label}</div>
                    </div>
                  ))}
                </div>
                <div style={{ color: '#a1a3b8', fontSize: '0.75rem' }}>
                  Reply rate: {c.stats.replyRate == null ? '—' : `${c.stats.replyRate}%`}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
