import React from 'react';
import { LeadPriority, PriorityBadge, ReadinessMeter, NeedsYouBadge } from '@/components/lead-priority';

export interface HandoffBriefData {
  headline: string;
  reasons: string[];
  situation: string[];
  qualification: string[];
  recentMessages: { direction: string; sentAt: string; excerpt: string }[];
  suggestedFocus: string[];
}

const box: React.CSSProperties = {
  background: '#19191b', border: '1px solid rgba(237, 237, 237, 0.09)', borderRadius: 12, padding: 20,
};
const h: React.CSSProperties = { margin: '0 0 8px', fontSize: '0.75rem', fontWeight: 500, color: '#a1a1a6', };
const li: React.CSSProperties = { fontSize: '0.8125rem', color: '#c4c4c8', margin: '4px 0' };

/** Priority / readiness summary, plus the handoff brief when the AI needs the human. */
export function HandoffCard({ priority, brief, aiControlState }: { priority?: LeadPriority; brief?: HandoffBriefData | null; aiControlState: string }) {
  if (!priority) return null;
  const urgent = priority.needsHuman;

  return (
    <section style={{ ...box, borderColor: urgent ? 'rgba(237, 237, 237, 0.09)' : 'rgba(237, 237, 237, 0.09)' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <PriorityBadge priority={priority} />
        <NeedsYouBadge priority={priority} />
        <ReadinessMeter priority={priority} />
        <span style={{ color: '#a1a1a6', fontSize: '0.8125rem' }}>
          AI: {aiControlState === 'AI_ACTIVE' ? 'active' : aiControlState === 'PAUSED' ? 'paused' : 'taken over'}
        </span>
      </div>
      <div style={{ color: '#ededed', fontSize: '0.9375rem', fontWeight: 500, marginBottom: 4 }}>{brief?.headline ?? priority.nextAction}</div>
      <div style={{ color: '#a1a1a6', fontSize: '0.8125rem', marginBottom: urgent ? 16 : 0 }}>Next action: {priority.nextAction}</div>

      {urgent && brief && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20 }}>
          <div>
            <h3 style={h}>Why you are needed</h3>
            <ul style={{ margin: 0, paddingLeft: 20 }}>{brief.reasons.map((r) => <li key={r} style={li}>{r}</li>)}</ul>
            {brief.suggestedFocus.length > 0 && (<>
              <h3 style={{ ...h, marginTop: 16 }}>Do this first</h3>
              <ul style={{ margin: 0, paddingLeft: 20 }}>{brief.suggestedFocus.map((f) => <li key={f} style={li}>{f}</li>)}</ul>
            </>)}
          </div>
          <div>
            <h3 style={h}>Where things stand</h3>
            <ul style={{ margin: 0, paddingLeft: 20 }}>{brief.situation.map((s) => <li key={s} style={li}>{s}</li>)}</ul>
            {brief.qualification.length > 0 && (<>
              <h3 style={{ ...h, marginTop: 16 }}>Qualification</h3>
              <ul style={{ margin: 0, paddingLeft: 20 }}>{brief.qualification.map((s) => <li key={s} style={li}>{s}</li>)}</ul>
            </>)}
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <h3 style={h}>Recent messages</h3>
            {brief.recentMessages.map((m, i) => (
              <div key={i} style={{ ...li, padding: '6px 10px', margin: '4px 0', borderRadius: 8, background: m.direction === 'INBOUND' ? 'rgba(129,140,248,0.08)' : 'rgba(237, 237, 237, 0.03)' }}>
                <strong style={{ color: m.direction === 'INBOUND' ? '#86a9f2' : '#a1a1a6' }}>{m.direction === 'INBOUND' ? 'Client' : 'AI/You'}</strong>
                <span style={{ color: '#85858b' }}> · {new Date(m.sentAt).toLocaleString()}</span>
                <div>{m.excerpt}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
