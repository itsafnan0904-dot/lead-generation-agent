'use client';

import React from 'react';
import Link from 'next/link';
import {
  Box,
  Typography,
  Grid,
  Stack,
  LinearProgress,
  Button,
  Divider,
  useTheme,
  useMediaQuery,
} from '@mui/material';

export interface HealthData {
  status: 'ok' | 'degraded' | 'error';
  timestamp: string;
  uptimeSeconds: number;
  database: { status: 'up' | 'down'; latencyMs?: number };
  redis: { status: 'up' | 'down'; latencyMs?: number };
}

export interface LeadsData {
  items: Array<{ id: string; status: string }>;
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface NotificationsData {
  items: Array<{
    id: string;
    title: string;
    message: string;
    priority: 'INFO' | 'IMPORTANT' | 'ACTION_REQUIRED';
    createdAt: string;
    isRead: boolean;
  }>;
  total: number;
  unreadCount: number;
}

interface OverviewMetricsProps {
  health: HealthData | null;
  leads: LeadsData | null;
  notifs: NotificationsData | null;
  leadDistribution: Record<string, number>;
  priorityBreakdown: {
    ACTION_REQUIRED: number;
    IMPORTANT: number;
    INFO: number;
  };
}

export function OverviewMetrics({
  health,
  leads,
  notifs,
  leadDistribution,
  priorityBreakdown,
}: OverviewMetricsProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'), { noSsr: true });

  const formatUptime = (seconds?: number) => {
    if (!seconds) return 'N/A';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${hrs}h ${mins}m`;
  };

  const humanReviewCount = leadDistribution['HUMAN_REVIEW'] || 0;
  const restrictedCount = leadDistribution['RESTRICTED'] || 0;
  const actionRequiredNotifs = priorityBreakdown.ACTION_REQUIRED || 0;
  const totalAttentionItems = humanReviewCount + restrictedCount + actionRequiredNotifs;

  const isSystemHealthy = health?.status === 'ok';

  return (
    <Box
      component="main"
      sx={{
        p: isMobile ? 2 : { xs: 2, sm: 3, md: 3.5 },
        display: 'flex',
        flexDirection: 'column',
        gap: isMobile ? 2 : 2.5,
        maxWidth: 1400,
        width: '100%',
        mx: 'auto',
      }}
    >
      {/* 1. OPERATOR PULSE & AUTONOMOUS ENGINE STATE BANNER */}
      <Box
        sx={{
          bgcolor: '#111318',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '8px',
          p: { xs: 2.5, sm: 3 },
        }}
      >
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={2}
          sx={{
            justifyContent: 'space-between',
            alignItems: { xs: 'flex-start', md: 'center' },
          }}
        >
          <Box>
            <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', mb: 1 }}>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  px: 1.25,
                  py: 0.4,
                  borderRadius: '9999px',
                  bgcolor: isSystemHealthy ? 'rgba(16, 185, 129, 0.12)' : 'rgba(245, 158, 11, 0.12)',
                  border: `1px solid ${isSystemHealthy ? 'rgba(16, 185, 129, 0.25)' : 'rgba(245, 158, 11, 0.25)'}`,
                }}
              >
                <Box
                  sx={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    bgcolor: isSystemHealthy ? '#10b981' : '#f59e0b',
                  }}
                />
                <Typography
                  variant="caption"
                  sx={{
                    fontWeight: 600,
                    color: isSystemHealthy ? '#34d399' : '#fbbf24',
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                    fontSize: '0.6875rem',
                  }}
                >
                  {isSystemHealthy ? 'Autonomous Engine Active' : 'System Needs Attention'}
                </Typography>
              </Box>

              <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.75rem', fontVariantNumeric: 'tabular-nums' }}>
                Uptime: {formatUptime(health?.uptimeSeconds)}
              </Typography>
            </Stack>

            <Typography
              variant="h2"
              sx={{
                color: '#f3f4f6',
                mb: 0.5,
                fontSize: { xs: '1.125rem', sm: '1.25rem' },
                fontWeight: 600,
                letterSpacing: '-0.025em',
              }}
            >
              Enterprise Sales Cockpit
            </Typography>
            <Typography variant="body2" sx={{ color: '#9ca3af', fontSize: '0.8125rem' }}>
              {totalAttentionItems > 0 ? (
                <>
                  <strong style={{ color: '#fb7185' }}>{totalAttentionItems} item{totalAttentionItems > 1 ? 's' : ''}</strong> require operator review before autonomous pipeline execution resumes.
                </>
              ) : (
                'All autonomous workflows are running normally with zero blocking restrictions.'
              )}
            </Typography>
          </Box>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ width: { xs: '100%', sm: 'auto' } }}>
            <Button
              component={Link}
              href="/leads"
              variant="contained"
              size="small"
              sx={{
                textTransform: 'none',
                px: 2,
                py: 0.6,
                fontSize: '0.8125rem',
                fontWeight: 500,
                bgcolor: '#4f46e5',
                color: '#ffffff',
                borderRadius: '6px',
                boxShadow: 'none',
                transition: 'background-color 140ms cubic-bezier(0.23, 1, 0.32, 1)',
                '&:hover': {
                  bgcolor: '#4338ca',
                  boxShadow: 'none',
                },
                '&:active': {
                  transform: 'scale(0.97)',
                },
              }}
            >
              Open Leads Directory →
            </Button>
            <Button
              component={Link}
              href="/activity"
              variant="outlined"
              size="small"
              sx={{
                textTransform: 'none',
                px: 2,
                py: 0.6,
                fontSize: '0.8125rem',
                fontWeight: 500,
                borderColor: 'rgba(255, 255, 255, 0.10)',
                color: '#f3f4f6',
                bgcolor: '#161820',
                borderRadius: '6px',
                transition: 'background-color 140ms cubic-bezier(0.23, 1, 0.32, 1), border-color 140ms cubic-bezier(0.23, 1, 0.32, 1)',
                '&:hover': {
                  bgcolor: 'rgba(255, 255, 255, 0.06)',
                  borderColor: 'rgba(255, 255, 255, 0.18)',
                },
                '&:active': {
                  transform: 'scale(0.97)',
                },
              }}
            >
              Live Activity Stream
            </Button>
          </Stack>
        </Stack>
      </Box>

      {/* 2. HIGH-PRIORITY ACTION & GOVERNANCE QUEUE */}
      <Box>
        <Stack direction="row" spacing={1.5} sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
          <Typography
            variant="subtitle2"
            sx={{
              color: '#64748b',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              fontSize: '0.6875rem',
              fontWeight: 600,
            }}
          >
            Action Required Queue
          </Typography>
          {totalAttentionItems > 0 && (
            <Box
              sx={{
                px: 1,
                py: 0.25,
                borderRadius: '4px',
                bgcolor: 'rgba(244, 63, 94, 0.12)',
                color: '#fb7185',
                border: '1px solid rgba(244, 63, 94, 0.25)',
                fontWeight: 600,
                fontSize: '0.6875rem',
                letterSpacing: '0.04em',
              }}
            >
              {totalAttentionItems} ACTIONABLE
            </Box>
          )}
        </Stack>

        <Grid container spacing={2}>
          {/* Action Card 1: Human Reviews */}
          <Grid size={{ xs: 12, md: 4 }}>
            <Box
              sx={{
                height: '100%',
                bgcolor: humanReviewCount > 0 ? '#161820' : '#111318',
                border: humanReviewCount > 0 ? '1px solid rgba(245, 158, 11, 0.35)' : '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '8px',
                p: 2.5,
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <Stack direction="row" spacing={1.5} sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                <Typography variant="body2" sx={{ color: '#f3f4f6', fontWeight: 600, fontSize: '0.84375rem' }}>
                  Human Reviews Required
                </Typography>
                <Box
                  sx={{
                    px: 1,
                    py: 0.25,
                    borderRadius: '4px',
                    bgcolor: humanReviewCount > 0 ? 'rgba(245, 158, 11, 0.12)' : 'rgba(16, 185, 129, 0.12)',
                    color: humanReviewCount > 0 ? '#fbbf24' : '#34d399',
                    border: humanReviewCount > 0 ? '1px solid rgba(245, 158, 11, 0.25)' : '1px solid rgba(16, 185, 129, 0.25)',
                    fontWeight: 600,
                    fontSize: '0.625rem',
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                  }}
                >
                  {humanReviewCount > 0 ? `${humanReviewCount} PENDING` : 'CLEAR'}
                </Box>
              </Stack>
              <Typography variant="body2" sx={{ color: '#9ca3af', mb: 2, fontSize: '0.8125rem', flex: 1 }}>
                {humanReviewCount > 0
                  ? `${humanReviewCount} lead${humanReviewCount > 1 ? 's' : ''} flagged for manager inspection prior to automated outreach.`
                  : 'No leads currently paused waiting for human manager clearance.'}
              </Typography>
              <Button
                component={Link}
                href="/leads?status=HUMAN_REVIEW"
                size="small"
                variant="outlined"
                fullWidth
                disabled={humanReviewCount === 0}
                sx={{
                  textTransform: 'none',
                  fontSize: '0.8125rem',
                  fontWeight: 500,
                  borderRadius: '6px',
                  py: 0.5,
                  borderColor: humanReviewCount > 0 ? 'rgba(245, 158, 11, 0.4)' : 'rgba(255, 255, 255, 0.08)',
                  color: humanReviewCount > 0 ? '#fbbf24' : '#64748b',
                  bgcolor: humanReviewCount > 0 ? 'rgba(245, 158, 11, 0.06)' : 'transparent',
                  transition: 'background-color 140ms cubic-bezier(0.23, 1, 0.32, 1)',
                  '&:hover:not(:disabled)': {
                    borderColor: 'rgba(245, 158, 11, 0.7)',
                    bgcolor: 'rgba(245, 158, 11, 0.12)',
                  },
                  '&:active:not(:disabled)': {
                    transform: 'scale(0.97)',
                  },
                }}
              >
                {humanReviewCount > 0 ? `Review ${humanReviewCount} Lead${humanReviewCount > 1 ? 's' : ''} →` : 'Queue Empty'}
              </Button>
            </Box>
          </Grid>

          {/* Action Card 2: Restricted Leads */}
          <Grid size={{ xs: 12, md: 4 }}>
            <Box
              sx={{
                height: '100%',
                bgcolor: restrictedCount > 0 ? '#161820' : '#111318',
                border: restrictedCount > 0 ? '1px solid rgba(244, 63, 94, 0.35)' : '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '8px',
                p: 2.5,
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <Stack direction="row" spacing={1.5} sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                <Typography variant="body2" sx={{ color: '#f3f4f6', fontWeight: 600, fontSize: '0.84375rem' }}>
                  Compliance Restrictions
                </Typography>
                <Box
                  sx={{
                    px: 1,
                    py: 0.25,
                    borderRadius: '4px',
                    bgcolor: restrictedCount > 0 ? 'rgba(244, 63, 94, 0.12)' : 'rgba(16, 185, 129, 0.12)',
                    color: restrictedCount > 0 ? '#fb7185' : '#34d399',
                    border: restrictedCount > 0 ? '1px solid rgba(244, 63, 94, 0.25)' : '1px solid rgba(16, 185, 129, 0.25)',
                    fontWeight: 600,
                    fontSize: '0.625rem',
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                  }}
                >
                  {restrictedCount > 0 ? `${restrictedCount} BLOCKED` : 'CLEAR'}
                </Box>
              </Stack>
              <Typography variant="body2" sx={{ color: '#9ca3af', mb: 2, fontSize: '0.8125rem', flex: 1 }}>
                {restrictedCount > 0
                  ? `${restrictedCount} lead${restrictedCount > 1 ? 's' : ''} restricted by Do-Not-Contact or client conflict policies.`
                  : 'No leads currently blocked by compliance or safety restrictions.'}
              </Typography>
              <Button
                component={Link}
                href="/leads?status=RESTRICTED"
                size="small"
                variant="outlined"
                fullWidth
                disabled={restrictedCount === 0}
                sx={{
                  textTransform: 'none',
                  fontSize: '0.8125rem',
                  fontWeight: 500,
                  borderRadius: '6px',
                  py: 0.5,
                  borderColor: restrictedCount > 0 ? 'rgba(244, 63, 94, 0.4)' : 'rgba(255, 255, 255, 0.08)',
                  color: restrictedCount > 0 ? '#fb7185' : '#64748b',
                  bgcolor: restrictedCount > 0 ? 'rgba(244, 63, 94, 0.06)' : 'transparent',
                  transition: 'background-color 140ms cubic-bezier(0.23, 1, 0.32, 1)',
                  '&:hover:not(:disabled)': {
                    borderColor: 'rgba(244, 63, 94, 0.7)',
                    bgcolor: 'rgba(244, 63, 94, 0.12)',
                  },
                  '&:active:not(:disabled)': {
                    transform: 'scale(0.97)',
                  },
                }}
              >
                {restrictedCount > 0 ? `Inspect ${restrictedCount} Restricted Lead${restrictedCount > 1 ? 's' : ''} →` : 'No Restrictions'}
              </Button>
            </Box>
          </Grid>

          {/* Action Card 3: Urgent Notifications */}
          <Grid size={{ xs: 12, md: 4 }}>
            <Box
              sx={{
                height: '100%',
                bgcolor: actionRequiredNotifs > 0 ? '#161820' : '#111318',
                border: actionRequiredNotifs > 0 ? '1px solid rgba(244, 63, 94, 0.35)' : '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '8px',
                p: 2.5,
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <Stack direction="row" spacing={1.5} sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                <Typography variant="body2" sx={{ color: '#f3f4f6', fontWeight: 600, fontSize: '0.84375rem' }}>
                  System Action Alerts
                </Typography>
                <Box
                  sx={{
                    px: 1,
                    py: 0.25,
                    borderRadius: '4px',
                    bgcolor: actionRequiredNotifs > 0 ? 'rgba(244, 63, 94, 0.12)' : 'rgba(16, 185, 129, 0.12)',
                    color: actionRequiredNotifs > 0 ? '#fb7185' : '#34d399',
                    border: actionRequiredNotifs > 0 ? '1px solid rgba(244, 63, 94, 0.25)' : '1px solid rgba(16, 185, 129, 0.25)',
                    fontWeight: 600,
                    fontSize: '0.625rem',
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                  }}
                >
                  {actionRequiredNotifs > 0 ? `${actionRequiredNotifs} URGENT` : 'CLEAR'}
                </Box>
              </Stack>
              <Typography variant="body2" sx={{ color: '#9ca3af', mb: 2, fontSize: '0.8125rem', flex: 1 }}>
                {actionRequiredNotifs > 0
                  ? `${actionRequiredNotifs} system alert${actionRequiredNotifs > 1 ? 's' : ''} require immediate resolution or review.`
                  : `${notifs?.unreadCount ?? 0} unread general notifications in the system feed.`}
              </Typography>
              <Button
                component={Link}
                href="/notifications"
                size="small"
                variant="outlined"
                fullWidth
                sx={{
                  textTransform: 'none',
                  fontSize: '0.8125rem',
                  fontWeight: 500,
                  borderRadius: '6px',
                  py: 0.5,
                  borderColor: actionRequiredNotifs > 0 ? 'rgba(244, 63, 94, 0.4)' : 'rgba(255, 255, 255, 0.10)',
                  color: actionRequiredNotifs > 0 ? '#fb7185' : '#f3f4f6',
                  bgcolor: '#161820',
                  transition: 'background-color 140ms cubic-bezier(0.23, 1, 0.32, 1)',
                  '&:hover': {
                    borderColor: actionRequiredNotifs > 0 ? 'rgba(244, 63, 94, 0.7)' : 'rgba(255, 255, 255, 0.18)',
                    bgcolor: 'rgba(255, 255, 255, 0.06)',
                  },
                  '&:active': {
                    transform: 'scale(0.97)',
                  },
                }}
              >
                {actionRequiredNotifs > 0 ? `Resolve ${actionRequiredNotifs} Alert${actionRequiredNotifs > 1 ? 's' : ''} →` : 'View All Notifications →'}
              </Button>
            </Box>
          </Grid>
        </Grid>
      </Box>

      {/* 3. CORE METRICS & PIPELINE PROGRESSION */}
      <Grid container spacing={2.5}>
        {/* Left Column: Lifecycle Distribution Breakdown */}
        <Grid size={{ xs: 12, md: 7 }}>
          <Box
            sx={{
              height: '100%',
              bgcolor: '#111318',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '8px',
              p: 3,
            }}
          >
            <Stack direction="row" spacing={1.5} sx={{ justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
              <Box>
                <Typography
                  variant="h3"
                  sx={{
                    color: '#f3f4f6',
                    mb: 0.5,
                    fontSize: '0.9375rem',
                    fontWeight: 600,
                    letterSpacing: '-0.015em',
                  }}
                >
                  Lead Lifecycle & Pipeline Velocity
                </Typography>
                <Typography variant="body2" sx={{ color: '#9ca3af', fontSize: '0.8125rem' }}>
                  Real-time status breakdown across autonomous prospecting stages. Click any status to view filtered leads.
                </Typography>
              </Box>
              <Button
                component={Link}
                href="/leads"
                size="small"
                variant="text"
                sx={{
                  color: '#818cf8',
                  textTransform: 'none',
                  fontSize: '0.8125rem',
                  fontWeight: 500,
                  whiteSpace: 'nowrap',
                  p: 0,
                  minWidth: 0,
                  '&:hover': { bgcolor: 'transparent', color: '#a5b4fc' },
                }}
              >
                View All Leads ({leads?.total ?? 0}) →
              </Button>
            </Stack>

            {/* Honest Sampling Disclosure */}
            <Box
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 1,
                px: 1.25,
                py: 0.35,
                my: 2,
                borderRadius: '4px',
                bgcolor: '#161820',
                border: '1px solid rgba(255, 255, 255, 0.06)',
              }}
            >
              <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.71875rem' }}>
                Active sample: first <strong style={{ color: '#9ca3af' }}>{leads?.items?.length ?? 0}</strong> of <strong style={{ color: '#9ca3af' }}>{leads?.total ?? 0}</strong> total leads in pipeline
              </Typography>
            </Box>

            {Object.keys(leadDistribution).length === 0 ? (
              <Box sx={{ py: 5, textAlign: 'center', color: '#64748b' }}>
                <Typography variant="body2">No leads data recorded yet.</Typography>
              </Box>
            ) : (
              <Stack spacing={1.5}>
                {Object.entries(leadDistribution).map(([status, count]) => {
                  const totalSample = leads?.items?.length || 1;
                  const percentage = Math.round((count / totalSample) * 100);

                  let chipBg = 'rgba(79, 70, 229, 0.12)';
                  let chipColor = '#818cf8';
                  let chipBorder = '1px solid rgba(79, 70, 229, 0.25)';
                  let progressColor: 'error' | 'warning' | 'success' | 'info' | 'primary' = 'primary';

                  if (status === 'RESTRICTED') {
                    chipBg = 'rgba(244, 63, 94, 0.12)';
                    chipColor = '#fb7185';
                    chipBorder = '1px solid rgba(244, 63, 94, 0.25)';
                    progressColor = 'error';
                  } else if (status === 'HUMAN_REVIEW') {
                    chipBg = 'rgba(245, 158, 11, 0.12)';
                    chipColor = '#fbbf24';
                    chipBorder = '1px solid rgba(245, 158, 11, 0.25)';
                    progressColor = 'warning';
                  } else if (status === 'QUALIFIED' || status === 'WON') {
                    chipBg = 'rgba(16, 185, 129, 0.12)';
                    chipColor = '#34d399';
                    chipBorder = '1px solid rgba(16, 185, 129, 0.25)';
                    progressColor = 'success';
                  } else if (status === 'CONTACTED' || status === 'INTERESTED' || status === 'RESPONDED') {
                    chipBg = 'rgba(14, 165, 233, 0.12)';
                    chipColor = '#38bdf8';
                    chipBorder = '1px solid rgba(14, 165, 233, 0.25)';
                    progressColor = 'info';
                  }

                  return (
                    <Box
                      key={status}
                      component={Link}
                      href={`/leads?status=${status}`}
                      sx={{
                        p: 1.5,
                        borderRadius: '6px',
                        bgcolor: '#161820',
                        border: '1px solid rgba(255, 255, 255, 0.06)',
                        display: 'block',
                        textDecoration: 'none',
                        transition: 'border-color 140ms cubic-bezier(0.23, 1, 0.32, 1), background-color 140ms cubic-bezier(0.23, 1, 0.32, 1)',
                        '&:hover': {
                          borderColor: 'rgba(255, 255, 255, 0.15)',
                          bgcolor: '#1c1f2a',
                        },
                      }}
                    >
                      <Stack direction="row" spacing={1.5} sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                          <Box
                            sx={{
                              px: 1,
                              py: 0.25,
                              borderRadius: '4px',
                              bgcolor: chipBg,
                              color: chipColor,
                              border: chipBorder,
                              fontSize: '0.625rem',
                              fontWeight: 600,
                              letterSpacing: '0.04em',
                              textTransform: 'uppercase',
                            }}
                          >
                            {status.replace(/_/g, ' ')}
                          </Box>
                          <Typography variant="body2" sx={{ color: '#f3f4f6', fontWeight: 600, fontSize: '0.8125rem' }}>
                            {count} lead{count > 1 ? 's' : ''}
                          </Typography>
                        </Stack>
                        <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.75rem', fontVariantNumeric: 'tabular-nums' }}>
                          {percentage}% of sample →
                        </Typography>
                      </Stack>
                      <LinearProgress
                        variant="determinate"
                        value={percentage}
                        color={progressColor}
                        sx={{
                          height: 4,
                          borderRadius: 2,
                          bgcolor: 'rgba(255, 255, 255, 0.06)',
                        }}
                      />
                    </Box>
                  );
                })}
              </Stack>
            )}
          </Box>
        </Grid>

        {/* Right Column: System Notifications & Live Audit Feed */}
        <Grid size={{ xs: 12, md: 5 }}>
          <Box
            sx={{
              height: '100%',
              bgcolor: '#111318',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '8px',
              p: 3,
            }}
          >
            <Stack direction="row" spacing={1.5} sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography
                variant="h3"
                sx={{
                  color: '#f3f4f6',
                  fontSize: '0.9375rem',
                  fontWeight: 600,
                  letterSpacing: '-0.015em',
                }}
              >
                Action Items & Alerts
              </Typography>
              <Button
                component={Link}
                href="/notifications"
                size="small"
                variant="text"
                sx={{
                  color: '#818cf8',
                  textTransform: 'none',
                  fontSize: '0.8125rem',
                  fontWeight: 500,
                  p: 0,
                  minWidth: 0,
                  '&:hover': { bgcolor: 'transparent', color: '#a5b4fc' },
                }}
              >
                View All ({notifs?.total ?? 0}) →
              </Button>
            </Stack>
            <Typography variant="body2" sx={{ color: '#9ca3af', mb: 2, fontSize: '0.8125rem' }}>
              Latest system alerts and operational signals requiring review.
            </Typography>

            {!notifs?.items || notifs.items.length === 0 ? (
              <Box sx={{ py: 5, textAlign: 'center', color: '#64748b' }}>
                <Typography variant="body2">No unread notifications.</Typography>
              </Box>
            ) : (
              <Stack spacing={1.5}>
                {notifs.items.map((n) => {
                  let alertBg = 'rgba(14, 165, 233, 0.12)';
                  let alertColor = '#38bdf8';
                  let alertBorder = 'rgba(14, 165, 233, 0.25)';

                  if (n.priority === 'ACTION_REQUIRED') {
                    alertBg = 'rgba(244, 63, 94, 0.12)';
                    alertColor = '#fb7185';
                    alertBorder = 'rgba(244, 63, 94, 0.3)';
                  } else if (n.priority === 'IMPORTANT') {
                    alertBg = 'rgba(245, 158, 11, 0.12)';
                    alertColor = '#fbbf24';
                    alertBorder = 'rgba(245, 158, 11, 0.3)';
                  }

                  return (
                    <Box
                      key={n.id}
                      sx={{
                        p: 2,
                        borderRadius: '6px',
                        bgcolor: '#161820',
                        border: `1px solid ${alertBorder}`,
                      }}
                    >
                      <Stack direction="row" spacing={1.5} sx={{ justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.75 }}>
                        <Typography variant="body2" sx={{ color: '#f3f4f6', fontWeight: 600, fontSize: '0.8125rem' }}>
                          {n.title}
                        </Typography>
                        <Box
                          sx={{
                            px: 1,
                            py: 0.25,
                            borderRadius: '4px',
                            bgcolor: alertBg,
                            color: alertColor,
                            fontSize: '0.625rem',
                            fontWeight: 600,
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                          }}
                        >
                          {n.priority}
                        </Box>
                      </Stack>
                      <Typography variant="body2" sx={{ color: '#9ca3af', mb: 1, fontSize: '0.8125rem', lineHeight: 1.45 }}>
                        {n.message}
                      </Typography>
                      <Stack direction="row" spacing={1.5} sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.71875rem', fontVariantNumeric: 'tabular-nums' }}>
                          {new Date(n.createdAt).toLocaleString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </Typography>
                        <Button
                          component={Link}
                          href="/notifications"
                          size="small"
                          variant="text"
                          sx={{
                            p: 0,
                            minWidth: 0,
                            fontSize: '0.75rem',
                            textTransform: 'none',
                            color: '#818cf8',
                            '&:hover': { bgcolor: 'transparent', color: '#a5b4fc' },
                          }}
                        >
                          Act on Alert →
                        </Button>
                      </Stack>
                    </Box>
                  );
                })}
              </Stack>
            )}
          </Box>
        </Grid>
      </Grid>

      {/* 4. INFRASTRUCTURE HEALTH & OPERATIONAL DIAGNOSTICS */}
      <Box
        sx={{
          bgcolor: '#111318',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '8px',
          p: { xs: 2.5, sm: 3 },
        }}
      >
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={2}
          sx={{
            justifyContent: 'space-between',
            alignItems: { xs: 'flex-start', md: 'center' },
          }}
        >
          <Box>
            <Typography
              variant="subtitle2"
              sx={{
                color: '#64748b',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                mb: 0.5,
                fontSize: '0.6875rem',
                fontWeight: 600,
              }}
            >
              Infrastructure Status
            </Typography>
            <Typography variant="body2" sx={{ color: '#9ca3af', fontSize: '0.8125rem' }}>
              Live health telemetry from backend microservices and data pipelines.
            </Typography>
          </Box>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3} sx={{ alignItems: { sm: 'center' } }}>
            <Box>
              <Typography variant="caption" sx={{ color: '#64748b', display: 'block', fontSize: '0.71875rem' }}>
                PostgreSQL Primary
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  color: health?.database?.status === 'up' ? '#34d399' : '#fb7185',
                  fontWeight: 600,
                  fontSize: '0.8125rem',
                }}
              >
                {health?.database?.status === 'up' ? `Online (${health?.database?.latencyMs ?? 0}ms)` : 'Offline'}
              </Typography>
            </Box>

            <Divider orientation="vertical" flexItem sx={{ display: { xs: 'none', sm: 'block' }, borderColor: 'rgba(255, 255, 255, 0.06)' }} />

            <Box>
              <Typography variant="caption" sx={{ color: '#64748b', display: 'block', fontSize: '0.71875rem' }}>
                Redis Distributed Cache
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  color: health?.redis?.status === 'up' ? '#34d399' : '#fb7185',
                  fontWeight: 600,
                  fontSize: '0.8125rem',
                }}
              >
                {health?.redis?.status === 'up' ? `Online (${health?.redis?.latencyMs ?? 0}ms)` : 'Offline'}
              </Typography>
            </Box>

            <Divider orientation="vertical" flexItem sx={{ display: { xs: 'none', sm: 'block' }, borderColor: 'rgba(255, 255, 255, 0.06)' }} />

            <Box>
              <Typography variant="caption" sx={{ color: '#64748b', display: 'block', fontSize: '0.71875rem' }}>
                API Gateway
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  color: isSystemHealthy ? '#34d399' : '#fbbf24',
                  fontWeight: 600,
                  fontSize: '0.8125rem',
                }}
              >
                {isSystemHealthy ? 'Operational' : 'Degraded'}
              </Typography>
            </Box>
          </Stack>
        </Stack>
      </Box>
    </Box>
  );
}
