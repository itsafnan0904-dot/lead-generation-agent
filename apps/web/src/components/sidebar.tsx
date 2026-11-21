'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavItem {
  name: string;
  href: string;
  icon: (active: boolean) => React.ReactNode;
}

export function Sidebar() {
  const pathname = usePathname();
  const [unreadCount, setUnreadCount] = useState<number>(0);

  useEffect(() => {
    let isMounted = true;
    async function loadUnreadCount() {
      try {
        const res = await fetch('/api/notifications?limit=1');
        if (res.ok) {
          const data = await res.json();
          if (isMounted && typeof data.unreadCount === 'number') {
            setUnreadCount(data.unreadCount);
          }
        }
      } catch {
        // Silently ignore network failures in background count badge
      }
    }

    loadUnreadCount();
    const interval = setInterval(loadUnreadCount, 30000); // 30s poll
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [pathname]);

  const navItems: NavItem[] = [
    {
      name: 'Overview',
      href: '/overview',
      icon: (active) => (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={active ? '#818cf8' : '#9ca3af'} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
        </svg>
      ),
    },
    {
      name: 'Leads',
      href: '/leads',
      icon: (active) => (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={active ? '#818cf8' : '#9ca3af'} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      ),
    },
    {
      name: 'Campaigns',
      href: '/campaigns',
      icon: (active) => (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={active ? '#818cf8' : '#9ca3af'} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 2L11 13" />
          <path d="M22 2l-7 20-4-9-9-4 20-7z" />
        </svg>
      ),
    },
    {
      name: 'Opportunities',
      href: '/opportunities',
      icon: (active) => (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={active ? '#818cf8' : '#9ca3af'} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="1" x2="12" y2="23" />
          <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
        </svg>
      ),
    },
    {
      name: 'Companies',
      href: '/companies',
      icon: (active) => (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={active ? '#818cf8' : '#9ca3af'} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
          <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
        </svg>
      ),
    },
    {
      name: 'Import Prospects',
      href: '/discovery',
      icon: (active) => (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={active ? '#818cf8' : '#9ca3af'} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
      ),
    },
    {
      name: 'Conversations',
      href: '/conversations',
      icon: (active) => (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={active ? '#818cf8' : '#9ca3af'} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      ),
    },
    {
      name: 'Agent Activity',
      href: '/activity',
      icon: (active) => (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={active ? '#818cf8' : '#9ca3af'} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
        </svg>
      ),
    },
    {
      name: 'Notifications',
      href: '/notifications',
      icon: (active) => (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={active ? '#818cf8' : '#9ca3af'} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      ),
    },
    {
      name: 'Gmail',
      href: '/gmail',
      icon: (active) => (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={active ? '#818cf8' : '#9ca3af'} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
          <polyline points="22,6 12,13 2,6" />
        </svg>
      ),
    },
    {
      name: 'Seller Profile',
      href: '/onboarding',
      icon: (active) => (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={active ? '#818cf8' : '#9ca3af'} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      ),
    },
    {
      name: 'Settings',
      href: '/settings',
      icon: (active) => (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={active ? '#818cf8' : '#9ca3af'} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      ),
    },
  ];

  return (
    <aside style={{
      width: '250px',
      minHeight: '100vh',
      backgroundColor: '#111318',
      borderRight: '1px solid rgba(255, 255, 255, 0.08)',
      display: 'flex',
      flexDirection: 'column',
      padding: '20px 14px',
    }}>
      {/* Brand Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '0 8px 24px 8px' }}>
        <div style={{
          width: '32px',
          height: '32px',
          borderRadius: '6px',
          backgroundColor: '#161820',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          color: '#818cf8',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
        </div>
        <div>
          <div style={{ fontWeight: 600, fontSize: '0.875rem', color: '#f3f4f6', letterSpacing: '-0.015em' }}>
            AI Sales Agent
          </div>
          <div style={{ fontSize: '0.625rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Enterprise Command
          </div>
        </div>
      </div>

      {/* Navigation List */}
      <nav style={{ display: 'flex', flexDirection: 'column', gap: '3px', flex: 1 }}>
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '8px 12px',
                borderRadius: '6px',
                fontSize: '0.8125rem',
                fontWeight: isActive ? 500 : 400,
                color: isActive ? '#f3f4f6' : '#9ca3af',
                backgroundColor: isActive ? 'rgba(79, 70, 229, 0.12)' : 'transparent',
                border: isActive ? '1px solid rgba(79, 70, 229, 0.25)' : '1px solid transparent',
                transition: 'background-color 140ms cubic-bezier(0.23, 1, 0.32, 1), color 140ms cubic-bezier(0.23, 1, 0.32, 1)',
              }}
            >
              {item.icon(isActive)}
              <span style={{ flex: 1 }}>{item.name}</span>
              {item.name === 'Notifications' && unreadCount > 0 && (
                <span style={{
                  padding: '2px 6px',
                  borderRadius: '4px',
                  fontSize: '0.625rem',
                  fontWeight: 600,
                  backgroundColor: 'rgba(244, 63, 94, 0.15)',
                  color: '#fb7185',
                  border: '1px solid rgba(244, 63, 94, 0.3)',
                  fontVariantNumeric: 'tabular-nums',
                  lineHeight: '1.2',
                }}>
                  {unreadCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer / System Status Info */}
      <div style={{
        marginTop: 'auto',
        padding: '10px 12px',
        backgroundColor: '#161820',
        borderRadius: '6px',
        border: '1px solid rgba(255, 255, 255, 0.06)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981', display: 'inline-block' }} />
          <span style={{ fontSize: '0.71875rem', color: '#9ca3af', fontWeight: 500 }}>Autonomous Engine Active</span>
        </div>
      </div>
    </aside>
  );
}
