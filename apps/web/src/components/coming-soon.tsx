import React from 'react';
import Link from 'next/link';

export function ComingSoon({ screenName, description }: { screenName: string; description?: string }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '80px 24px',
      textAlign: 'center',
    }}>
      <div className="glass-card" style={{
        maxWidth: '560px',
        width: '100%',
        padding: '48px 36px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}>
        <div style={{
          width: '64px',
          height: '64px',
          borderRadius: '16px',
          backgroundColor: 'rgba(94, 140, 235, 0.15)',
          border: '1px solid rgba(237, 237, 237, 0.09)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '20px',
          color: '#86a9f2',
        }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        </div>

        <span className="badge badge-info" style={{ marginBottom: '12px' }}>
          Prompt 16 Placeholder
        </span>

        <h2 style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
          {screenName}
        </h2>

        <p style={{ fontSize: '0.9375rem', color: 'var(--text-secondary)', marginBottom: '32px', lineHeight: 1.5 }}>
          {description || `The ${screenName} screen is scheduled in subsequent tasks. The backend services and APIs are active and verified.`}
        </p>

        <Link href="/overview" className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          <span>Return to Overview</span>
        </Link>
      </div>
    </div>
  );
}
