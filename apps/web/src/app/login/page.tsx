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
      backgroundColor: '#0d0e1b',
      backgroundImage: 'radial-gradient(circle at 50% 0%, rgba(124, 110, 224, 0.04) 0%, transparent 60%)',
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
            borderRadius: '6px',
            backgroundColor: '#1a1b30',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            color: '#a99ef2',
            marginBottom: '14px',
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <h1 style={{
            fontSize: '1.1875rem',
            fontWeight: 600,
            color: '#f4f4fa',
            letterSpacing: '-0.025em',
            marginBottom: '5px',
          }}>
            AI Sales Agent
          </h1>
          <p style={{
            fontSize: '0.8125rem',
            color: '#a1a3b8',
            lineHeight: 1.45,
            letterSpacing: '-0.005em',
          }}>
            Sign in to access your autonomous sales control center
          </p>
        </div>

        {/* Surface Card Container */}
        <div style={{
          backgroundColor: '#151628',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '10px',
          boxShadow: '0 4px 20px -2px rgba(0, 0, 0, 0.6), 0 1px 2px 0 rgba(0, 0, 0, 0.4)',
          padding: '24px 22px',
        }}>
          {/* Inline Error Alert */}
          {error && (
            <div style={{
              backgroundColor: 'rgba(244, 63, 94, 0.08)',
              border: '1px solid rgba(244, 63, 94, 0.22)',
              borderRadius: '6px',
              padding: '9px 12px',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '9px',
              color: '#fb7185',
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
            <div style={{ marginBottom: '14px' }}>
              <label
                htmlFor="email"
                style={{
                  display: 'block',
                  fontSize: '0.78125rem',
                  fontWeight: 500,
                  color: '#a1a3b8',
                  marginBottom: '5px',
                  letterSpacing: '-0.005em',
                }}
              >
                Work Email
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
                  backgroundColor: '#1a1b30',
                  border: '1px solid rgba(255, 255, 255, 0.10)',
                  borderRadius: '6px',
                  padding: '9px 11px',
                  color: '#f4f4fa',
                  fontSize: '0.84375rem',
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
                marginBottom: '5px',
              }}>
                <label
                  htmlFor="password"
                  style={{
                    display: 'block',
                    fontSize: '0.78125rem',
                    fontWeight: 500,
                    color: '#a1a3b8',
                    letterSpacing: '-0.005em',
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
                  backgroundColor: '#1a1b30',
                  border: '1px solid rgba(255, 255, 255, 0.10)',
                  borderRadius: '6px',
                  padding: '9px 11px',
                  color: '#f4f4fa',
                  fontSize: '0.84375rem',
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
                backgroundColor: '#7c6ee0',
                color: '#ffffff',
                border: '1px solid transparent',
                borderRadius: '6px',
                padding: '9.5px 16px',
                fontSize: '0.84375rem',
                fontWeight: 500,
                letterSpacing: '-0.005em',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                opacity: isSubmitting ? 0.6 : 1,
                outline: 'none',
              }}
            >
              {isSubmitting ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px', justifyContent: 'center' }}>
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
                <span>Sign in to Dashboard</span>
              )}
            </button>
          </form>
        </div>

        {/* Subdued Footer Metadata */}
        <div style={{
          marginTop: '18px',
          textAlign: 'center',
          fontSize: '0.71875rem',
          color: '#6e7089',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '7px',
          letterSpacing: '0.01em',
        }}>
          <span style={{
            display: 'inline-block',
            width: '5px',
            height: '5px',
            borderRadius: '50%',
            backgroundColor: '#10b981',
          }} />
          <span>Autonomous AI Prospecting & Lead Governance Platform</span>
        </div>
      </div>

      <style jsx global>{`
        .v2-input {
          transition: border-color 140ms cubic-bezier(0.23, 1, 0.32, 1), box-shadow 140ms cubic-bezier(0.23, 1, 0.32, 1);
        }
        .v2-input::placeholder {
          color: #6e7089;
        }
        .v2-input:hover:not(:disabled) {
          border-color: rgba(255, 255, 255, 0.18) !important;
        }
        .v2-input:focus {
          border-color: #8f82e8 !important;
          box-shadow: 0 0 0 2px rgba(83, 91, 242, 0.2) !important;
        }
        .v2-input:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .v2-btn-primary {
          transition: transform 140ms cubic-bezier(0.23, 1, 0.32, 1), background-color 140ms cubic-bezier(0.23, 1, 0.32, 1);
        }
        .v2-btn-primary:hover:not(:disabled) {
          background-color: #6c5ed0 !important;
        }
        .v2-btn-primary:active:not(:disabled) {
          transform: scale(0.97);
        }
        .v2-btn-primary:focus-visible {
          box-shadow: 0 0 0 2px #0d0e1b, 0 0 0 4px #a99ef2;
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

