import type React from 'react';

export interface Service { id: string; name: string; description?: string | null; keywords: string[]; priceMin?: string | null; priceMax?: string | null; currency: string }
export interface Market { id: string; countryCode: string; industries: string[]; regions: string[] }
export interface Restriction { id: string; type: 'SERVICE' | 'INDUSTRY' | 'KEYWORD'; value: string; reason?: string | null }
export interface Intervention { id: string; trigger: string; threshold?: string | null; keyword?: string | null; note?: string | null }
export interface Profile {
  id: string; displayName: string; companyName?: string | null; title?: string | null; bio?: string | null;
  skills: string[]; yearsExperience?: number | null; tone?: string | null; signature?: string | null;
  resumeFileName?: string | null; onboardingComplete: boolean;
  services: Service[]; targetMarkets: Market[]; restrictionRules: Restriction[]; interventionRules: Intervention[];
}

export type RunFn = (fn: () => Promise<{ ok: boolean; error: string | null }>, okMsg?: string) => Promise<boolean>;
export type StepProps = { profile: Profile; busy: boolean; run: RunFn };

export const STEPS = ['Profile', 'Resume', 'Services', 'Target countries', 'Restrictions', 'Human handoff', 'Review'] as const;

export const COUNTRIES: Record<string, string> = {
  US: 'United States', CA: 'Canada', GB: 'United Kingdom', AU: 'Australia', DE: 'Germany', FR: 'France',
  NL: 'Netherlands', SE: 'Sweden', IE: 'Ireland', AE: 'United Arab Emirates', SA: 'Saudi Arabia',
  SG: 'Singapore', IN: 'India', PK: 'Pakistan', NZ: 'New Zealand', ES: 'Spain', IT: 'Italy',
};

export const TRIGGERS: Record<string, { label: string; needs?: 'threshold' | 'keyword'; hint?: string }> = {
  PRICING_DISCUSSION: { label: 'Client asks about pricing' },
  CONTRACT_OR_LEGAL: { label: 'Contract or legal terms come up' },
  MEETING_REQUESTED: { label: 'Client requests a call or meeting' },
  OBJECTION_RAISED: { label: 'Client raises an objection' },
  DEAL_VALUE_ABOVE: { label: 'Deal value is above…', needs: 'threshold', hint: 'amount' },
  READINESS_ABOVE: { label: 'Deal readiness is above…', needs: 'threshold', hint: '0–100' },
  CUSTOM_KEYWORD: { label: 'Message contains keyword…', needs: 'keyword' },
};

export const csv = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);

export const input: React.CSSProperties = {
  width: '100%', padding: '8px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)',
  background: 'var(--bg-surface-subtle)', color: 'var(--text-primary)', fontSize: '0.8125rem', fontFamily: 'inherit',
};
export const label: React.CSSProperties = { display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 6, fontWeight: 500 };
export const btn = (primary = false): React.CSSProperties => ({
  padding: '8px 16px', borderRadius: 'var(--radius-sm)', fontSize: '0.8125rem', fontWeight: 500, cursor: 'pointer',
  border: primary ? '1px solid transparent' : '1px solid var(--border-default)',
  background: primary ? 'var(--accent-primary)' : 'transparent', color: primary ? 'var(--text-inverse)' : 'var(--text-primary)',
});
export const card: React.CSSProperties = { background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', padding: 20 };
export const row: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 12px', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', background: 'var(--bg-surface-subtle)' };
export const hint: React.CSSProperties = { color: 'var(--text-secondary)', fontSize: '0.8125rem', margin: 0 };
export const empty: React.CSSProperties = { color: 'var(--text-muted)', fontSize: '0.8125rem' };

export async function api<T = any>(path: string, method = 'GET', body?: unknown): Promise<{ ok: boolean; status: number; data: T | null; error: string | null }> {
  try {
    const res = await fetch(`/api/seller-profile${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      const msg = json?.error;
      return { ok: false, status: res.status, data: null, error: Array.isArray(msg) ? msg.join('; ') : msg || `Request failed (${res.status})` };
    }
    return { ok: true, status: res.status, data: json, error: null };
  } catch {
    return { ok: false, status: 0, data: null, error: 'Network error' };
  }
}
