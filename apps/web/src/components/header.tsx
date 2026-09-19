'use client';

import React from 'react';
import { useAuth } from '@/lib/auth-context';

export function Header({ title }: { title: string }) {
  const { user, logout } = useAuth();

  return (
    <header style={{
      height: '60px',
      borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
      backgroundColor: '#111318',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 24px',
      position: 'sticky',
      top: 0,
      zIndex: 10,
    }}>
      {/* Title */}
      <div>
        <h1 style={{
          fontSize: '1.0625rem',
          fontWeight: 600,
          color: '#f3f4f6',
          letterSpacing: '-0.015em',
        }}>
          {title}
        </h1>
      </div>

      {/* User Info & Logout */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        {user && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.8125rem', fontWeight: 500, color: '#f3f4f6' }}>
                {user.name}
              </div>
              <div style={{ fontSize: '0.6875rem', color: '#64748b', fontVariantNumeric: 'tabular-nums' }}>
                {user.email}
              </div>
            </div>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '2px 7px',
                fontSize: '0.625rem',
                fontWeight: 600,
                borderRadius: '4px',
                backgroundColor: 'rgba(99, 102, 241, 0.12)',
                color: '#818cf8',
                border: '1px solid rgba(99, 102, 241, 0.25)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              {user.role}
            </span>
          </div>
        )}

        <button
          onClick={logout}
          className="btn-secondary"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 12px',
            fontSize: '0.78125rem',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          <span>Sign Out</span>
        </button>
      </div>
    </header>
  );
}
