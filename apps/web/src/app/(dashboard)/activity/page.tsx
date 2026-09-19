'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import LockPersonOutlinedIcon from '@mui/icons-material/LockPersonOutlined';
import SecurityIcon from '@mui/icons-material/Security';
import { Header } from '@/components/header';
import { useAuth } from '@/lib/auth-context';
import { ActivityTimeline, AuditEventItem } from './activity-timeline';

interface AuditEventsResponse {
  items: AuditEventItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export default function ActivityPage() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const [initialData, setInitialData] = useState<AuditEventsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadInitialAuditEvents() {
      if (!isAdmin) {
        setLoading(false);
        return;
      }

      try {
        const res = await fetch('/api/audit-events?page=1&limit=20');
        const data = await res.json();

        if (isMounted) {
          if (!res.ok) {
            setError(data.error || 'Failed to load audit events');
          } else {
            setInitialData(data);
          }
          setLoading(false);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || 'Network error fetching audit timeline');
          setLoading(false);
        }
      }
    }

    if (!isAuthLoading) {
      loadInitialAuditEvents();
    }

    return () => {
      isMounted = false;
    };
  }, [isAdmin, isAuthLoading]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      <Header title="Agent Activity & Audit Trail" />

      <Box
        component="main"
        sx={{
          p: { xs: 2, sm: 3, md: 4 },
          maxWidth: 1400,
          width: '100%',
          mx: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 3,
        }}
      >
        {/* Screen Title & Subtitle */}
        <Box>
          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
            <SecurityIcon sx={{ fontSize: 26, color: 'var(--accent-primary-light)' }} />
            <Typography variant="h2" sx={{ color: 'var(--text-primary)' }}>
              Immutable Audit & Governance Trail
            </Typography>
          </Stack>
          <Typography variant="body2" sx={{ color: 'var(--text-secondary)', mt: 0.5 }}>
            Real-time chronological activity records of AI orchestrator operations, human overrides, policy blocks, and email dispatches.
          </Typography>
        </Box>

        {isAuthLoading || (loading && isAdmin) ? (
          <Box sx={{ py: 12, textAlign: 'center' }}>
            <CircularProgress size={36} sx={{ color: 'var(--accent-primary-light)' }} />
            <Typography variant="body2" sx={{ color: 'var(--text-secondary)', mt: 2 }}>
              Verifying security credentials and retrieving audit stream...
            </Typography>
          </Box>
        ) : !isAdmin ? (
          /* Graceful Non-ADMIN Access Restriction Card */
          <Card
            sx={{
              bgcolor: 'var(--bg-surface)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              borderRadius: 'var(--radius-md)',
              boxShadow: 'var(--shadow-card)',
            }}
          >
            <CardContent sx={{ textAlign: 'center', py: 6, px: 3 }}>
              <LockPersonOutlinedIcon sx={{ fontSize: 48, color: '#fbbf24', mb: 2 }} />
              <Typography variant="h3" sx={{ color: 'var(--text-primary)', mb: 1 }}>
                Administrator Privileges Required
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  color: 'var(--text-secondary)',
                  maxWidth: 600,
                  mx: 'auto',
                  mb: 3,
                  lineHeight: 1.6,
                }}
              >
                The Agent Activity &amp; Audit Trail contains sensitive governance, compliance, and policy override
                records. Viewing this chronological log requires an active <strong>ADMIN</strong> user account.
                Your current authenticated role is <code style={{ color: 'var(--accent-info)' }}>{user?.role || 'UNAUTHENTICATED'}</code>.
              </Typography>

              <Button
                component={Link}
                href="/overview"
                variant="outlined"
                className="btn-secondary"
                size="small"
                sx={{ textTransform: 'none', px: 2.5, py: 0.75 }}
              >
                ← Return to Overview Dashboard
              </Button>
            </CardContent>
          </Card>
        ) : error ? (
          <Alert
            severity="error"
            sx={{
              bgcolor: 'var(--accent-danger-muted)',
              border: '1px solid rgba(244, 63, 94, 0.3)',
              color: '#fb7185',
              '& .MuiAlert-icon': { color: '#fb7185' },
            }}
          >
            <AlertTitle sx={{ fontWeight: 700 }}>Failed to Load Audit Logs</AlertTitle>
            {error}
          </Alert>
        ) : initialData ? (
          <ActivityTimeline
            initialEvents={initialData.items || []}
            initialTotal={initialData.total || 0}
            initialPage={initialData.page || 1}
            initialLimit={initialData.limit || 20}
          />
        ) : null}
      </Box>
    </Box>
  );
}

