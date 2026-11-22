import React from 'react';

/** Flat status dot plus a word: the product's one signature detail. No glow, no pulse. */
export type DotTone = 'active' | 'paused' | 'turn' | 'blocked' | 'idle';
const toneColor: Record<DotTone, string> = {
  active: 'var(--accent-success)',
  paused: 'var(--accent-warning)',
  turn: 'var(--accent-primary-light)',
  blocked: 'var(--accent-danger)',
  idle: 'var(--text-muted)',
};

export function StatusDot({ tone, children }: { tone: DotTone; children: React.ReactNode }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: '0.8125rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
      <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', background: toneColor[tone], flexShrink: 0 }} />
      {children}
    </span>
  );
}

/** Line icons: 16px, 1.5 stroke, current colour. */
const paths = {
  arrowLeft: 'M19 12H5M11 18l-6-6 6-6',
  arrowRight: 'M5 12h14M13 6l6 6-6 6',
  external: 'M7 17L17 7M8 7h9v9',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  x: 'M6 6l12 12M18 6L6 18',
  circle: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z',
} as const;

export function Icon({ name, size = 16 }: { name: keyof typeof paths; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path d={paths[name]} />
    </svg>
  );
}

const STATUS_TONE: Record<string, DotTone> = {
  RESTRICTED: 'blocked', DISQUALIFIED: 'blocked', LOST: 'blocked',
  HUMAN_REVIEW: 'paused', WAITING_FOR_CLIENT: 'paused',
  QUALIFIED: 'active', DEAL_DISCUSSION: 'active', WON: 'active',
  CONTACTED: 'turn', INTERESTED: 'turn', RESPONDED: 'turn', GATHERING_REQUIREMENTS: 'turn',
};

/** Lead lifecycle status as a flat dot and a sentence-case word. */
export function LeadStatus({ status }: { status?: string | null }) {
  if (!status) return <span style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>—</span>;
  const label = status.replace(/_/g, ' ').toLowerCase();
  return <StatusDot tone={STATUS_TONE[status] ?? 'idle'}>{label.charAt(0).toUpperCase() + label.slice(1)}</StatusDot>;
}
