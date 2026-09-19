'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import CircularProgress from '@mui/material/CircularProgress';
import Collapse from '@mui/material/Collapse';
import Tooltip from '@mui/material/Tooltip';
import Paper from '@mui/material/Paper';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import FilterAltIcon from '@mui/icons-material/FilterAlt';
import FilterAltOffIcon from '@mui/icons-material/FilterAltOff';

export interface AuditEventItem {
  id: string;
  userId?: string | null;
  actorType: 'USER' | 'AI' | 'SYSTEM';
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  oldState?: any;
  newState?: any;
  metadata?: any;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: string;
  user?: {
    id: string;
    email: string;
    name: string;
    role: string;
  } | null;
}

interface ActivityTimelineProps {
  initialEvents: AuditEventItem[];
  initialTotal: number;
  initialPage: number;
  initialLimit: number;
}

export function ActivityTimeline({
  initialEvents,
  initialTotal,
  initialPage,
  initialLimit,
}: ActivityTimelineProps) {
  const [events, setEvents] = useState<AuditEventItem[]>(initialEvents);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(initialPage);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Expanded row state (for inspect diff / state payload)
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});

  // Filter States
  const [actorTypeFilter, setActorTypeFilter] = useState<string>('ALL');
  const [entityTypeFilter, setEntityTypeFilter] = useState<string>('ALL');
  const [actionFilter, setActionFilter] = useState<string>('ALL');
  const [startDateFilter, setStartDateFilter] = useState<string>('');
  const [endDateFilter, setEndDateFilter] = useState<string>('');

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const fetchEvents = async (
    targetPage: number,
    actorType: string,
    entityType: string,
    action: string,
    start: string,
    end: string,
  ) => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set('page', String(targetPage));
      params.set('limit', String(initialLimit));
      if (actorType !== 'ALL') params.set('actorType', actorType);
      if (entityType !== 'ALL') params.set('entityType', entityType);
      if (action !== 'ALL') params.set('action', action);
      if (start) params.set('startDate', new Date(start).toISOString());
      if (end) params.set('endDate', new Date(end).toISOString());

      const res = await fetch(`/api/audit-events?${params.toString()}`);
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to fetch audit events');
      } else {
        setEvents(data.items || []);
        setTotal(data.total || 0);
        setPage(data.page || targetPage);
      }
    } catch (err: any) {
      setError(err.message || 'Network error fetching audit events');
    } finally {
      setLoading(false);
    }
  };

  const handleApplyFilter = () => {
    fetchEvents(1, actorTypeFilter, entityTypeFilter, actionFilter, startDateFilter, endDateFilter);
  };

  const handleResetFilter = () => {
    setActorTypeFilter('ALL');
    setEntityTypeFilter('ALL');
    setActionFilter('ALL');
    setStartDateFilter('');
    setEndDateFilter('');
    fetchEvents(1, 'ALL', 'ALL', 'ALL', '', '');
  };

  /**
   * Reusable humanizer for action enum strings.
   */
  const formatAction = (act: string): string => {
    return act
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  /**
   * Reuses the entity-to-route mapping logic established across the dashboard.
   * CRITICAL: Extracts leadId from metadata/state for HUMAN_REVIEW and OUTREACH_DRAFT.
   */
  const getEntityLink = (item: AuditEventItem): string | null => {
    if (!item.entityType) return null;

    if (item.entityType === 'LEAD' && item.entityId) {
      return `/leads/${item.entityId}`;
    }

    if (item.entityType === 'HUMAN_REVIEW') {
      const leadId = item.metadata?.leadId || item.newState?.leadId || item.oldState?.leadId;
      return leadId ? `/leads/${leadId}` : null;
    }

    if (item.entityType === 'OUTREACH_DRAFT') {
      const leadId = item.metadata?.leadId || item.newState?.leadId || item.oldState?.leadId;
      return leadId ? `/leads/${leadId}` : null;
    }

    if (item.entityType === 'COMPANY' && item.entityId) {
      return `/companies/${item.entityId}`;
    }

    if (item.entityType === 'CONVERSATION' && item.entityId) {
      return `/conversations/${item.entityId}`;
    }

    return null;
  };

  // Render Section 10 Actor Type Badges with consistent iconography
  const renderActorBadge = (actorType: 'USER' | 'AI' | 'SYSTEM', userEmail?: string | null) => {
    if (actorType === 'AI') {
      return (
        <Tooltip title="Autonomous AI Sales Agent Orchestrator" arrow>
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.6,
              px: 0.85,
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
        <Tooltip title={`Human Sales Representative (${userEmail || 'Operator'})`} arrow>
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.6,
              px: 0.85,
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
      <Tooltip title="Automated System Engine / Background Job" arrow>
        <Box
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.6,
            px: 0.85,
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

  // Determine border accent color based on action significance (Section 4 & Section 1)
  const getActionBorderColor = (action: string) => {
    if (action.includes('BLOCKED') || action.includes('RESTRICTION') || action.includes('ERROR')) {
      return 'var(--accent-danger)';
    }
    if (action.includes('REVIEW_CREATED') || action.includes('PAUSED')) {
      return 'var(--accent-warning)';
    }
    if (action.includes('SENT') || action.includes('RESOLVED') || action.includes('RESUMED') || action.includes('QUALIFIED')) {
      return 'var(--accent-success)';
    }
    return 'var(--accent-primary)';
  };

  const totalPages = Math.ceil(total / initialLimit) || 1;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Search & Filter Header Card */}
      <Card
        sx={{
          bgcolor: 'var(--bg-surface)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-md)',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        <CardContent sx={{ p: 3, '&:last-child': { pb: 3 } }}>
          <Stack spacing={2.5}>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              <FilterAltIcon sx={{ fontSize: 20, color: 'var(--accent-primary-light)' }} />
              <Typography variant="subtitle2" fontWeight={700} sx={{ color: 'var(--text-primary)' }}>
                Audit Stream Filters
              </Typography>
            </Stack>

            <Grid container spacing={2}>
              {/* Actor Type */}
              <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
                <FormControl fullWidth size="small">
                  <InputLabel id="actor-type-label">Actor Type</InputLabel>
                  <Select
                    labelId="actor-type-label"
                    value={actorTypeFilter}
                    label="Actor Type"
                    onChange={(e) => setActorTypeFilter(e.target.value)}
                  >
                    <MenuItem value="ALL">All Actors</MenuItem>
                    <MenuItem value="USER">User (Human)</MenuItem>
                    <MenuItem value="AI">AI Agent</MenuItem>
                    <MenuItem value="SYSTEM">System</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              {/* Entity Type */}
              <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
                <FormControl fullWidth size="small">
                  <InputLabel id="entity-type-label">Entity Type</InputLabel>
                  <Select
                    labelId="entity-type-label"
                    value={entityTypeFilter}
                    label="Entity Type"
                    onChange={(e) => setEntityTypeFilter(e.target.value)}
                  >
                    <MenuItem value="ALL">All Entities</MenuItem>
                    <MenuItem value="LEAD">Lead</MenuItem>
                    <MenuItem value="HUMAN_REVIEW">Human Review</MenuItem>
                    <MenuItem value="OUTREACH_DRAFT">Outreach Draft</MenuItem>
                    <MenuItem value="COMPANY">Company</MenuItem>
                    <MenuItem value="CONVERSATION">Conversation</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              {/* Action */}
              <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
                <FormControl fullWidth size="small">
                  <InputLabel id="action-label">Action</InputLabel>
                  <Select
                    labelId="action-label"
                    value={actionFilter}
                    label="Action"
                    onChange={(e) => setActionFilter(e.target.value)}
                  >
                    <MenuItem value="ALL">All Actions</MenuItem>
                    <MenuItem value="OUTREACH_EMAIL_SENT">Outreach Email Sent</MenuItem>
                    <MenuItem value="LEAD_RESTRICTION_BLOCKED">Lead Restriction Blocked</MenuItem>
                    <MenuItem value="HUMAN_REVIEW_CREATED">Human Review Created</MenuItem>
                    <MenuItem value="HUMAN_REVIEW_RESOLVED">Human Review Resolved</MenuItem>
                    <MenuItem value="LEAD_AI_PAUSED">Lead AI Paused</MenuItem>
                    <MenuItem value="LEAD_AI_RESUMED">Lead AI Resumed</MenuItem>
                    <MenuItem value="LEAD_AI_TAKEN_OVER">Lead AI Taken Over</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              {/* Start Date */}
              <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
                <TextField
                  fullWidth
                  size="small"
                  label="From Date"
                  type="date"
                  value={startDateFilter}
                  onChange={(e: any) => setStartDateFilter(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>

              {/* End Date */}
              <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
                <TextField
                  fullWidth
                  size="small"
                  label="To Date"
                  type="date"
                  value={endDateFilter}
                  onChange={(e: any) => setEndDateFilter(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
            </Grid>

            {/* Filter Action Buttons */}
            <Stack direction="row" spacing={1.5} sx={{ justifyContent: 'flex-end' }}>
              <Button
                onClick={handleResetFilter}
                variant="outlined"
                className="btn-secondary"
                size="small"
                startIcon={<FilterAltOffIcon sx={{ fontSize: 16 }} />}
                sx={{ textTransform: 'none' }}
              >
                Reset Filters
              </Button>
              <Button
                onClick={handleApplyFilter}
                variant="contained"
                className="btn-primary"
                size="small"
                startIcon={<FilterAltIcon sx={{ fontSize: 16 }} />}
                sx={{ textTransform: 'none', px: 2 }}
              >
                Apply Filters
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      {/* Error Message */}
      {error && (
        <Card sx={{ bgcolor: 'var(--accent-danger-muted)', border: '1px solid rgba(244, 63, 94, 0.3)' }}>
          <CardContent sx={{ p: 2 }}>
            <Typography variant="body2" sx={{ color: '#fb7185' }}>
              {error}
            </Typography>
          </CardContent>
        </Card>
      )}

      {/* Audit Timeline / List Display */}
      {loading ? (
        <Box sx={{ py: 10, textAlign: 'center' }}>
          <CircularProgress size={32} sx={{ color: 'var(--accent-primary-light)' }} />
          <Typography variant="body2" sx={{ color: 'var(--text-secondary)', mt: 2 }}>
            Filtering audit event stream...
          </Typography>
        </Box>
      ) : events.length === 0 ? (
        <Card
          sx={{
            bgcolor: 'var(--bg-surface)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <CardContent sx={{ p: 8, textAlign: 'center' }}>
            <Typography variant="h3" sx={{ color: 'var(--text-primary)', mb: 1 }}>
              No audit events found
            </Typography>
            <Typography variant="body2" sx={{ color: 'var(--text-secondary)' }}>
              No matching records in the immutable audit log for the specified filter criteria.
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <Stack spacing={2}>
          {events.map((evt) => {
            const isExpanded = !!expandedIds[evt.id];
            const entityLink = getEntityLink(evt);
            const borderAccent = getActionBorderColor(evt.action);

            const actorLabel =
              evt.actorType === 'USER'
                ? evt.user?.email || evt.user?.name || 'Authenticated User'
                : evt.actorType === 'AI'
                  ? 'AI Agent Orchestrator'
                  : 'System Engine';

            const hasPayload =
              evt.oldState ||
              evt.newState ||
              (evt.metadata && Object.keys(evt.metadata).length > 0);

            return (
              <Card
                key={evt.id}
                sx={{
                  bgcolor: 'var(--bg-surface)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-md)',
                  boxShadow: 'var(--shadow-card)',
                  borderLeft: `3px solid ${borderAccent}`,
                  transition: 'var(--transition-default)',
                  '&:hover': {
                    bgcolor: 'var(--bg-surface-hover)',
                  },
                }}
              >
                <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
                  <Stack spacing={1.5}>
                    {/* Event Header Row */}
                    <Stack
                      direction={{ xs: 'column', sm: 'row' }}
                      spacing={1}
                      sx={{
                        justifyContent: 'space-between',
                        alignItems: { xs: 'flex-start', sm: 'center' },
                      }}
                    >
                      {/* Left: Actor Badge + Humanized Action */}
                      <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                        {renderActorBadge(evt.actorType, evt.user?.email)}
                        <Typography variant="subtitle1" fontWeight={700} sx={{ color: 'var(--text-primary)' }}>
                          {formatAction(evt.action)}
                        </Typography>
                        <Chip
                          size="small"
                          label={evt.entityType.replace(/_/g, ' ')}
                          sx={{
                            height: 20,
                            fontSize: '0.625rem',
                            fontWeight: 600,
                            bgcolor: 'var(--bg-surface-subtle)',
                            border: '1px solid var(--border-subtle)',
                            color: 'var(--text-secondary)',
                            textTransform: 'uppercase',
                          }}
                        />
                      </Stack>

                      {/* Right: Timestamp */}
                      <Typography variant="caption" sx={{ color: 'var(--text-muted)' }} whiteSpace="nowrap">
                        {new Date(evt.createdAt).toLocaleString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </Typography>
                    </Stack>

                    {/* Actor Details & Entity Navigation */}
                    <Stack
                      direction={{ xs: 'column', sm: 'row' }}
                      spacing={1}
                      sx={{
                        justifyContent: 'space-between',
                        alignItems: { xs: 'flex-start', sm: 'center' },
                      }}
                    >
                      <Typography variant="body2" sx={{ color: 'var(--text-secondary)' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Initiator:</span> <strong>{actorLabel}</strong>
                        {evt.ipAddress && (
                          <span style={{ marginLeft: 8, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            ({evt.ipAddress})
                          </span>
                        )}
                      </Typography>

                      {/* Entity Link */}
                      {entityLink ? (
                        <Button
                          component={Link}
                          href={entityLink}
                          size="small"
                          variant="text"
                          endIcon={<OpenInNewIcon sx={{ fontSize: '0.875rem' }} />}
                          sx={{
                            p: 0,
                            fontWeight: 600,
                            textTransform: 'none',
                            color: 'var(--accent-primary-light)',
                            '&:hover': { color: 'var(--accent-info)', bgcolor: 'transparent' },
                          }}
                        >
                          Target Entity: {evt.entityType.replace('_', ' ')} (
                          {evt.entityId ? evt.entityId.substring(0, 8) : 'linked'}) →
                        </Button>
                      ) : (
                        <Typography variant="caption" sx={{ color: 'var(--text-muted)' }}>
                          Target: {evt.entityType} ({evt.entityId ? evt.entityId.substring(0, 8) : 'N/A'})
                        </Typography>
                      )}
                    </Stack>

                    {/* Expandable State Changes / Diff Summary */}
                    {hasPayload && (
                      <Box>
                        <Button
                          onClick={() => toggleExpand(evt.id)}
                          size="small"
                          variant="text"
                          endIcon={
                            isExpanded ? (
                              <KeyboardArrowUpIcon sx={{ fontSize: '1rem' }} />
                            ) : (
                              <KeyboardArrowDownIcon sx={{ fontSize: '1rem' }} />
                            )
                          }
                          sx={{
                            p: 0,
                            color: 'var(--text-secondary)',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            textTransform: 'none',
                            '&:hover': { color: 'var(--text-primary)', bgcolor: 'transparent' },
                          }}
                        >
                          {isExpanded ? 'Hide Details & State Payloads' : 'Inspect Audit Details & Diff'}
                        </Button>

                        <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                          <Paper
                            variant="outlined"
                            sx={{
                              mt: 1.5,
                              p: 2,
                              bgcolor: 'var(--bg-surface-subtle)',
                              borderColor: 'var(--border-subtle)',
                              borderRadius: 'var(--radius-sm)',
                            }}
                          >
                            <Grid container spacing={2}>
                              {evt.oldState && (
                                <Grid size={{ xs: 12, md: evt.newState ? 6 : 12 }}>
                                  <Typography
                                    variant="caption"
                                    sx={{
                                      color: '#fb7185',
                                      fontWeight: 700,
                                      display: 'block',
                                      mb: 0.5,
                                      textTransform: 'uppercase',
                                      letterSpacing: '0.04em',
                                    }}
                                  >
                                    PREVIOUS STATE
                                  </Typography>
                                  <Box
                                    component="pre"
                                    sx={{
                                      m: 0,
                                      p: 1.5,
                                      bgcolor: 'var(--accent-danger-muted)',
                                      borderRadius: 'var(--radius-sm)',
                                      border: '1px solid rgba(244, 63, 94, 0.2)',
                                      fontSize: '0.75rem',
                                      overflowX: 'auto',
                                      fontFamily: 'monospace',
                                      color: 'var(--text-primary)',
                                    }}
                                  >
                                    {JSON.stringify(evt.oldState, null, 2)}
                                  </Box>
                                </Grid>
                              )}

                              {evt.newState && (
                                <Grid size={{ xs: 12, md: evt.oldState ? 6 : 12 }}>
                                  <Typography
                                    variant="caption"
                                    sx={{
                                      color: '#34d399',
                                      fontWeight: 700,
                                      display: 'block',
                                      mb: 0.5,
                                      textTransform: 'uppercase',
                                      letterSpacing: '0.04em',
                                    }}
                                  >
                                    NEW STATE
                                  </Typography>
                                  <Box
                                    component="pre"
                                    sx={{
                                      m: 0,
                                      p: 1.5,
                                      bgcolor: 'var(--accent-success-muted)',
                                      borderRadius: 'var(--radius-sm)',
                                      border: '1px solid rgba(16, 185, 129, 0.2)',
                                      fontSize: '0.75rem',
                                      overflowX: 'auto',
                                      fontFamily: 'monospace',
                                      color: 'var(--text-primary)',
                                    }}
                                  >
                                    {JSON.stringify(evt.newState, null, 2)}
                                  </Box>
                                </Grid>
                              )}

                              {evt.metadata && Object.keys(evt.metadata).length > 0 && (
                                <Grid size={12}>
                                  <Typography
                                    variant="caption"
                                    sx={{
                                      color: '#38bdf8',
                                      fontWeight: 700,
                                      display: 'block',
                                      mb: 0.5,
                                      textTransform: 'uppercase',
                                      letterSpacing: '0.04em',
                                    }}
                                  >
                                    EVENT METADATA & CONTEXT
                                  </Typography>
                                  <Box
                                    component="pre"
                                    sx={{
                                      m: 0,
                                      p: 1.5,
                                      bgcolor: 'var(--accent-info-muted)',
                                      borderRadius: 'var(--radius-sm)',
                                      border: '1px solid rgba(14, 165, 233, 0.2)',
                                      fontSize: '0.75rem',
                                      overflowX: 'auto',
                                      fontFamily: 'monospace',
                                      color: 'var(--text-primary)',
                                    }}
                                  >
                                    {JSON.stringify(evt.metadata, null, 2)}
                                  </Box>
                                </Grid>
                              )}
                            </Grid>
                          </Paper>
                        </Collapse>
                      </Box>
                    )}
                  </Stack>
                </CardContent>
              </Card>
            );
          })}
        </Stack>
      )}

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <Card
          sx={{
            p: 2,
            px: 3,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            bgcolor: 'var(--bg-surface)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-md)',
          }}
        >
          <Typography variant="body2" sx={{ color: 'var(--text-secondary)' }}>
            Page <strong>{page}</strong> of <strong>{totalPages}</strong> ({total} total audit records)
          </Typography>

          <Stack direction="row" spacing={1}>
            <Button
              disabled={page <= 1 || loading}
              onClick={() => {
                const prev = page - 1;
                setPage(prev);
                fetchEvents(prev, actorTypeFilter, entityTypeFilter, actionFilter, startDateFilter, endDateFilter);
              }}
              variant="outlined"
              size="small"
              className="btn-secondary"
              sx={{ textTransform: 'none' }}
            >
              Previous
            </Button>
            <Button
              disabled={page >= totalPages || loading}
              onClick={() => {
                const next = page + 1;
                setPage(next);
                fetchEvents(next, actorTypeFilter, entityTypeFilter, actionFilter, startDateFilter, endDateFilter);
              }}
              variant="outlined"
              size="small"
              className="btn-secondary"
              sx={{ textTransform: 'none' }}
            >
              Next
            </Button>
          </Stack>
        </Card>
      )}
    </Box>
  );
}

