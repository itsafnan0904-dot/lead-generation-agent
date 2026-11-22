import React from 'react';

export interface LeadPriority {
  priorityScore: number;
  priorityLabel: 'HOT' | 'WARM' | 'COOL' | 'COLD' | 'BLOCKED' | 'CLOSED';
  readinessScore: number;
  readinessLabel: 'READY' | 'ADVANCING' | 'EARLY' | 'NOT_READY';
  needsHuman: boolean;
  humanReasons: string[];
  nextAction: string;
}

const PRIORITY_STYLE: Record<LeadPriority['priorityLabel'], { fg: string; bg: string; border: string }> = {
  HOT: { fg: '#ee7378', bg: 'rgba(229, 72, 77, 0.12)', border: 'rgba(237, 237, 237, 0.09)' },
  WARM: { fg: '#e3a94d', bg: 'rgba(227, 169, 77, 0.12)', border: 'rgba(237, 237, 237, 0.09)' },
  COOL: { fg: '#86a9f2', bg: 'rgba(94, 140, 235, 0.12)', border: 'rgba(237, 237, 237, 0.09)' },
  COLD: { fg: '#a1a1a6', bg: 'rgba(237, 237, 237, 0.06)', border: 'rgba(237, 237, 237, 0.09)' },
  BLOCKED: { fg: '#e5484d', bg: 'rgba(229, 72, 77, 0.08)', border: 'rgba(237, 237, 237, 0.09)' },
  CLOSED: { fg: '#85858b', bg: 'rgba(237, 237, 237, 0.06)', border: 'rgba(237, 237, 237, 0.09)' },
};

const READINESS_COLOR = (score: number) => (score >= 75 ? '#4cc38a' : score >= 45 ? '#86a9f2' : score >= 20 ? '#85858b' : '#3a3a3e');

const sentence = (v: string) => v.charAt(0) + v.slice(1).toLowerCase();

export function PriorityBadge({ priority }: { priority?: LeadPriority | null }) {
  if (!priority) return <span style={{ color: '#85858b', fontSize: '0.75rem' }}>—</span>;
  const s = PRIORITY_STYLE[priority.priorityLabel];
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: '0.8125rem', color: '#ededed' }}>
      <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', background: s.fg, flexShrink: 0 }} />
      {sentence(priority.priorityLabel)}
      <span style={{ color: '#85858b', fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>{priority.priorityScore}</span>
    </span>
  );
}

export function ReadinessMeter({ priority }: { priority?: LeadPriority | null }) {
  if (!priority) return <span style={{ color: '#85858b', fontSize: '0.75rem' }}>—</span>;
  const pct = Math.max(0, Math.min(100, priority.readinessScore));
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minWidth: 110 }} title={`${priority.readinessLabel.replace('_', ' ')} (${pct}/100)`}>
      <span style={{ flex: 1, height: 5, borderRadius: 4, background: 'rgba(237, 237, 237, 0.09)', overflow: 'hidden', minWidth: 60 }}>
        <span style={{ display: 'block', height: '100%', width: `${pct}%`, background: READINESS_COLOR(pct) }} />
      </span>
      <span style={{ color: '#a1a1a6', fontSize: '0.75rem', fontVariantNumeric: 'tabular-nums', width: 24, textAlign: 'right' }}>{pct}</span>
    </span>
  );
}

export function NeedsYouBadge({ priority }: { priority?: LeadPriority | null }) {
  if (!priority?.needsHuman) return null;
  return (
    <span
      title={priority.humanReasons.join('\n')}
      style={{
        padding: '2px 8px', borderRadius: 4, fontSize: '0.75rem', fontWeight: 500,
        color: '#e3a94d', background: 'rgba(227, 169, 77, 0.12)',
      }}
    >
      Needs you
    </span>
  );
}
