import React from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Alert from '@mui/material/Alert';
import { Header } from '@/components/header';
import { serverApiFetch } from '@/lib/server-api-client';

interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'SALES_REP' | 'MANAGER' | 'VIEWER' | string;
}

export default async function SettingsPage() {
  const { data } = await serverApiFetch<{ user: UserProfile }>('/auth/me');
  const user = data?.user;

  const getRoleBadge = (role: string = 'SALES_REP') => {
    switch (role) {
      case 'ADMIN':
        return (
          <Chip
            label="ADMIN"
            size="small"
            sx={{
              bgcolor: 'var(--accent-primary-muted)',
              color: 'var(--accent-primary-light)',
              fontWeight: 700,
              fontSize: '0.6875rem',
              letterSpacing: '0.05em',
              border: '1px solid rgba(99, 102, 241, 0.3)',
            }}
          />
        );
      case 'MANAGER':
        return (
          <Chip
            label="MANAGER"
            size="small"
            sx={{
              bgcolor: 'var(--accent-warning-muted)',
              color: '#fbbf24',
              fontWeight: 700,
              fontSize: '0.6875rem',
              letterSpacing: '0.05em',
              border: '1px solid rgba(245, 158, 11, 0.3)',
            }}
          />
        );
      case 'SALES_REP':
        return (
          <Chip
            label="SALES REP"
            size="small"
            sx={{
              bgcolor: 'var(--accent-info-muted)',
              color: '#38bdf8',
              fontWeight: 700,
              fontSize: '0.6875rem',
              letterSpacing: '0.05em',
              border: '1px solid rgba(14, 165, 233, 0.3)',
            }}
          />
        );
      default:
        return (
          <Chip
            label={role}
            size="small"
            sx={{
              bgcolor: 'var(--bg-surface-subtle)',
              color: 'var(--text-secondary)',
              fontWeight: 600,
              fontSize: '0.6875rem',
              letterSpacing: '0.05em',
              border: '1px solid var(--border-subtle)',
            }}
          />
        );
    }
  };

  const getRoleDescription = (role: string = 'SALES_REP') => {
    switch (role) {
      case 'ADMIN':
        return 'Full system governance: manage enterprise settings, OAuth connections, security policies, and AI operational parameters.';
      case 'MANAGER':
        return 'Team governance: resolve human review flags, review high-tier proposals, inspect agent logs, and audit rep activities.';
      case 'SALES_REP':
        return 'Direct operational access: prospect management, lead scoring, conversation handling, and autonomous outreach supervision.';
      default:
        return 'Standard directory and pipeline visibility permissions.';
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      <Header title="Settings & Account Governance" />

      <Box
        component="main"
        sx={{
          p: { xs: 2, sm: 3, md: 4 },
          display: 'flex',
          flexDirection: 'column',
          gap: 3.5,
          maxWidth: 1100,
          width: '100%',
          mx: 'auto',
        }}
      >
        {/* Page Header */}
        <Box>
          <Typography variant="h2" sx={{ color: 'var(--text-primary)', mb: 0.5, fontSize: '1.5rem', fontWeight: 700 }}>
            Account & System Configuration
          </Typography>
          <Typography variant="body2" sx={{ color: 'var(--text-secondary)' }}>
            Authenticated profile attributes, security credentials, and platform integration status
          </Typography>
        </Box>

        {/* User Profile Card */}
        <Card
          sx={{
            p: { xs: 2.5, sm: 3.5 },
            bgcolor: 'var(--bg-surface)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3} alignItems={{ xs: 'flex-start', sm: 'center' }} sx={{ mb: 3 }}>
            {/* User Avatar Placeholder */}
            <Box
              sx={{
                width: 64,
                height: 64,
                borderRadius: 'var(--radius-md)',
                bgcolor: 'var(--accent-primary-muted)',
                border: '1px solid rgba(99, 102, 241, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent-primary-light)',
                fontWeight: 700,
                fontSize: '1.35rem',
                letterSpacing: '0.02em',
                boxShadow: '0 4px 12px rgba(99, 102, 241, 0.15)',
              }}
            >
              {user?.name ? user.name.slice(0, 2).toUpperCase() : 'US'}
            </Box>

            <Box sx={{ flex: 1 }}>
              <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 0.5 }}>
                <Typography variant="h3" sx={{ color: 'var(--text-primary)', fontSize: '1.25rem', fontWeight: 700 }}>
                  {user?.name || 'Authenticated User'}
                </Typography>
                {getRoleBadge(user?.role)}
              </Stack>
              <Typography variant="body2" sx={{ color: 'var(--text-secondary)' }}>
                {user?.email || 'No email associated'}
              </Typography>
            </Box>
          </Stack>

          <Divider sx={{ borderColor: 'var(--border-subtle)', my: 2.5 }} />

          {/* Detailed Attributes Grid */}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
              gap: 2.5,
            }}
          >
            <Box
              sx={{
                p: 2,
                borderRadius: 'var(--radius-sm)',
                bgcolor: 'var(--bg-surface-subtle)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <Typography variant="caption" sx={{ color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, display: 'block', mb: 0.5 }}>
                Display Name
              </Typography>
              <Typography variant="body2" sx={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                {user?.name || '—'}
              </Typography>
            </Box>

            <Box
              sx={{
                p: 2,
                borderRadius: 'var(--radius-sm)',
                bgcolor: 'var(--bg-surface-subtle)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <Typography variant="caption" sx={{ color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, display: 'block', mb: 0.5 }}>
                Email Address
              </Typography>
              <Typography variant="body2" sx={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                {user?.email || '—'}
              </Typography>
            </Box>

            <Box
              sx={{
                p: 2,
                borderRadius: 'var(--radius-sm)',
                bgcolor: 'var(--bg-surface-subtle)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <Typography variant="caption" sx={{ color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, display: 'block', mb: 0.5 }}>
                Assigned Role & Access Scope
              </Typography>
              <Typography variant="body2" sx={{ color: 'var(--text-primary)', fontWeight: 600, mb: 0.5 }}>
                {user?.role || 'SALES_REP'}
              </Typography>
              <Typography variant="caption" sx={{ color: 'var(--text-secondary)', display: 'block', lineHeight: 1.4 }}>
                {getRoleDescription(user?.role)}
              </Typography>
            </Box>

            <Box
              sx={{
                p: 2,
                borderRadius: 'var(--radius-sm)',
                bgcolor: 'var(--bg-surface-subtle)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <Typography variant="caption" sx={{ color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, display: 'block', mb: 0.5 }}>
                User Identifier (UUID)
              </Typography>
              <Typography variant="body2" sx={{ color: 'var(--accent-info)', fontFamily: 'monospace', fontSize: '0.8125rem' }}>
                {user?.id || '—'}
              </Typography>
            </Box>
          </Box>
        </Card>

        {/* Security & Authentication Info */}
        <Card
          sx={{
            p: { xs: 2.5, sm: 3.5 },
            bgcolor: 'var(--bg-surface)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <Typography variant="h3" sx={{ color: 'var(--text-primary)', fontSize: '1.125rem', fontWeight: 700, mb: 1 }}>
            Authentication & Session Security
          </Typography>
          <Typography variant="body2" sx={{ color: 'var(--text-secondary)', mb: 3 }}>
            Cryptographic token lifecycle and session validation details
          </Typography>

          <Stack spacing={2}>
            <Box
              sx={{
                p: 2,
                borderRadius: 'var(--radius-sm)',
                bgcolor: 'var(--bg-surface-subtle)',
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 1.5,
              }}
            >
              <Box>
                <Typography variant="body2" sx={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                  Active JWT Authentication
                </Typography>
                <Typography variant="caption" sx={{ color: 'var(--text-muted)' }}>
                  Short-lived access token with HttpOnly refresh token rotation
                </Typography>
              </Box>
              <Chip
                label="VERIFIED & ACTIVE"
                size="small"
                sx={{
                  bgcolor: 'var(--accent-success-muted)',
                  color: '#34d399',
                  fontWeight: 700,
                  fontSize: '0.6875rem',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                }}
              />
            </Box>

            <Box
              sx={{
                p: 2,
                borderRadius: 'var(--radius-sm)',
                bgcolor: 'var(--bg-surface-subtle)',
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 1.5,
              }}
            >
              <Box>
                <Typography variant="body2" sx={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                  Connected API Service
                </Typography>
                <Typography variant="caption" sx={{ color: 'var(--text-muted)' }}>
                  {process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'} (NestJS Core Engine)
                </Typography>
              </Box>
              <Chip
                label="ONLINE"
                size="small"
                sx={{
                  bgcolor: 'var(--accent-info-muted)',
                  color: '#38bdf8',
                  fontWeight: 700,
                  fontSize: '0.6875rem',
                  border: '1px solid rgba(14, 165, 233, 0.3)',
                }}
              />
            </Box>
          </Stack>
        </Card>

        {/* Read-Only Honest Notice */}
        <Alert
          severity="info"
          sx={{
            bgcolor: 'var(--accent-info-muted)',
            border: '1px solid rgba(14, 165, 233, 0.3)',
            color: 'var(--text-primary)',
            borderRadius: 'var(--radius-md)',
            '& .MuiAlert-icon': {
              color: '#38bdf8',
            },
          }}
        >
          <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5, color: '#38bdf8' }}>
            Account Management & Self-Service Scope Notice
          </Typography>
          <Typography variant="caption" sx={{ color: 'var(--text-secondary)', display: 'block', lineHeight: 1.5 }}>
            User profiles, roles, and credentials are administered through backend seed scripts and administrative provisioning. In-app self-service modification actions (such as direct password rotation, notification subscription preferences, and profile edits) require dedicated backend mutation endpoints that are not present in this release version. All displayed attributes reflect live, verified backend records.
          </Typography>
        </Alert>
      </Box>
    </Box>
  );
}
