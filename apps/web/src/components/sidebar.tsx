'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

/** Simple 24x24 line icons: one path string each. */
const ICONS: Record<string, string> = {
  overview: 'M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z',
  leads: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  opportunities: 'M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6',
  campaigns: 'M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z',
  import: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12',
  companies: 'M3 9h18v12H3zM8 9V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v4',
  conversations: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',
  notifications: 'M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0',
  activity: 'M22 12h-4l-3 9L9 3l-3 9H2',
  gmail: 'M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM22 6l-10 7L2 6',
  profile: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h0a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5h0a1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v0a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
};

interface NavItem { name: string; href: string; icon: keyof typeof ICONS }
const GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: 'Dashboard',
    items: [
      { name: 'Overview', href: '/overview', icon: 'overview' },
      { name: 'Leads', href: '/leads', icon: 'leads' },
      { name: 'Opportunities', href: '/opportunities', icon: 'opportunities' },
      { name: 'Campaigns', href: '/campaigns', icon: 'campaigns' },
    ],
  },
  {
    label: 'Work',
    items: [
      { name: 'Import Prospects', href: '/discovery', icon: 'import' },
      { name: 'Companies', href: '/companies', icon: 'companies' },
      { name: 'Conversations', href: '/conversations', icon: 'conversations' },
      { name: 'Notifications', href: '/notifications', icon: 'notifications' },
    ],
  },
  {
    label: 'Setup',
    items: [
      { name: 'Seller Profile', href: '/onboarding', icon: 'profile' },
      { name: 'Gmail', href: '/gmail', icon: 'gmail' },
      { name: 'Agent Activity', href: '/activity', icon: 'activity' },
      { name: 'Settings', href: '/settings', icon: 'settings' },
    ],
  },
];

function Icon({ name, active }: { name: keyof typeof ICONS; active: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={active ? '#86a9f2' : 'currentColor'} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  );
}

export function Sidebar({ open = false }: { open?: boolean }) {
  const pathname = usePathname();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const res = await fetch('/api/notifications?limit=1');
        if (res.ok) {
          const data = await res.json();
          if (alive && typeof data.unreadCount === 'number') setUnread(data.unreadCount);
        }
      } catch {
        // The badge is a convenience; ignore network errors
      }
    }
    load();
    const t = setInterval(load, 30000);
    return () => { alive = false; clearInterval(t); };
  }, [pathname]);

  return (
    <aside
      className={`sidebar${open ? ' open' : ''}`}
      aria-label="Main navigation"
      style={{
        width: 'var(--sidebar-width)', flexShrink: 0, minHeight: '100vh', background: 'var(--bg-surface)',
        borderRight: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', padding: '20px 16px',
      }}
    >
      <Link href="/overview" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 8px 24px' }}>
        <span style={{ width: 34, height: 34, borderRadius: 12, background: 'var(--accent-primary)', display: 'grid', placeItems: 'center', color: '#ffffff', flexShrink: 0 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
        </span>
        <span style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--text-primary)' }}>AI Sales Agent</span>
      </Link>

      <nav style={{ display: 'grid', gap: 20, flex: 1, alignContent: 'start' }}>
        {GROUPS.map((group) => (
          <div key={group.label}>
            <div style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-muted)', padding: '0 10px 6px' }}>
              {group.label}
            </div>
            <div style={{ display: 'grid', gap: 2 }}>
              {group.items.map((item) => {
                const active = pathname === item.href || (item.href !== '/overview' && pathname.startsWith(`${item.href}/`));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 12,
                      fontSize: '0.8125rem', fontWeight: active ? 600 : 500,
                      color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                      background: active ? 'var(--accent-primary-muted)' : 'transparent',
                      transition: 'background-color 150ms var(--ease), color 150ms var(--ease)',
                    }}
                  >
                    <Icon name={item.icon} active={active} />
                    <span style={{ flex: 1 }}>{item.name}</span>
                    {item.icon === 'notifications' && unread > 0 && (
                      <span className="mono" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }} aria-label={`${unread} unread`}>{unread}</span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div style={{ marginTop: 16, padding: '10px 12px', borderRadius: 12, background: 'var(--bg-surface-subtle)', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#4cc38a', flexShrink: 0 }} />
        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 500 }}>AI engine active</span>
      </div>
    </aside>
  );
}
