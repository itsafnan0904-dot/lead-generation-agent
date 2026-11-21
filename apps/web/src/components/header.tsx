'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useNav } from '@/components/shell';

const field: React.CSSProperties = {
  width: '100%', padding: '8px 12px 8px 34px', borderRadius: 10, border: '1px solid var(--border-subtle)',
  background: 'var(--bg-surface-subtle)', color: 'var(--text-primary)', fontSize: '0.8125rem', fontFamily: 'inherit',
};

function initials(name?: string) {
  return (name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('') || '?';
}

export function Header({ title }: { title: string }) {
  const { user, logout } = useAuth();
  const { toggle } = useNav();
  const router = useRouter();
  const [q, setQ] = useState('');

  const search = (e: React.FormEvent) => {
    e.preventDefault();
    const term = q.trim();
    if (term) router.push(`/companies?search=${encodeURIComponent(term)}`);
  };

  return (
    <header
      style={{
        minHeight: 64, borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-canvas)',
        display: 'flex', alignItems: 'center', gap: 16, padding: '10px 24px', position: 'sticky', top: 0, zIndex: 10,
        flexWrap: 'wrap',
      }}
    >
      <button
        type="button" onClick={toggle} aria-label="Open navigation" className="menu-btn"
        style={{ background: 'transparent', border: '1px solid var(--border-subtle)', borderRadius: 10, color: 'var(--text-secondary)', width: 36, height: 36, cursor: 'pointer', display: 'none', placeItems: 'center' }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M3 6h18M3 12h18M3 18h18" /></svg>
      </button>

      <h1 style={{ fontSize: '1.125rem', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text-primary)', margin: 0, flex: '0 0 auto' }}>{title}</h1>

      <form onSubmit={search} role="search" className="hdr-search" style={{ position: 'relative', flex: '1 1 220px', maxWidth: 360, marginLeft: 'auto' }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" style={{ position: 'absolute', left: 12, top: 11 }} aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search companies…" aria-label="Search companies" style={field} />
      </form>

      <div className="hdr-actions" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Link href="/notifications" aria-label="Notifications" style={{ width: 36, height: 36, borderRadius: 10, border: '1px solid var(--border-subtle)', display: 'grid', placeItems: 'center', color: 'var(--text-secondary)' }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" /></svg>
        </Link>

        {user && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span aria-hidden="true" style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--accent-primary-muted)', color: 'var(--accent-primary-light)', display: 'grid', placeItems: 'center', fontSize: '0.75rem', fontWeight: 700, border: '1px solid rgba(124,110,224,0.3)' }}>
              {initials(user.name)}
            </span>
            <div className="user-meta" style={{ lineHeight: 1.25 }}>
              <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)' }}>{user.name}</div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>{user.role.replace('_', ' ').toLowerCase()}</div>
            </div>
          </div>
        )}

        <button onClick={logout} className="btn" style={{ background: 'transparent', border: '1px solid var(--border-default)', color: 'var(--text-secondary)', padding: '7px 12px' }}>
          Sign out
        </button>
      </div>
    </header>
  );
}
