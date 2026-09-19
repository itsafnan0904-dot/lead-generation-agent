'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogActions from '@mui/material/DialogActions';
import Grid from '@mui/material/Grid';
import Divider from '@mui/material/Divider';
import Tooltip from '@mui/material/Tooltip';
import MailOutlineIcon from '@mui/icons-material/MailOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutlined';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutlined';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import AddLinkIcon from '@mui/icons-material/AddLink';
import SyncIcon from '@mui/icons-material/Sync';
import SecurityIcon from '@mui/icons-material/Security';
import LockPersonOutlinedIcon from '@mui/icons-material/LockPersonOutlined';
import PersonOutlineIcon from '@mui/icons-material/PersonOutlined';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';

import { Header } from '@/components/header';
import { useAuth } from '@/lib/auth-context';

export interface GmailStatusData {
  isConnected: boolean;
  email?: string;
  tokenExpiresAt?: string;
  isTokenExpired?: boolean;
  connectedByUser?: {
    id: string;
    email: string;
    name: string;
  } | null;
  connectedAt?: string;
}

export default function GmailPage() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const searchParams = useSearchParams();
  const router = useRouter();

  const [statusData, setStatusData] = useState<GmailStatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncResult, setSyncResult] = useState<{ success: boolean; message: string } | null>(null);
  const [disconnectDialogOpen, setDisconnectDialogOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMessage(null);
      const res = await fetch('/api/gmail/status');
      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error || 'Failed to fetch Gmail status');
      } else {
        setStatusData(data);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Network error fetching Gmail status');
    } finally {
      setLoading(false);
    }
  }, []);

  // Handle URL query parameters (?connected=true or ?error=...)
  useEffect(() => {
    const connectedParam = searchParams.get('connected');
    const errorParam = searchParams.get('error');

    if (connectedParam === 'true') {
      setSuccessBanner('Gmail account connected and authorized successfully!');
      // Clean query params from URL without refreshing
      router.replace('/gmail');
    } else if (errorParam) {
      let readableError = 'Failed to complete Google OAuth connection.';
      if (errorParam === 'admin_required') {
        readableError = 'Gmail connection requires an active Administrator (ADMIN) account.';
      } else if (errorParam === 'state_expired') {
        readableError = 'The OAuth session expired. Please try connecting again.';
      } else if (errorParam === 'invalid_state') {
        readableError = 'Invalid or tampered OAuth state parameter.';
      } else if (errorParam === 'exchange_failed') {
        readableError = 'Failed to exchange authorization code with Google.';
      } else if (errorParam === 'missing_parameters') {
        readableError = 'Missing required authorization code or state from Google redirect.';
      }
      setErrorBanner(readableError);
      router.replace('/gmail');
    }

    fetchStatus();
  }, [searchParams, router, fetchStatus]);

  // Initiate Connect Gmail flow (ADMIN only)
  const handleConnectGmail = async () => {
    try {
      setActionLoading(true);
      setErrorBanner(null);
      const res = await fetch('/api/gmail/connect');
      const data = await res.json();

      if (!res.ok || !data.authUrl) {
        setErrorBanner(data.error || 'Failed to initiate Google OAuth consent flow.');
        setActionLoading(false);
        return;
      }

      // Perform full browser page navigation to Google consent screen
      window.location.href = data.authUrl;
    } catch (err: any) {
      setErrorBanner(err.message || 'Network error initiating Gmail connection');
      setActionLoading(false);
    }
  };

  // Perform Disconnect (ADMIN only)
  const handleConfirmDisconnect = async () => {
    try {
      setActionLoading(true);
      setDisconnectDialogOpen(false);
      const res = await fetch('/api/gmail/disconnect', { method: 'POST' });
      const data = await res.json();

      if (!res.ok) {
        setErrorBanner(data.error || 'Failed to disconnect Gmail account.');
      } else {
        setSuccessBanner('Gmail account disconnected successfully.');
        await fetchStatus();
      }
    } catch (err: any) {
      setErrorBanner(err.message || 'Network error disconnecting Gmail');
    } finally {
      setActionLoading(false);
    }
  };

  // Manual Inbox Sync Trigger
  const handleSyncInbox = async () => {
    try {
      setSyncLoading(true);
      setSyncResult(null);
      const res = await fetch('/api/gmail/sync', { method: 'POST' });
      const data = await res.json();

      if (!res.ok) {
        setSyncResult({ success: false, message: data.error || 'Inbox sync failed' });
      } else {
        setSyncResult({
          success: true,
          message: `Sync completed: ${data.processedCount || 0} messages evaluated.`,
        });
        await fetchStatus();
      }
    } catch (err: any) {
      setSyncResult({ success: false, message: err.message || 'Network error during sync' });
    } finally {
      setSyncLoading(false);
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      <Header title="Gmail Integration & Mailbox Hub" />

      <Box
        component="main"
        sx={{
          p: { xs: 2, sm: 3, md: 4 },
          maxWidth: 1100,
          width: '100%',
          mx: 'auto',
        }}
      >
        {/* Page Header (Section 4 Display Scale) */}
        <Box sx={{ mb: 3.5 }}>
          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: 'var(--radius-sm)',
                bgcolor: 'var(--accent-primary-muted)',
                border: '1px solid rgba(99, 102, 241, 0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <MailOutlineIcon sx={{ color: 'var(--accent-primary-light)', fontSize: 22 }} />
            </Box>
            <Box>
              <Typography
                variant="h1"
                sx={{
                  fontSize: '1.5rem',
                  fontWeight: 700,
                  lineHeight: 1.2,
                  letterSpacing: '-0.025em',
                  color: 'var(--text-primary)',
                }}
              >
                Enterprise Gmail Mailbox
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  mt: 0.5,
                  fontSize: '0.875rem',
                  lineHeight: 1.5,
                  color: 'var(--text-secondary)',
                }}
              >
                Centralized shared business mailbox governing autonomous outreach dispatch, thread tracking, and inbound reply synchronization.
              </Typography>
            </Box>
          </Stack>
        </Box>

        {/* Success Feedback Banner */}
        {successBanner && (
          <Alert
            severity="success"
            onClose={() => setSuccessBanner(null)}
            sx={{
              mb: 3,
              bgcolor: 'var(--accent-success-muted)',
              color: '#34d399',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              borderRadius: 'var(--radius-sm)',
              '& .MuiAlert-icon': { color: '#34d399' },
            }}
          >
            <AlertTitle sx={{ fontWeight: 700, fontSize: '0.875rem', color: '#34d399', mb: 0.25 }}>
              Connection Successful
            </AlertTitle>
            <Typography variant="body2" sx={{ fontSize: '0.8125rem', color: '#34d399' }}>
              {successBanner}
            </Typography>
          </Alert>
        )}

        {/* Error Feedback Banner */}
        {errorBanner && (
          <Alert
            severity="error"
            onClose={() => setErrorBanner(null)}
            sx={{
              mb: 3,
              bgcolor: 'var(--accent-danger-muted)',
              color: '#fb7185',
              border: '1px solid rgba(244, 63, 94, 0.3)',
              borderRadius: 'var(--radius-sm)',
              '& .MuiAlert-icon': { color: '#fb7185' },
            }}
          >
            <AlertTitle sx={{ fontWeight: 700, fontSize: '0.875rem', color: '#fb7185', mb: 0.25 }}>
              Connection Notice
            </AlertTitle>
            <Typography variant="body2" sx={{ fontSize: '0.8125rem', color: '#fb7185' }}>
              {errorBanner}
            </Typography>
          </Alert>
        )}

        {/* Loading Indicator */}
        {isAuthLoading || loading ? (
          <Box sx={{ py: 10, textAlign: 'center' }}>
            <CircularProgress size={32} sx={{ color: 'var(--accent-primary)' }} />
            <Typography variant="body2" sx={{ mt: 2, color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
              Verifying credentials and mailbox status...
            </Typography>
          </Box>
        ) : errorMessage ? (
          <Alert
            severity="error"
            sx={{
              mb: 3,
              bgcolor: 'var(--accent-danger-muted)',
              color: '#fb7185',
              border: '1px solid rgba(244, 63, 94, 0.3)',
              borderRadius: 'var(--radius-sm)',
              '& .MuiAlert-icon': { color: '#fb7185' },
            }}
          >
            <AlertTitle sx={{ fontWeight: 700, fontSize: '0.875rem' }}>Error Loading Status</AlertTitle>
            <Typography variant="body2" sx={{ fontSize: '0.8125rem' }}>
              {errorMessage}
            </Typography>
          </Alert>
        ) : (
          <Stack spacing={3}>
            {/* Primary Connection Status & Telemetry Card */}
            <Card
              sx={{
                bgcolor: 'var(--bg-surface)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-md)',
                boxShadow: 'var(--shadow-card)',
              }}
            >
              <CardContent sx={{ p: { xs: 2.5, sm: 3.5 } }}>
                <Stack spacing={3}>
                  {/* Top Row: Mailbox Identity & Action Controls */}
                  <Stack
                    direction={{ xs: 'column', md: 'row' }}
                    spacing={2}
                    sx={{
                      justifyContent: 'space-between',
                      alignItems: { xs: 'flex-start', md: 'center' },
                    }}
                  >
                    <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
                      {/* Connection Status Icon Indicator */}
                      <Box
                        sx={{
                          width: 48,
                          height: 48,
                          borderRadius: 'var(--radius-sm)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          bgcolor: statusData?.isConnected
                            ? 'var(--accent-success-muted)'
                            : 'rgba(255, 255, 255, 0.03)',
                          border: '1px solid',
                          borderColor: statusData?.isConnected
                            ? 'rgba(16, 185, 129, 0.35)'
                            : 'var(--border-subtle)',
                        }}
                      >
                        {statusData?.isConnected ? (
                          <CheckCircleOutlineIcon sx={{ color: '#34d399', fontSize: 26 }} />
                        ) : (
                          <ErrorOutlineIcon sx={{ color: 'var(--text-muted)', fontSize: 26 }} />
                        )}
                      </Box>

                      {/* Mailbox Identity & Status Badge */}
                      <Box>
                        <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center', mb: 0.5 }}>
                          <Typography
                            variant="h2"
                            sx={{
                              fontSize: '1.125rem',
                              fontWeight: 600,
                              color: 'var(--text-primary)',
                              letterSpacing: '-0.015em',
                            }}
                          >
                            {statusData?.isConnected ? statusData.email : 'No Mailbox Connected'}
                          </Typography>
                          <Box
                            sx={{
                              px: 1,
                              py: 0.2,
                              borderRadius: 'var(--radius-sm)',
                              bgcolor: statusData?.isConnected
                                ? 'var(--accent-success-muted)'
                                : 'rgba(255, 255, 255, 0.04)',
                              border: '1px solid',
                              borderColor: statusData?.isConnected
                                ? 'rgba(16, 185, 129, 0.3)'
                                : 'var(--border-subtle)',
                              color: statusData?.isConnected ? '#34d399' : 'var(--text-muted)',
                              fontSize: '0.6875rem',
                              fontWeight: 700,
                              letterSpacing: '0.05em',
                              textTransform: 'uppercase',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 0.5,
                            }}
                          >
                            <Box
                              sx={{
                                width: 6,
                                height: 6,
                                borderRadius: '50%',
                                bgcolor: statusData?.isConnected ? '#10b981' : 'var(--text-muted)',
                                boxShadow: statusData?.isConnected ? '0 0 6px #10b981' : 'none',
                              }}
                            />
                            <span>{statusData?.isConnected ? 'CONNECTED' : 'DISCONNECTED'}</span>
                          </Box>
                        </Stack>
                        <Typography
                          variant="caption"
                          sx={{ color: 'var(--text-secondary)', fontSize: '0.8125rem', lineHeight: 1.4 }}
                        >
                          {statusData?.isConnected
                            ? 'Active shared business sender for AI autonomous outreach dispatch and inbound response synchronization.'
                            : 'Connect an enterprise Google Workspace or Gmail mailbox to enable automated AI outreach and thread monitoring.'}
                        </Typography>
                      </Box>
                    </Stack>

                    {/* Consequential Action Controls (Connect / Disconnect) */}
                    <Box>
                      {statusData?.isConnected ? (
                        isAdmin ? (
                          <Button
                            variant="outlined"
                            size="small"
                            startIcon={<LinkOffIcon sx={{ fontSize: '1rem' }} />}
                            onClick={() => setDisconnectDialogOpen(true)}
                            disabled={actionLoading}
                            sx={{
                              borderColor: 'rgba(244, 63, 94, 0.35)',
                              color: '#fb7185',
                              bgcolor: 'rgba(244, 63, 94, 0.05)',
                              fontSize: '0.8125rem',
                              fontWeight: 600,
                              borderRadius: 'var(--radius-sm)',
                              py: 0.6,
                              px: 1.75,
                              textTransform: 'none',
                              transition: 'all 150ms cubic-bezier(0.4, 0, 0.2, 1)',
                              '&:hover': {
                                borderColor: '#f43f5e',
                                bgcolor: 'rgba(244, 63, 94, 0.12)',
                                color: '#ffffff',
                              },
                            }}
                          >
                            Disconnect Mailbox
                          </Button>
                        ) : (
                          <Tooltip title="Only Administrators can disconnect the shared Gmail account" arrow>
                            <span>
                              <Button
                                disabled
                                variant="outlined"
                                size="small"
                                sx={{
                                  fontSize: '0.8125rem',
                                  borderRadius: 'var(--radius-sm)',
                                  color: 'var(--text-muted)',
                                  borderColor: 'var(--border-subtle)',
                                  opacity: 0.5,
                                  cursor: 'not-allowed',
                                  textTransform: 'none',
                                }}
                              >
                                Disconnect (Admin Only)
                              </Button>
                            </span>
                          </Tooltip>
                        )
                      ) : isAdmin ? (
                        <Button
                          variant="contained"
                          size="medium"
                          startIcon={
                            actionLoading ? (
                              <CircularProgress size={16} color="inherit" />
                            ) : (
                              <AddLinkIcon sx={{ fontSize: '1.125rem' }} />
                            )
                          }
                          onClick={handleConnectGmail}
                          disabled={actionLoading}
                          sx={{
                            bgcolor: 'var(--accent-primary)',
                            color: '#ffffff',
                            fontWeight: 600,
                            fontSize: '0.875rem',
                            borderRadius: 'var(--radius-sm)',
                            px: 2.5,
                            py: 0.8,
                            textTransform: 'none',
                            boxShadow: '0 2px 8px rgba(99, 102, 241, 0.3)',
                            '&:hover': {
                              bgcolor: 'var(--accent-primary-hover)',
                            },
                          }}
                        >
                          {actionLoading ? 'Connecting...' : 'Connect Gmail Account'}
                        </Button>
                      ) : (
                        /* Graceful Non-ADMIN Governance Banner */
                        <Box
                          sx={{
                            p: 1.5,
                            bgcolor: 'var(--bg-surface-subtle)',
                            border: '1px solid var(--border-default)',
                            borderRadius: 'var(--radius-sm)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1.25,
                          }}
                        >
                          <LockPersonOutlinedIcon sx={{ color: 'var(--accent-warning)', fontSize: 20 }} />
                          <Typography variant="caption" sx={{ color: 'var(--text-secondary)', fontSize: '0.8125rem' }}>
                            Connecting Gmail requires <strong>ADMIN</strong> permissions. Contact your system administrator.
                          </Typography>
                        </Box>
                      )}
                    </Box>
                  </Stack>

                  {/* Connected Details Telemetry Grid */}
                  {statusData?.isConnected && (
                    <>
                      <Divider sx={{ borderColor: 'var(--border-subtle)' }} />
                      <Grid container spacing={2}>
                        {/* 1. Connected By Panel */}
                        <Grid size={{ xs: 12, sm: 4 }}>
                          <Box
                            sx={{
                              p: 2,
                              bgcolor: 'var(--bg-surface-subtle)',
                              border: '1px solid var(--border-subtle)',
                              borderRadius: 'var(--radius-sm)',
                              height: '100%',
                            }}
                          >
                            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 0.75 }}>
                              <PersonOutlineIcon sx={{ fontSize: 16, color: 'var(--text-secondary)' }} />
                              <Typography
                                variant="caption"
                                sx={{
                                  color: 'var(--text-secondary)',
                                  fontWeight: 600,
                                  fontSize: '0.6875rem',
                                  letterSpacing: '0.06em',
                                  textTransform: 'uppercase',
                                }}
                              >
                                CONNECTED BY
                              </Typography>
                            </Stack>
                            <Typography
                              variant="body2"
                              sx={{
                                color: 'var(--text-primary)',
                                fontWeight: 600,
                                fontSize: '0.875rem',
                                lineHeight: 1.4,
                              }}
                            >
                              {statusData.connectedByUser?.email || statusData.connectedByUser?.name || 'Administrator'}
                            </Typography>
                            <Typography
                              variant="caption"
                              sx={{
                                color: 'var(--text-muted)',
                                fontSize: '0.75rem',
                                display: 'block',
                                mt: 0.25,
                              }}
                            >
                              User ID: {statusData.connectedByUser?.id ? statusData.connectedByUser.id.substring(0, 8) : 'N/A'}
                            </Typography>
                          </Box>
                        </Grid>

                        {/* 2. Connected At Panel */}
                        <Grid size={{ xs: 12, sm: 4 }}>
                          <Box
                            sx={{
                              p: 2,
                              bgcolor: 'var(--bg-surface-subtle)',
                              border: '1px solid var(--border-subtle)',
                              borderRadius: 'var(--radius-sm)',
                              height: '100%',
                            }}
                          >
                            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 0.75 }}>
                              <AccessTimeIcon sx={{ fontSize: 16, color: 'var(--text-secondary)' }} />
                              <Typography
                                variant="caption"
                                sx={{
                                  color: 'var(--text-secondary)',
                                  fontWeight: 600,
                                  fontSize: '0.6875rem',
                                  letterSpacing: '0.06em',
                                  textTransform: 'uppercase',
                                }}
                              >
                                CONNECTED AT
                              </Typography>
                            </Stack>
                            <Typography
                              variant="body2"
                              sx={{
                                color: 'var(--text-primary)',
                                fontWeight: 600,
                                fontSize: '0.875rem',
                                lineHeight: 1.4,
                              }}
                            >
                              {statusData.connectedAt
                                ? new Date(statusData.connectedAt).toLocaleDateString(undefined, {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric',
                                  })
                                : 'Active'}
                            </Typography>
                            <Typography
                              variant="caption"
                              sx={{
                                color: 'var(--text-muted)',
                                fontSize: '0.75rem',
                                display: 'block',
                                mt: 0.25,
                              }}
                            >
                              {statusData.connectedAt
                                ? new Date(statusData.connectedAt).toLocaleTimeString([], {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })
                                : 'Session Active'}
                            </Typography>
                          </Box>
                        </Grid>

                        {/* 3. Token Status Panel */}
                        <Grid size={{ xs: 12, sm: 4 }}>
                          <Box
                            sx={{
                              p: 2,
                              bgcolor: 'var(--bg-surface-subtle)',
                              border: '1px solid var(--border-subtle)',
                              borderRadius: 'var(--radius-sm)',
                              height: '100%',
                            }}
                          >
                            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 0.75 }}>
                              <SecurityIcon sx={{ fontSize: 16, color: 'var(--text-secondary)' }} />
                              <Typography
                                variant="caption"
                                sx={{
                                  color: 'var(--text-secondary)',
                                  fontWeight: 600,
                                  fontSize: '0.6875rem',
                                  letterSpacing: '0.06em',
                                  textTransform: 'uppercase',
                                }}
                              >
                                TOKEN STATUS
                              </Typography>
                            </Stack>
                            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                              <Box
                                sx={{
                                  px: 0.85,
                                  py: 0.2,
                                  borderRadius: 'var(--radius-sm)',
                                  bgcolor: statusData.isTokenExpired
                                    ? 'var(--accent-warning-muted)'
                                    : 'var(--accent-success-muted)',
                                  border: '1px solid',
                                  borderColor: statusData.isTokenExpired
                                    ? 'rgba(245, 158, 11, 0.35)'
                                    : 'rgba(16, 185, 129, 0.3)',
                                  color: statusData.isTokenExpired ? '#fbbf24' : '#34d399',
                                  fontSize: '0.625rem',
                                  fontWeight: 700,
                                  letterSpacing: '0.04em',
                                  textTransform: 'uppercase',
                                }}
                              >
                                {statusData.isTokenExpired ? 'AUTO-REFRESH PENDING' : 'HEALTHY & VALID'}
                              </Box>
                            </Stack>
                            <Typography
                              variant="caption"
                              sx={{
                                color: 'var(--text-muted)',
                                fontSize: '0.75rem',
                                display: 'block',
                                mt: 0.5,
                              }}
                            >
                              AES-256-GCM Encrypted at rest
                            </Typography>
                          </Box>
                        </Grid>
                      </Grid>

                      {/* Manual Sync Trigger Section */}
                      <Divider sx={{ borderColor: 'var(--border-subtle)' }} />
                      <Stack
                        direction={{ xs: 'column', sm: 'row' }}
                        spacing={2}
                        sx={{
                          justifyContent: 'space-between',
                          alignItems: { xs: 'flex-start', sm: 'center' },
                        }}
                      >
                        <Box>
                          <Typography
                            variant="subtitle2"
                            sx={{
                              fontSize: '0.875rem',
                              fontWeight: 600,
                              color: 'var(--text-primary)',
                            }}
                          >
                            Inbox Reply Sync Engine
                          </Typography>
                          <Typography
                            variant="caption"
                            sx={{
                              color: 'var(--text-secondary)',
                              fontSize: '0.75rem',
                              display: 'block',
                              mt: 0.25,
                            }}
                          >
                            Automated background polling checks for incoming lead responses every 5 minutes.
                          </Typography>
                        </Box>

                        <Button
                          variant="outlined"
                          size="small"
                          startIcon={
                            syncLoading ? (
                              <CircularProgress size={14} color="inherit" />
                            ) : (
                              <SyncIcon sx={{ fontSize: '1rem' }} />
                            )
                          }
                          onClick={handleSyncInbox}
                          disabled={syncLoading}
                          sx={{
                            color: 'var(--text-primary)',
                            borderColor: 'var(--border-default)',
                            bgcolor: 'rgba(255, 255, 255, 0.02)',
                            fontSize: '0.8125rem',
                            fontWeight: 500,
                            borderRadius: 'var(--radius-sm)',
                            textTransform: 'none',
                            py: 0.5,
                            px: 1.5,
                            '&:hover': {
                              bgcolor: 'rgba(255, 255, 255, 0.06)',
                              borderColor: 'var(--border-strong)',
                            },
                          }}
                        >
                          {syncLoading ? 'Syncing...' : 'Sync Mailbox Now'}
                        </Button>
                      </Stack>

                      {syncResult && (
                        <Alert
                          severity={syncResult.success ? 'success' : 'error'}
                          onClose={() => setSyncResult(null)}
                          sx={{
                            bgcolor: syncResult.success
                              ? 'var(--accent-success-muted)'
                              : 'var(--accent-danger-muted)',
                            color: syncResult.success ? '#34d399' : '#fb7185',
                            border: '1px solid',
                            borderColor: syncResult.success
                              ? 'rgba(16, 185, 129, 0.3)'
                              : 'rgba(244, 63, 94, 0.3)',
                            borderRadius: 'var(--radius-sm)',
                            fontSize: '0.8125rem',
                          }}
                        >
                          {syncResult.message}
                        </Alert>
                      )}
                    </>
                  )}
                </Stack>
              </CardContent>
            </Card>

            {/* Integration Architecture & Security Model Card */}
            <Card
              sx={{
                bgcolor: 'var(--bg-surface)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-md)',
              }}
            >
              <CardContent sx={{ p: 3 }}>
                <Stack spacing={1.5}>
                  <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                    <SecurityIcon sx={{ color: 'var(--accent-primary-light)', fontSize: 18 }} />
                    <Typography
                      variant="h3"
                      sx={{
                        fontSize: '0.9375rem',
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                        letterSpacing: '-0.01em',
                      }}
                    >
                      Security &amp; Governance Model
                    </Typography>
                  </Stack>
                  <Typography
                    variant="body2"
                    sx={{
                      color: 'var(--text-secondary)',
                      lineHeight: 1.6,
                      fontSize: '0.875rem',
                    }}
                  >
                    The system implements an enterprise-grade, single-active-connection model for outbound email dispatch and thread reply detection. OAuth refresh tokens are encrypted at rest using <strong>AES-256-GCM</strong> with hardware-isolated encryption keys. Connection and disconnection operations are immutable and logged directly to the system audit trail.
                  </Typography>
                </Stack>
              </CardContent>
            </Card>
          </Stack>
        )}
      </Box>

      {/* Confirmation Dialog: Disconnect Mailbox (Section 4 Elevated Surface) */}
      <Dialog
        open={disconnectDialogOpen}
        onClose={() => !actionLoading && setDisconnectDialogOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: 'var(--bg-surface-elevated)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-elevated)',
            p: 1,
          },
        }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5, pb: 1 }}>
          <WarningAmberIcon sx={{ color: '#fb7185', fontSize: 24 }} />
          <Typography
            variant="h3"
            sx={{
              fontSize: '1.125rem',
              fontWeight: 600,
              color: 'var(--text-primary)',
              letterSpacing: '-0.01em',
            }}
          >
            Disconnect Shared Gmail?
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ py: 1 }}>
          <DialogContentText
            sx={{
              color: 'var(--text-secondary)',
              fontSize: '0.875rem',
              lineHeight: 1.5,
            }}
          >
            Disconnecting <strong>{statusData?.email}</strong> will immediately halt all automated cold outreach email dispatches and pause inbox reply synchronization across the entire workspace.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 1.5, gap: 1 }}>
          <Button
            onClick={() => setDisconnectDialogOpen(false)}
            disabled={actionLoading}
            size="small"
            sx={{
              color: 'var(--text-secondary)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.8125rem',
              fontWeight: 500,
              textTransform: 'none',
              px: 1.5,
              '&:hover': {
                bgcolor: 'rgba(255, 255, 255, 0.04)',
                color: 'var(--text-primary)',
              },
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirmDisconnect}
            disabled={actionLoading}
            size="small"
            sx={{
              bgcolor: 'var(--accent-danger)',
              color: '#ffffff',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.8125rem',
              fontWeight: 600,
              textTransform: 'none',
              px: 2,
              boxShadow: '0 2px 8px rgba(244, 63, 94, 0.3)',
              '&:hover': {
                bgcolor: '#e11d48',
              },
            }}
          >
            {actionLoading ? 'Disconnecting...' : 'Yes, Disconnect'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

