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
  HOT: { fg: '#fb7185', bg: 'rgba(244, 63, 94, 0.12)', border: 'rgba(244, 63, 94, 0.3)' },
  WARM: { fg: '#fbbf24', bg: 'rgba(245, 158, 11, 0.12)', border: 'rgba(245, 158, 11, 0.3)' },
  COOL: { fg: '#38bdf8', bg: 'rgba(14, 165, 233, 0.12)', border: 'rgba(14, 165, 233, 0.3)' },
  COLD: { fg: '#a1a3b8', bg: 'rgba(255, 255, 255, 0.05)', border: 'rgba(255, 255, 255, 0.1)' },
  BLOCKED: { fg: '#f43f5e', bg: 'rgba(244, 63, 94, 0.08)', border: 'rgba(244, 63, 94, 0.25)' },
  CLOSED: { fg: '#6e7089', bg: 'rgba(255, 255, 255, 0.04)', border: 'rgba(255, 255, 255, 0.08)' },
};

const READINESS_COLOR = (score: number) => (score >= 75 ? '#10b981' : score >= 45 ? '#a99ef2' : score >= 20 ? '#6e7089' : '#374151');

export function PriorityBadge({ priority }: { priority?: LeadPriority | null }) {
  if (!priority) return <span style={{ color: '#6e7089', fontSize: '0.75rem' }}>—</span>;
  const s = PRIORITY_STYLE[priority.priorityLabel];
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span
        style={{
          padding: '2px 8px', borderRadius: 4, fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.04em',
          color: s.fg, background: s.bg, border: `1px solid ${s.border}`,
        }}
      >
        {priority.priorityLabel}
      </span>
      <span style={{ color: '#a1a3b8', fontSize: '0.75rem', fontVariantNumeric: 'tabular-nums' }}>{priority.priorityScore}</span>
    </span>
  );
}

export function ReadinessMeter({ priority }: { priority?: LeadPriority | null }) {
  if (!priority) return <span style={{ color: '#6e7089', fontSize: '0.75rem' }}>—</span>;
  const pct = Math.max(0, Math.min(100, priority.readinessScore));
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minWidth: 110 }} title={`${priority.readinessLabel.replace('_', ' ')} (${pct}/100)`}>
      <span style={{ flex: 1, height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.08)', overflow: 'hidden', minWidth: 60 }}>
        <span style={{ display: 'block', height: '100%', width: `${pct}%`, background: READINESS_COLOR(pct) }} />
      </span>
      <span style={{ color: '#a1a3b8', fontSize: '0.75rem', fontVariantNumeric: 'tabular-nums', width: 24, textAlign: 'right' }}>{pct}</span>
    </span>
  );
}

export function NeedsYouBadge({ priority }: { priority?: LeadPriority | null }) {
  if (!priority?.needsHuman) return null;
  return (
    <span
      title={priority.humanReasons.join('\n')}
      style={{
        padding: '2px 8px', borderRadius: 4, fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.04em',
        color: '#fbbf24', background: 'rgba(245, 158, 11, 0.12)', border: '1px solid rgba(245, 158, 11, 0.3)',
      }}
    >
      NEEDS YOU
    </span>
  );
}
