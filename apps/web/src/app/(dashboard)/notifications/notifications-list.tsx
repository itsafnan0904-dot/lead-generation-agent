'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import Pagination from '@mui/material/Pagination';
import Tooltip from '@mui/material/Tooltip';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import Badge from '@mui/material/Badge';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutlined';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import PriorityHighIcon from '@mui/icons-material/PriorityHigh';

export interface NotificationItem {
  id: string;
  userId: string;
  priority: 'INFO' | 'IMPORTANT' | 'ACTION_REQUIRED';
  title: string;
  message: string;
  entityType?: string | null;
  entityId?: string | null;
  isRead: boolean;
  readAt?: string | null;
  metadata?: any;
  createdAt: string;
  updatedAt: string;
}

interface NotificationsListProps {
  initialNotifications: NotificationItem[];
  initialTotal: number;
  initialUnreadCount: number;
  initialPage: number;
  initialLimit: number;
  initialPriority?: string;
  initialUnreadOnly?: boolean;
}

export function NotificationsList({
  initialNotifications,
  initialTotal,
  initialUnreadCount,
  initialPage,
  initialLimit,
  initialPriority = 'ALL',
  initialUnreadOnly = false,
}: NotificationsListProps) {
  const router = useRouter();

  const [notifications, setNotifications] = useState<NotificationItem[]>(initialNotifications);
  const [total, setTotal] = useState(initialTotal);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const [page, setPage] = useState(initialPage);
  const [priorityFilter, setPriorityFilter] = useState(initialPriority);
  const [unreadOnly, setUnreadOnly] = useState(initialUnreadOnly);
  const [loading, setLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [markingId, setMarkingId] = useState<string | null>(null);

  const fetchFilteredNotifications = async (
    newPage: number,
    priority: string,
    isUnreadOnly: boolean,
  ) => {
    setLoading(true);
    setActionError(null);

    try {
      const params = new URLSearchParams();
      params.set('page', String(newPage));
      params.set('limit', String(initialLimit));
      if (priority !== 'ALL') params.set('priority', priority);
      if (isUnreadOnly) params.set('isRead', 'false');

      const res = await fetch(`/api/notifications?${params.toString()}`);
      const data = await res.json();

      if (!res.ok) {
        setActionError(data.error || 'Failed to fetch notifications');
      } else {
        setNotifications(data.items || []);
        setTotal(data.total || 0);
        setUnreadCount(data.unreadCount || 0);
        setPage(data.page || newPage);
      }
    } catch (err: any) {
      setActionError(err.message || 'Network error fetching notifications');
    } finally {
      setLoading(false);
    }
  };

  const handlePriorityChange = (_: React.SyntheticEvent, newPriority: string) => {
    setPriorityFilter(newPriority);
    fetchFilteredNotifications(1, newPriority, unreadOnly);
  };

  const handleUnreadToggle = (event: React.ChangeEvent<HTMLInputElement>) => {
    const checked = event.target.checked;
    setUnreadOnly(checked);
    fetchFilteredNotifications(1, priorityFilter, checked);
  };

  const handlePageChange = (_: React.ChangeEvent<unknown>, newPage: number) => {
    setPage(newPage);
    fetchFilteredNotifications(newPage, priorityFilter, unreadOnly);
  };

  const handleMarkAsRead = async (notifId: string, event?: React.MouseEvent) => {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }

    setMarkingId(notifId);
    setActionError(null);

    try {
      const res = await fetch(`/api/notifications/${notifId}/read`, {
        method: 'PATCH',
      });
      const data = await res.json();

      if (!res.ok) {
        setActionError(data.error || 'Failed to mark notification as read');
      } else {
        setNotifications((prev) =>
          prev.map((n) => (n.id === notifId ? { ...n, isRead: true, readAt: data.readAt } : n)),
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
        router.refresh();
      }
    } catch (err: any) {
      setActionError(err.message || 'Network error marking as read');
    } finally {
      setMarkingId(null);
    }
  };

  /**
   * Helper to resolve genuine entity links to existing dashboard screens.
   * STRICT PRESERVATION OF ENTITY RESOLUTION LOGIC:
   * Maps entityType and entityId (or metadata.leadId/companyId) to real paths:
   * - HUMAN_REVIEW -> /leads/[leadId] (from metadata.leadId)
   * - OUTREACH_DRAFT -> /leads/[leadId] (from metadata.leadId)
   * - COMPANY -> /companies/[entityId]
   * - CONVERSATION -> /conversations/[entityId]
   * - LEAD -> /leads/[entityId]
   * Returns null if unresolvable (so no broken link is rendered).
   */
  const getEntityLink = (n: NotificationItem): string | null => {
    if (!n.entityType) return null;

    if (n.entityType === 'HUMAN_REVIEW') {
      const leadId = n.metadata?.leadId;
      return leadId ? `/leads/${leadId}` : null;
    }

    if (n.entityType === 'OUTREACH_DRAFT') {
      const leadId = n.metadata?.leadId;
      return leadId ? `/leads/${leadId}` : null;
    }

    if (n.entityType === 'COMPANY' && n.entityId) {
      return `/companies/${n.entityId}`;
    }

    if (n.entityType === 'CONVERSATION' && n.entityId) {
      return `/conversations/${n.entityId}`;
    }

    if (n.entityType === 'LEAD' && n.entityId) {
      return `/leads/${n.entityId}`;
    }

    return null;
  };

  /**
   * Section 13 Action Framing:
   * Replaces passive "View Associated..." with clear, context-aware next action guidance.
   */
  const getActionLabel = (n: NotificationItem): string => {
    switch (n.entityType) {
      case 'HUMAN_REVIEW':
        return 'Review Lead Restrictions →';
      case 'OUTREACH_DRAFT':
        return 'Review Outreach Draft →';
      case 'COMPANY':
        return 'Inspect Company Intelligence →';
      case 'CONVERSATION':
        return 'Open Conversation Thread →';
      case 'LEAD':
        return 'View Lead Dossier →';
      default:
        return 'View Associated Record →';
    }
  };

  /**
   * Section 10 Actor / Sourcing Badges:
   * Renders consistent actor pills identical to activity-timeline.tsx.
   */
  const renderActorBadge = (n: NotificationItem) => {
    const rawActor = n.metadata?.actorType;
    let actorType: 'AI' | 'SYSTEM' | 'USER' = 'SYSTEM';

    if (rawActor === 'AI' || rawActor === 'USER' || rawActor === 'SYSTEM') {
      actorType = rawActor;
    } else if (
      n.title.toLowerCase().includes('research completed') ||
      n.title.toLowerCase().includes('outreach sent') ||
      n.title.toLowerCase().includes('ai ') ||
      n.entityType === 'OUTREACH_DRAFT'
    ) {
      actorType = 'AI';
    } else if (
      n.metadata?.resolvedByUserId ||
      n.title.toLowerCase().includes('user') ||
      n.title.toLowerCase().includes('operator')
    ) {
      actorType = 'USER';
    }

    if (actorType === 'AI') {
      return (
        <Tooltip title="Triggered by Autonomous AI Sales Agent Orchestrator" arrow>
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.5,
              px: 1,
              py: 0.25,
              borderRadius: 'var(--radius-sm)',
              bgcolor: 'var(--accent-success-muted)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              color: '#34d399',
              fontSize: '0.625rem',
              fontWeight: 700,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}
          >
            <span>● AI Agent</span>
          </Box>
        </Tooltip>
      );
    }

    if (actorType === 'USER') {
      return (
        <Tooltip title="Triggered by Human Sales Representative / Compliance Operator" arrow>
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.5,
              px: 1,
              py: 0.25,
              borderRadius: 'var(--radius-sm)',
              bgcolor: 'var(--accent-primary-muted)',
              border: '1px solid rgba(99, 102, 241, 0.3)',
              color: '#818cf8',
              fontSize: '0.625rem',
              fontWeight: 700,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}
          >
            <span>✋ Human User</span>
          </Box>
        </Tooltip>
      );
    }

    return (
      <Tooltip title="Triggered by Compliance Engine / Scheduled Background Job" arrow>
        <Box
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.5,
            px: 1,
            py: 0.25,
            borderRadius: 'var(--radius-sm)',
            bgcolor: 'var(--accent-info-muted)',
            border: '1px solid rgba(14, 165, 233, 0.3)',
            color: '#38bdf8',
            fontSize: '0.625rem',
            fontWeight: 700,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
          }}
        >
          <span>⚙ System Engine</span>
        </Box>
      </Tooltip>
    );
  };

  const totalPages = Math.ceil(total / initialLimit) || 1;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Top Filter & Controls Surface */}
      <Card
        sx={{
          bgcolor: 'var(--bg-surface)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-md)',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        <CardContent sx={{ p: { xs: 2, sm: 2.5 }, '&:last-child': { pb: { xs: 2, sm: 2.5 } } }}>
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={2}
            sx={{
              justifyContent: 'space-between',
              alignItems: { xs: 'flex-start', md: 'center' },
            }}
          >
            {/* Left: Priority Filter Tabs with Visual Indicators */}
            <Tabs
              value={priorityFilter}
              onChange={handlePriorityChange}
              textColor="inherit"
              variant="scrollable"
              scrollButtons="auto"
              sx={{
                minHeight: 42,
                '& .MuiTabs-indicator': {
                  backgroundColor: 'var(--accent-primary)',
                  height: 2,
                },
                '& .MuiTab-root': {
                  color: 'var(--text-secondary)',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  textTransform: 'none',
                  minHeight: 42,
                  py: 1,
                  px: 1.75,
                  letterSpacing: '-0.01em',
                  '&.Mui-selected': {
                    color: 'var(--text-primary)',
                  },
                },
              }}
            >
              <Tab label="All Priorities" value="ALL" />
              <Tab
                label={
                  <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
                    <Box
                      sx={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        bgcolor: 'var(--accent-danger)',
                        boxShadow: '0 0 6px rgba(244, 63, 94, 0.6)',
                      }}
                    />
                    <span>Action Required</span>
                  </Stack>
                }
                value="ACTION_REQUIRED"
              />
              <Tab
                label={
                  <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
                    <Box
                      sx={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        bgcolor: 'var(--accent-warning)',
                      }}
                    />
                    <span>Important</span>
                  </Stack>
                }
                value="IMPORTANT"
              />
              <Tab
                label={
                  <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
                    <Box
                      sx={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        bgcolor: 'var(--accent-info)',
                      }}
                    />
                    <span>Info</span>
                  </Stack>
                }
                value="INFO"
              />
            </Tabs>

            {/* Right: Unread Toggle & Feed Counter */}
            <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  bgcolor: 'var(--bg-surface-subtle)',
                  px: 1.5,
                  py: 0.5,
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <FormControlLabel
                  control={
                    <Switch
                      checked={unreadOnly}
                      onChange={handleUnreadToggle}
                      size="small"
                      sx={{
                        '& .MuiSwitch-switchBase.Mui-checked': {
                          color: 'var(--accent-primary)',
                        },
                        '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                          backgroundColor: 'var(--accent-primary)',
                        },
                      }}
                    />
                  }
                  label={
                    <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                      <Typography
                        variant="body2"
                        sx={{
                          fontSize: '0.8125rem',
                          fontWeight: 500,
                          color: unreadOnly ? 'var(--text-primary)' : 'var(--text-secondary)',
                        }}
                      >
                        Unread only
                      </Typography>
                      {unreadCount > 0 && (
                        <Box
                          sx={{
                            bgcolor: 'var(--accent-danger-muted)',
                            color: '#fb7185',
                            border: '1px solid rgba(244, 63, 94, 0.3)',
                            fontSize: '0.6875rem',
                            fontWeight: 700,
                            px: 0.75,
                            py: 0.1,
                            borderRadius: 'var(--radius-full)',
                            lineHeight: 1.3,
                          }}
                        >
                          {unreadCount}
                        </Box>
                      )}
                    </Stack>
                  }
                  sx={{ mr: 0 }}
                />
              </Box>
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      {/* Action Error Banner */}
      {actionError && (
        <Alert
          severity="error"
          onClose={() => setActionError(null)}
          sx={{
            bgcolor: 'var(--accent-danger-muted)',
            color: '#fb7185',
            border: '1px solid rgba(244, 63, 94, 0.3)',
            borderRadius: 'var(--radius-sm)',
            '& .MuiAlert-icon': { color: '#fb7185' },
          }}
        >
          {actionError}
        </Alert>
      )}

      {/* Notifications Feed */}
      {loading ? (
        <Box sx={{ py: 10, textAlign: 'center' }}>
          <CircularProgress size={32} sx={{ color: 'var(--accent-primary)' }} />
          <Typography
            variant="body2"
            sx={{ color: 'var(--text-secondary)', mt: 2, fontSize: '0.875rem' }}
          >
            Loading system feed & alerts...
          </Typography>
        </Box>
      ) : notifications.length === 0 ? (
        <Card
          sx={{
            bgcolor: 'var(--bg-surface)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-md)',
          }}
        >
          <CardContent sx={{ p: { xs: 5, sm: 8 }, textAlign: 'center' }}>
            <Box
              sx={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                bgcolor: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mx: 'auto',
                mb: 2,
              }}
            >
              <CheckCircleOutlineIcon sx={{ fontSize: 28, color: 'var(--text-muted)' }} />
            </Box>
            <Typography
              variant="h3"
              sx={{
                fontSize: '1rem',
                fontWeight: 600,
                color: 'var(--text-primary)',
                mb: 0.75,
                letterSpacing: '-0.01em',
              }}
            >
              All clear — no notifications
            </Typography>
            <Typography
              variant="body2"
              sx={{ color: 'var(--text-secondary)', maxWidth: 460, mx: 'auto', fontSize: '0.875rem' }}
            >
              {unreadOnly
                ? 'You have addressed all pending items. There are no unread notifications under this view.'
                : 'No system notifications match the selected priority filter.'}
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <Stack spacing={2}>
          {notifications.map((notif) => {
            const isUnread = !notif.isRead;
            const targetLink = getEntityLink(notif);
            const isActionRequired = notif.priority === 'ACTION_REQUIRED';
            const isImportant = notif.priority === 'IMPORTANT';

            // Surface and Border Token Architecture per Section 4 and Section 13
            let cardBg = 'var(--bg-surface)';
            let cardBorder = 'var(--border-default)';
            let leftStripe = '3px solid transparent';
            let priorityBadgeBg = 'var(--accent-info-muted)';
            let priorityBadgeColor = '#38bdf8';
            let priorityBadgeBorder = '1px solid rgba(14, 165, 233, 0.3)';
            let priorityLabel = 'INFO';

            if (isActionRequired) {
              cardBg = isUnread ? 'rgba(244, 63, 94, 0.06)' : 'rgba(244, 63, 94, 0.02)';
              cardBorder = isUnread ? 'rgba(244, 63, 94, 0.35)' : 'rgba(244, 63, 94, 0.20)';
              leftStripe = '3px solid #f43f5e';
              priorityBadgeBg = 'var(--accent-danger-muted)';
              priorityBadgeColor = '#fb7185';
              priorityBadgeBorder = '1px solid rgba(244, 63, 94, 0.4)';
              priorityLabel = 'ACTION REQUIRED';
            } else if (isImportant) {
              cardBg = isUnread ? 'rgba(245, 158, 11, 0.05)' : 'rgba(245, 158, 11, 0.02)';
              cardBorder = isUnread ? 'rgba(245, 158, 11, 0.30)' : 'rgba(245, 158, 11, 0.18)';
              leftStripe = '3px solid #f59e0b';
              priorityBadgeBg = 'var(--accent-warning-muted)';
              priorityBadgeColor = '#fbbf24';
              priorityBadgeBorder = '1px solid rgba(245, 158, 11, 0.35)';
              priorityLabel = 'IMPORTANT';
            } else {
              // INFO
              cardBg = isUnread ? 'rgba(99, 102, 241, 0.03)' : 'var(--bg-surface)';
              cardBorder = isUnread ? 'rgba(99, 102, 241, 0.20)' : 'var(--border-subtle)';
              leftStripe = isUnread ? '3px solid rgba(99, 102, 241, 0.4)' : '3px solid transparent';
            }

            return (
              <Card
                key={notif.id}
                sx={{
                  position: 'relative',
                  backgroundColor: cardBg,
                  border: '1px solid',
                  borderColor: cardBorder,
                  borderLeft: leftStripe,
                  borderRadius: 'var(--radius-md)',
                  boxShadow: isActionRequired && isUnread ? '0 4px 16px rgba(244, 63, 94, 0.12)' : 'var(--shadow-card)',
                  transition: 'all 150ms cubic-bezier(0.4, 0, 0.2, 1)',
                  '&:hover': {
                    borderColor: isActionRequired
                      ? 'rgba(244, 63, 94, 0.5)'
                      : isImportant
                      ? 'rgba(245, 158, 11, 0.45)'
                      : 'var(--border-strong)',
                  },
                }}
              >
                <CardContent sx={{ p: { xs: 2, sm: 2.5 }, '&:last-child': { pb: { xs: 2, sm: 2.5 } } }}>
                  <Stack direction="row" spacing={2} sx={{ alignItems: 'flex-start' }}>
                    {/* Unread Indicator Pulse Dot */}
                    <Box sx={{ pt: 0.6 }}>
                      <Box
                        sx={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          bgcolor: isUnread
                            ? isActionRequired
                              ? 'var(--accent-danger)'
                              : isImportant
                              ? 'var(--accent-warning)'
                              : 'var(--accent-primary)'
                            : 'rgba(255, 255, 255, 0.12)',
                          boxShadow: isUnread
                            ? isActionRequired
                              ? '0 0 8px #f43f5e'
                              : isImportant
                              ? '0 0 8px #f59e0b'
                              : '0 0 8px #6366f1'
                            : 'none',
                        }}
                      />
                    </Box>

                    {/* Main Content Body */}
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      {/* Meta Header Row */}
                      <Stack
                        direction={{ xs: 'column', sm: 'row' }}
                        spacing={1}
                        sx={{
                          justifyContent: 'space-between',
                          alignItems: { xs: 'flex-start', sm: 'center' },
                          mb: 1,
                        }}
                      >
                        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 0.5 }}>
                          {/* Section 13 Priority Pill */}
                          <Box
                            sx={{
                              px: 1,
                              py: 0.2,
                              borderRadius: 'var(--radius-sm)',
                              bgcolor: priorityBadgeBg,
                              color: priorityBadgeColor,
                              border: priorityBadgeBorder,
                              fontSize: '0.625rem',
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              letterSpacing: '0.05em',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 0.4,
                            }}
                          >
                            {isActionRequired && <PriorityHighIcon sx={{ fontSize: '0.75rem' }} />}
                            <span>{priorityLabel}</span>
                          </Box>

                          {/* Section 10 Actor Badge */}
                          {renderActorBadge(notif)}

                          {/* Read/Unread State Label */}
                          <Box
                            sx={{
                              fontSize: '0.6875rem',
                              fontWeight: 600,
                              color: isUnread ? 'var(--text-primary)' : 'var(--text-muted)',
                              letterSpacing: '0.02em',
                              textTransform: 'uppercase',
                            }}
                          >
                            {isUnread ? 'Unread' : 'Read'}
                          </Box>
                        </Stack>

                        {/* Timestamp */}
                        <Typography
                          variant="caption"
                          sx={{
                            color: 'var(--text-muted)',
                            whiteSpace: 'nowrap',
                            fontSize: '0.75rem',
                            fontWeight: 500,
                          }}
                        >
                          {new Date(notif.createdAt).toLocaleString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </Typography>
                      </Stack>

                      {/* Notification Title */}
                      <Typography
                        variant="subtitle1"
                        sx={{
                          fontSize: '0.9375rem',
                          fontWeight: isUnread ? 600 : 500,
                          color: isUnread ? 'var(--text-primary)' : 'var(--text-secondary)',
                          lineHeight: 1.4,
                          letterSpacing: '-0.01em',
                          mb: 0.5,
                        }}
                      >
                        {notif.title}
                      </Typography>

                      {/* Notification Message */}
                      <Typography
                        variant="body2"
                        sx={{
                          fontSize: '0.875rem',
                          lineHeight: 1.55,
                          color: isUnread ? 'var(--text-secondary)' : 'var(--text-muted)',
                          mb: 2,
                        }}
                      >
                        {notif.message}
                      </Typography>

                      {/* Footer Actions & Direct Action Guidance */}
                      <Stack
                        direction={{ xs: 'column', sm: 'row' }}
                        spacing={1.5}
                        sx={{
                          justifyContent: 'space-between',
                          alignItems: { xs: 'flex-start', sm: 'center' },
                          pt: 0.5,
                          borderTop: '1px solid var(--border-subtle)',
                        }}
                      >
                        {/* Genuine Entity Next Step CTA */}
                        {targetLink ? (
                          isActionRequired ? (
                            <Button
                              component={Link}
                              href={targetLink}
                              onClick={() => {
                                if (isUnread) handleMarkAsRead(notif.id);
                              }}
                              size="small"
                              variant="contained"
                              endIcon={<ArrowForwardIcon sx={{ fontSize: '0.875rem' }} />}
                              sx={{
                                bgcolor: 'var(--accent-danger)',
                                color: '#ffffff',
                                fontSize: '0.8125rem',
                                fontWeight: 600,
                                textTransform: 'none',
                                px: 1.75,
                                py: 0.6,
                                borderRadius: 'var(--radius-sm)',
                                boxShadow: '0 2px 8px rgba(244, 63, 94, 0.3)',
                                '&:hover': {
                                  bgcolor: '#e11d48',
                                },
                              }}
                            >
                              {getActionLabel(notif)}
                            </Button>
                          ) : isImportant ? (
                            <Button
                              component={Link}
                              href={targetLink}
                              onClick={() => {
                                if (isUnread) handleMarkAsRead(notif.id);
                              }}
                              size="small"
                              variant="outlined"
                              endIcon={<ArrowForwardIcon sx={{ fontSize: '0.875rem' }} />}
                              sx={{
                                color: '#fbbf24',
                                borderColor: 'rgba(245, 158, 11, 0.4)',
                                bgcolor: 'rgba(245, 158, 11, 0.08)',
                                fontSize: '0.8125rem',
                                fontWeight: 600,
                                textTransform: 'none',
                                px: 1.5,
                                py: 0.5,
                                borderRadius: 'var(--radius-sm)',
                                '&:hover': {
                                  bgcolor: 'rgba(245, 158, 11, 0.16)',
                                  borderColor: '#fbbf24',
                                },
                              }}
                            >
                              {getActionLabel(notif)}
                            </Button>
                          ) : (
                            <Button
                              component={Link}
                              href={targetLink}
                              onClick={() => {
                                if (isUnread) handleMarkAsRead(notif.id);
                              }}
                              size="small"
                              variant="text"
                              endIcon={<ArrowForwardIcon sx={{ fontSize: '0.875rem' }} />}
                              sx={{
                                color: 'var(--accent-primary-light)',
                                fontSize: '0.8125rem',
                                fontWeight: 500,
                                textTransform: 'none',
                                p: 0,
                                '&:hover': {
                                  color: '#ffffff',
                                  bgcolor: 'transparent',
                                },
                              }}
                            >
                              {getActionLabel(notif)}
                            </Button>
                          )
                        ) : notif.entityType ? (
                          <Typography
                            variant="caption"
                            sx={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}
                          >
                            Target Reference: {notif.entityType} ({notif.entityId?.substring(0, 8)})
                          </Typography>
                        ) : (
                          <Box />
                        )}

                        {/* Mark As Read Button */}
                        {isUnread && (
                          <Button
                            onClick={(e) => handleMarkAsRead(notif.id, e)}
                            disabled={markingId === notif.id}
                            size="small"
                            variant="outlined"
                            startIcon={
                              markingId === notif.id ? (
                                <CircularProgress size={12} color="inherit" />
                              ) : (
                                <CheckCircleOutlineIcon sx={{ fontSize: '0.875rem' }} />
                              )
                            }
                            sx={{
                              fontSize: '0.75rem',
                              fontWeight: 500,
                              textTransform: 'none',
                              py: 0.4,
                              px: 1.25,
                              color: 'var(--text-secondary)',
                              borderColor: 'var(--border-default)',
                              borderRadius: 'var(--radius-sm)',
                              bgcolor: 'rgba(255, 255, 255, 0.02)',
                              '&:hover': {
                                bgcolor: 'rgba(255, 255, 255, 0.06)',
                                borderColor: 'var(--border-strong)',
                                color: 'var(--text-primary)',
                              },
                            }}
                          >
                            {markingId === notif.id ? 'Marking...' : 'Mark as Read'}
                          </Button>
                        )}
                      </Stack>
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            );
          })}
        </Stack>
      )}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
          <Pagination
            count={totalPages}
            page={page}
            onChange={handlePageChange}
            shape="rounded"
            sx={{
              '& .MuiPaginationItem-root': {
                color: 'var(--text-secondary)',
                borderRadius: 'var(--radius-sm)',
                borderColor: 'var(--border-default)',
                '&:hover': {
                  bgcolor: 'var(--bg-surface-subtle)',
                },
                '&.Mui-selected': {
                  bgcolor: 'var(--accent-primary)',
                  color: '#ffffff',
                  fontWeight: 600,
                  '&:hover': {
                    bgcolor: 'var(--accent-primary-hover)',
                  },
                },
              },
            }}
          />
        </Box>
      )}
    </Box>
  );
}

