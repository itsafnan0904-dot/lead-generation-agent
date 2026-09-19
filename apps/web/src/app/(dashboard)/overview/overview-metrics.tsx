'use client';

import React from 'react';
import Link from 'next/link';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Stack,
  Chip,
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
  // Responsive layout check: detect small/mobile screens for dynamic spacing and stacking.
  // noSsr: true ensures server-rendered markup uses a consistent default state and avoids
  // hydration mismatches or layout flash with the browser's window.matchMedia on client hydration.
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
        p: isMobile ? 2 : { xs: 2, sm: 3, md: 4 },
        display: 'flex',
        flexDirection: 'column',
        gap: isMobile ? 2.5 : 3,
        maxWidth: 1400,
        width: '100%',
        mx: 'auto',
      }}
    >
      {/* 1. OPERATOR PULSE & AUTONOMOUS ENGINE STATE BANNER */}
      <Card
        sx={{
          bgcolor: 'var(--bg-surface)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-md)',
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
                  py: 0.5,
                  borderRadius: 'var(--radius-full)',
                  bgcolor: isSystemHealthy ? 'var(--accent-success-muted)' : 'var(--accent-warning-muted)',
                  border: `1px solid ${isSystemHealthy ? 'rgba(16, 185, 129, 0.25)' : 'rgba(245, 158, 11, 0.25)'}`,
                }}
              >
                <Box
                  sx={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    bgcolor: isSystemHealthy ? 'var(--accent-success)' : 'var(--accent-warning)',
                  }}
                />
                <Typography
                  variant="caption"
                  sx={{
                    fontWeight: 600,
                    color: isSystemHealthy ? '#34d399' : '#fbbf24',
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                  }}
                >
                  {isSystemHealthy ? 'Autonomous Engine Active' : 'System Needs Attention'}
                </Typography>
              </Box>

              <Typography variant="caption" sx={{ color: 'var(--text-muted)' }}>
                Uptime: {formatUptime(health?.uptimeSeconds)}
              </Typography>
            </Stack>

            <Typography variant="h2" sx={{ color: 'var(--text-primary)', mb: 0.5 }}>
              Enterprise Sales Cockpit
            </Typography>
            <Typography variant="body2" sx={{ color: 'var(--text-secondary)' }}>
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
              className="btn-primary"
              sx={{ textTransform: 'none', px: 2 }}
            >
              Open Leads Directory →
            </Button>
            <Button
              component={Link}
              href="/activity"
              variant="outlined"
              size="small"
              className="btn-secondary"
              sx={{ textTransform: 'none', px: 2 }}
            >
              Live Activity Stream
            </Button>
          </Stack>
        </Stack>
      </Card>

      {/* 2. HIGH-PRIORITY ACTION & GOVERNANCE QUEUE (Answers: "What needs my attention?") */}
      <Box>
        <Stack direction="row" spacing={1.5} sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
          <Typography variant="subtitle2" sx={{ color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Action Required Queue
          </Typography>
          {totalAttentionItems > 0 && (
            <Chip
              size="small"
              label={`${totalAttentionItems} ACTIONABLE`}
              sx={{
                bgcolor: 'var(--accent-danger-muted)',
                color: '#fb7185',
                border: '1px solid rgba(244, 63, 94, 0.25)',
                fontWeight: 600,
                fontSize: '0.6875rem',
              }}
            />
          )}
        </Stack>

        <Grid container spacing={2}>
          {/* Action Card 1: Human Reviews */}
          <Grid size={{ xs: 12, md: 4 }}>
            <Card
              sx={{
                height: '100%',
                bgcolor: humanReviewCount > 0 ? 'var(--bg-surface)' : 'var(--bg-surface-subtle)',
                border: humanReviewCount > 0 ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
              }}
            >
              <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
                <Stack direction="row" spacing={1.5} sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                  <Typography variant="body2" fontWeight={600} sx={{ color: 'var(--text-primary)' }}>
                    Human Reviews Required
                  </Typography>
                  <Chip
                    size="small"
                    label={humanReviewCount > 0 ? `${humanReviewCount} PENDING` : 'CLEAR'}
                    sx={{
                      bgcolor: humanReviewCount > 0 ? 'var(--accent-warning-muted)' : 'var(--accent-success-muted)',
                      color: humanReviewCount > 0 ? '#fbbf24' : '#34d399',
                      fontWeight: 600,
                      fontSize: '0.6875rem',
                      height: 22,
                    }}
                  />
                </Stack>
                <Typography variant="body2" sx={{ color: 'var(--text-secondary)', mb: 2, minHeight: 40 }}>
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
                    borderColor: humanReviewCount > 0 ? 'rgba(245, 158, 11, 0.4)' : 'var(--border-subtle)',
                    color: humanReviewCount > 0 ? '#fbbf24' : 'var(--text-muted)',
                    '&:hover': {
                      borderColor: 'rgba(245, 158, 11, 0.7)',
                      bgcolor: 'rgba(245, 158, 11, 0.08)',
                    },
                  }}
                >
                  {humanReviewCount > 0 ? `Review ${humanReviewCount} Lead${humanReviewCount > 1 ? 's' : ''} →` : 'Queue Empty'}
                </Button>
              </CardContent>
            </Card>
          </Grid>

          {/* Action Card 2: Restricted Leads */}
          <Grid size={{ xs: 12, md: 4 }}>
            <Card
              sx={{
                height: '100%',
                bgcolor: restrictedCount > 0 ? 'var(--bg-surface)' : 'var(--bg-surface-subtle)',
                border: restrictedCount > 0 ? '1px solid rgba(244, 63, 94, 0.3)' : '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
              }}
            >
              <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
                <Stack direction="row" spacing={1.5} sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                  <Typography variant="body2" fontWeight={600} sx={{ color: 'var(--text-primary)' }}>
                    Compliance Restrictions
                  </Typography>
                  <Chip
                    size="small"
                    label={restrictedCount > 0 ? `${restrictedCount} BLOCKED` : 'CLEAR'}
                    sx={{
                      bgcolor: restrictedCount > 0 ? 'var(--accent-danger-muted)' : 'var(--accent-success-muted)',
                      color: restrictedCount > 0 ? '#fb7185' : '#34d399',
                      fontWeight: 600,
                      fontSize: '0.6875rem',
                      height: 22,
                    }}
                  />
                </Stack>
                <Typography variant="body2" sx={{ color: 'var(--text-secondary)', mb: 2, minHeight: 40 }}>
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
                    borderColor: restrictedCount > 0 ? 'rgba(244, 63, 94, 0.4)' : 'var(--border-subtle)',
                    color: restrictedCount > 0 ? '#fb7185' : 'var(--text-muted)',
                    '&:hover': {
                      borderColor: 'rgba(244, 63, 94, 0.7)',
                      bgcolor: 'rgba(244, 63, 94, 0.08)',
                    },
                  }}
                >
                  {restrictedCount > 0 ? `Inspect ${restrictedCount} Restricted Lead${restrictedCount > 1 ? 's' : ''} →` : 'No Restrictions'}
                </Button>
              </CardContent>
            </Card>
          </Grid>

          {/* Action Card 3: Urgent Notifications */}
          <Grid size={{ xs: 12, md: 4 }}>
            <Card
              sx={{
                height: '100%',
                bgcolor: actionRequiredNotifs > 0 ? 'var(--bg-surface)' : 'var(--bg-surface-subtle)',
                border: actionRequiredNotifs > 0 ? '1px solid rgba(244, 63, 94, 0.3)' : '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
              }}
            >
              <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
                <Stack direction="row" spacing={1.5} sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                  <Typography variant="body2" fontWeight={600} sx={{ color: 'var(--text-primary)' }}>
                    System Action Alerts
                  </Typography>
                  <Chip
                    size="small"
                    label={actionRequiredNotifs > 0 ? `${actionRequiredNotifs} URGENT` : 'CLEAR'}
                    sx={{
                      bgcolor: actionRequiredNotifs > 0 ? 'var(--accent-danger-muted)' : 'var(--accent-success-muted)',
                      color: actionRequiredNotifs > 0 ? '#fb7185' : '#34d399',
                      fontWeight: 600,
                      fontSize: '0.6875rem',
                      height: 22,
                    }}
                  />
                </Stack>
                <Typography variant="body2" sx={{ color: 'var(--text-secondary)', mb: 2, minHeight: 40 }}>
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
                    borderColor: actionRequiredNotifs > 0 ? 'rgba(244, 63, 94, 0.4)' : 'var(--border-default)',
                    color: actionRequiredNotifs > 0 ? '#fb7185' : 'var(--text-primary)',
                    '&:hover': {
                      borderColor: actionRequiredNotifs > 0 ? 'rgba(244, 63, 94, 0.7)' : 'var(--border-strong)',
                      bgcolor: 'rgba(255, 255, 255, 0.04)',
                    },
                  }}
                >
                  {actionRequiredNotifs > 0 ? `Resolve ${actionRequiredNotifs} Alert${actionRequiredNotifs > 1 ? 's' : ''} →` : 'View All Notifications →'}
                </Button>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>

      {/* 3. CORE METRICS & PIPELINE PROGRESSION (Answers: "What progress is being made?") */}
      <Grid container spacing={3}>
        {/* Left Column: Lifecycle Distribution Breakdown */}
        <Grid size={{ xs: 12, md: 7 }}>
          <Card sx={{ height: '100%', bgcolor: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)' }}>
            <CardContent sx={{ p: 3, '&:last-child': { pb: 3 } }}>
              <Stack direction="row" spacing={1.5} sx={{ justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                <Box>
                  <Typography variant="h3" sx={{ color: 'var(--text-primary)', mb: 0.5 }}>
                    Lead Lifecycle & Pipeline Velocity
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'var(--text-secondary)' }}>
                    Real-time status breakdown across autonomous prospecting stages. Click any status to view filtered leads.
                  </Typography>
                </Box>
                <Button
                  component={Link}
                  href="/leads"
                  size="small"
                  variant="text"
                  sx={{ color: 'var(--accent-primary-light)', textTransform: 'none', fontSize: '0.8125rem', whiteSpace: 'nowrap' }}
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
                  px: 1.5,
                  py: 0.5,
                  mb: 3,
                  borderRadius: 'var(--radius-sm)',
                  bgcolor: 'var(--bg-surface-subtle)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <Typography variant="caption" sx={{ color: 'var(--text-muted)' }}>
                  Active sample: first <strong>{leads?.items?.length ?? 0}</strong> of <strong>{leads?.total ?? 0}</strong> total leads in pipeline
                </Typography>
              </Box>

              {Object.keys(leadDistribution).length === 0 ? (
                <Box sx={{ py: 6, textAlign: 'center', color: 'var(--text-muted)' }}>
                  <Typography variant="body2">No leads data recorded yet.</Typography>
                </Box>
              ) : (
                <Stack spacing={2}>
                  {Object.entries(leadDistribution).map(([status, count]) => {
                    const totalSample = leads?.items?.length || 1;
                    const percentage = Math.round((count / totalSample) * 100);

                    let chipBg = 'var(--accent-primary-muted)';
                    let chipColor = 'var(--accent-primary-light)';
                    let progressColor: 'error' | 'warning' | 'success' | 'info' | 'primary' = 'primary';

                    if (status === 'RESTRICTED') {
                      chipBg = 'var(--accent-danger-muted)';
                      chipColor = '#fb7185';
                      progressColor = 'error';
                    } else if (status === 'HUMAN_REVIEW') {
                      chipBg = 'var(--accent-warning-muted)';
                      chipColor = '#fbbf24';
                      progressColor = 'warning';
                    } else if (status === 'QUALIFIED' || status === 'WON') {
                      chipBg = 'var(--accent-success-muted)';
                      chipColor = '#34d399';
                      progressColor = 'success';
                    } else if (status === 'CONTACTED' || status === 'INTERESTED' || status === 'RESPONDED') {
                      chipBg = 'var(--accent-info-muted)';
                      chipColor = '#38bdf8';
                      progressColor = 'info';
                    }

                    return (
                      <Box
                        key={status}
                        component={Link}
                        href={`/leads?status=${status}`}
                        sx={{
                          p: 1.5,
                          borderRadius: 'var(--radius-sm)',
                          bgcolor: 'var(--bg-surface-subtle)',
                          border: '1px solid var(--border-subtle)',
                          display: 'block',
                          textDecoration: 'none',
                          transition: 'var(--transition-default)',
                          '&:hover': {
                            borderColor: 'var(--border-strong)',
                            bgcolor: 'var(--bg-surface-hover)',
                          },
                        }}
                      >
                        <Stack direction="row" spacing={1.5} sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                            <Box
                              sx={{
                                px: 1,
                                py: 0.25,
                                borderRadius: 'var(--radius-sm)',
                                bgcolor: chipBg,
                                color: chipColor,
                                fontSize: '0.6875rem',
                                fontWeight: 600,
                                letterSpacing: '0.04em',
                                textTransform: 'uppercase',
                              }}
                            >
                              {status.replace(/_/g, ' ')}
                            </Box>
                            <Typography variant="body2" fontWeight={600} sx={{ color: 'var(--text-primary)' }}>
                              {count} lead{count > 1 ? 's' : ''}
                            </Typography>
                          </Stack>
                          <Typography variant="caption" sx={{ color: 'var(--text-muted)' }}>
                            {percentage}% of sample →
                          </Typography>
                        </Stack>
                        <LinearProgress
                          variant="determinate"
                          value={percentage}
                          color={progressColor}
                          sx={{
                            height: 5,
                            borderRadius: 2,
                            bgcolor: 'rgba(255, 255, 255, 0.05)',
                          }}
                        />
                      </Box>
                    );
                  })}
                </Stack>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Right Column: System Notifications & Live Audit Feed */}
        <Grid size={{ xs: 12, md: 5 }}>
          <Card sx={{ height: '100%', bgcolor: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)' }}>
            <CardContent sx={{ p: 3, '&:last-child': { pb: 3 } }}>
              <Stack direction="row" spacing={1.5} sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="h3" sx={{ color: 'var(--text-primary)' }}>
                  Action Items & Alerts
                </Typography>
                <Button
                  component={Link}
                  href="/notifications"
                  size="small"
                  variant="text"
                  sx={{ color: 'var(--accent-primary-light)', textTransform: 'none', fontSize: '0.8125rem' }}
                >
                  View All ({notifs?.total ?? 0}) →
                </Button>
              </Stack>
              <Typography variant="body2" sx={{ color: 'var(--text-secondary)', mb: 2.5 }}>
                Latest system alerts and operational signals requiring review.
              </Typography>

              {!notifs?.items || notifs.items.length === 0 ? (
                <Box sx={{ py: 6, textAlign: 'center', color: 'var(--text-muted)' }}>
                  <Typography variant="body2">No unread notifications.</Typography>
                </Box>
              ) : (
                <Stack spacing={1.5}>
                  {notifs.items.map((n) => {
                    let alertBg = 'var(--accent-info-muted)';
                    let alertColor = '#38bdf8';
                    let alertBorder = 'var(--border-subtle)';

                    if (n.priority === 'ACTION_REQUIRED') {
                      alertBg = 'var(--accent-danger-muted)';
                      alertColor = '#fb7185';
                      alertBorder = 'rgba(244, 63, 94, 0.3)';
                    } else if (n.priority === 'IMPORTANT') {
                      alertBg = 'var(--accent-warning-muted)';
                      alertColor = '#fbbf24';
                      alertBorder = 'rgba(245, 158, 11, 0.3)';
                    }

                    return (
                      <Box
                        key={n.id}
                        sx={{
                          p: 2,
                          borderRadius: 'var(--radius-sm)',
                          bgcolor: 'var(--bg-surface-subtle)',
                          border: `1px solid ${alertBorder}`,
                        }}
                      >
                        <Stack direction="row" spacing={1.5} sx={{ justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.75 }}>
                          <Typography variant="body2" fontWeight={600} sx={{ color: 'var(--text-primary)' }}>
                            {n.title}
                          </Typography>
                          <Box
                            sx={{
                              px: 1,
                              py: 0.25,
                              borderRadius: 'var(--radius-sm)',
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
                        <Typography variant="body2" sx={{ color: 'var(--text-secondary)', mb: 1.25, fontSize: '0.8125rem' }}>
                          {n.message}
                        </Typography>
                        <Stack direction="row" spacing={1.5} sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
                          <Typography variant="caption" sx={{ color: 'var(--text-muted)' }}>
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
                            sx={{ p: 0, minWidth: 0, fontSize: '0.75rem', textTransform: 'none', color: 'var(--accent-primary-light)' }}
                          >
                            Act on Alert →
                          </Button>
                        </Stack>
                      </Box>
                    );
                  })}
                </Stack>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* 4. INFRASTRUCTURE HEALTH & OPERATIONAL DIAGNOSTICS */}
      <Card
        sx={{
          bgcolor: 'var(--bg-surface)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-md)',
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
            <Typography variant="subtitle2" sx={{ color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 0.5 }}>
              Infrastructure Status
            </Typography>
            <Typography variant="body2" sx={{ color: 'var(--text-secondary)' }}>
              Live health telemetry from backend microservices and data pipelines.
            </Typography>
          </Box>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3} sx={{ alignItems: { sm: 'center' } }}>
            <Box>
              <Typography variant="caption" sx={{ color: 'var(--text-muted)', display: 'block' }}>
                PostgreSQL Primary
              </Typography>
              <Typography
                variant="body2"
                fontWeight={600}
                sx={{ color: health?.database?.status === 'up' ? 'var(--accent-success)' : 'var(--accent-danger)' }}
              >
                {health?.database?.status === 'up' ? `Online (${health?.database?.latencyMs ?? 0}ms)` : 'Offline'}
              </Typography>
            </Box>

            <Divider orientation="vertical" flexItem sx={{ display: { xs: 'none', sm: 'block' }, borderColor: 'var(--border-subtle)' }} />

            <Box>
              <Typography variant="caption" sx={{ color: 'var(--text-muted)', display: 'block' }}>
                Redis Distributed Cache
              </Typography>
              <Typography
                variant="body2"
                fontWeight={600}
                sx={{ color: health?.redis?.status === 'up' ? 'var(--accent-success)' : 'var(--accent-danger)' }}
              >
                {health?.redis?.status === 'up' ? `Online (${health?.redis?.latencyMs ?? 0}ms)` : 'Offline'}
              </Typography>
            </Box>

            <Divider orientation="vertical" flexItem sx={{ display: { xs: 'none', sm: 'block' }, borderColor: 'var(--border-subtle)' }} />

            <Box>
              <Typography variant="caption" sx={{ color: 'var(--text-muted)', display: 'block' }}>
                API Gateway
              </Typography>
              <Typography variant="body2" fontWeight={600} sx={{ color: isSystemHealthy ? 'var(--accent-success)' : 'var(--accent-warning)' }}>
                {isSystemHealthy ? 'Operational' : 'Degraded'}
              </Typography>
            </Box>
          </Stack>
        </Stack>
      </Card>
    </Box>
  );
}
