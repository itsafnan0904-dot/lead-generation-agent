'use client';

import React, { useState } from 'react';
import { useAuth } from '@/lib/auth-context';

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e?: React.FormEvent | React.KeyboardEvent | React.MouseEvent) => {
    if (e && typeof e.preventDefault === 'function') {
      e.preventDefault();
    }
    if (!email.trim() || !password.trim()) {
      setError('Please enter both your work email and password.');
      return;
    }
    setError(null);
    setIsSubmitting(true);

    try {
      const result = await login(email.trim(), password);
      if (!result.success) {
        setError(result.error || 'Invalid email or password');
        setIsSubmitting(false);
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred. Please try again.');
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px 16px',
      backgroundColor: '#141415',
      
    }}>
      {/* Brand & Auth Container */}
      <div style={{
        width: '100%',
        maxWidth: '380px',
      }}>
        {/* Product Identity Header */}
        <div style={{
          textAlign: 'center',
          marginBottom: '24px',
        }}>
          {/* Restrained Technical Badge */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '38px',
            height: '38px',
            borderRadius: '8px',
            backgroundColor: '#1e1e20',
            border: '1px solid rgba(237, 237, 237, 0.09)',
            color: '#86a9f2',
            marginBottom: '16px',
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <h1 style={{
            fontSize: '1.125rem',
            fontWeight: 500,
            color: '#ededed',
            marginBottom: '4px',
          }}>
            AI Sales Agent
          </h1>
          <p style={{
            fontSize: '0.8125rem',
            color: '#a1a1a6',
            lineHeight: 1.45,
          }}>
            Sign in to continue
          </p>
        </div>

        {/* Surface Card Container */}
        <div style={{
          backgroundColor: '#19191b',
          border: '1px solid rgba(237, 237, 237, 0.09)',
          borderRadius: '12px',
          boxShadow: 'none',
          padding: '24px 24px',
        }}>
          {/* Inline Error Alert */}
          {error && (
            <div style={{
              backgroundColor: 'rgba(229, 72, 77, 0.08)',
              border: '1px solid rgba(229, 72, 77, 0.22)',
              borderRadius: '8px',
              padding: '8px 12px',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '8px',
              color: '#ee7378',
              fontSize: '0.8125rem',
              lineHeight: 1.4,
            }}>
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ flexShrink: 0, marginTop: '2px' }}
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} noValidate>
            <div style={{ marginBottom: '16px' }}>
              <label
                htmlFor="email"
                style={{
                  display: 'block',
                  fontSize: '0.8125rem',
                  fontWeight: 500,
                  color: '#a1a1a6',
                  marginBottom: '4px',
                }}
              >
                Work email
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                className="v2-input"
                placeholder="operator@enterprise.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isSubmitting}
                style={{
                  width: '100%',
                  backgroundColor: '#1e1e20',
                  border: '1px solid rgba(237, 237, 237, 0.09)',
                  borderRadius: '8px',
                  padding: '8px 12px',
                  color: '#ededed',
                  fontSize: '0.875rem',
                  lineHeight: 1.4,
                  outline: 'none',
                }}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '4px',
              }}>
                <label
                  htmlFor="password"
                  style={{
                    display: 'block',
                    fontSize: '0.8125rem',
                    fontWeight: 500,
                    color: '#a1a1a6',
                  }}
                >
                  Password
                </label>
              </div>
              <input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                className="v2-input"
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isSubmitting}
                style={{
                  width: '100%',
                  backgroundColor: '#1e1e20',
                  border: '1px solid rgba(237, 237, 237, 0.09)',
                  borderRadius: '8px',
                  padding: '8px 12px',
                  color: '#ededed',
                  fontSize: '0.875rem',
                  lineHeight: 1.4,
                  outline: 'none',
                }}
              />
            </div>

            <button
              type="submit"
              id="login-submit-button"
              className="v2-btn-primary"
              disabled={isSubmitting}
              onClick={(e) => {
                // Defense-in-depth: Ensure direct click triggers handleSubmit if native form submit is suppressed
                if (!isSubmitting) {
                  handleSubmit(e);
                }
              }}
              style={{
                width: '100%',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#3d6fd8',
                color: '#ffffff',
                border: '1px solid transparent',
                borderRadius: '8px',
                padding: '9.5px 16px',
                fontSize: '0.875rem',
                fontWeight: 500,
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                opacity: isSubmitting ? 0.6 : 1,
                outline: 'none',
              }}
            >
              {isSubmitting ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ animation: 'fast-spin 0.6s linear infinite' }}
                  >
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                  </svg>
                  <span>Authenticating...</span>
                </div>
              ) : (
                <span>Sign in</span>
              )}
            </button>
          </form>
        </div>

        {/* Subdued Footer Metadata */}
        <div style={{
          marginTop: '16px',
          textAlign: 'center',
          fontSize: '0.75rem',
          color: '#85858b',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
        }}>
          <span style={{
            display: 'inline-block',
            width: '5px',
            height: '5px',
            borderRadius: '50%',
            backgroundColor: '#4cc38a',
          }} />
          <span>Finds prospects, writes outreach, hands you the lead when it is ready to talk money</span>
        </div>
      </div>

      <style jsx global>{`
        .v2-input {
          transition: border-color 140ms cubic-bezier(0.23, 1, 0.32, 1), box-shadow 140ms cubic-bezier(0.23, 1, 0.32, 1);
        }
        .v2-input::placeholder {
          color: #85858b;
        }
        .v2-input:hover:not(:disabled) {
          border-color: rgba(237, 237, 237, 0.16) !important;
        }
        .v2-input:focus {
          border-color: #4f82e6 !important;
          box-shadow: 0 0 0 2px rgba(94, 140, 235, 0.2) !important;
        }
        .v2-input:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .v2-btn-primary {
          transition: transform 140ms cubic-bezier(0.23, 1, 0.32, 1), background-color 140ms cubic-bezier(0.23, 1, 0.32, 1);
        }
        .v2-btn-primary:hover:not(:disabled) {
          background-color: #3563c4 !important;
        }
        .v2-btn-primary:active:not(:disabled) {
          transform: scale(0.97);
        }
        .v2-btn-primary:focus-visible {
          box-shadow: 0 0 0 2px #141415, 0 0 0 4px #86a9f2;
        }

        @keyframes fast-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @media (prefers-reduced-motion: reduce) {
          .v2-btn-primary, .v2-input {
            transition: none !important;
          }
          .v2-btn-primary:active:not(:disabled) {
            transform: none !important;
          }
        }
      `}</style>
    </div>
  );
}

