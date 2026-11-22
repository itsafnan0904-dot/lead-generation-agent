import React from 'react';
import Link from 'next/link';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Typography from '@mui/material/Typography';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Stack from '@mui/material/Stack';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import { Header } from '@/components/header';
import { serverApiFetch } from '@/lib/server-api-client';
import { SyncInboxButton } from './sync-button';
import { StatusDot } from '@/components/ui';
import { LeadStatus } from '@/components/ui';

interface MessageSummary {
  id: string;
  sender: string;
  recipient: string;
  subject?: string | null;
  bodyText: string;
  direction: 'INBOUND' | 'OUTBOUND';
  sentAt: string;
  metadata?: any;
}

interface ConversationItem {
  id: string;
  leadId?: string | null;
  gmailThreadId?: string | null;
  subject?: string | null;
  lastMessageAt?: string | null;
  metadata?: any;
  createdAt: string;
  updatedAt: string;
  lead?: {
    id: string;
    status: string;
    scoreTotal: number;
    aiControlState?: string;
    company: {
      id: string;
      name: string;
      domain?: string | null;
    };
    primaryContact?: {
      firstName: string;
      lastName?: string | null;
      email: string;
    } | null;
  } | null;
  messages: MessageSummary[];
}

interface ConversationsResponse {
  items: ConversationItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export default async function ConversationsListPage({
  searchParams,
}: {
  searchParams: { page?: string; limit?: string; status?: 'ASSIGNED' | 'UNASSIGNED' };
}) {
  const page = parseInt(searchParams.page || '1', 10);
  const limit = parseInt(searchParams.limit || '10', 10);
  const statusFilter = searchParams.status || '';

  const queryParams = new URLSearchParams();
  queryParams.set('page', page.toString());
  queryParams.set('limit', limit.toString());
  if (statusFilter) {
    queryParams.set('status', statusFilter);
  }

  const { data } = await serverApiFetch<ConversationsResponse>(`/conversations?${queryParams.toString()}`);

  const items = data?.items || [];
  const total = data?.total || 0;
  const totalPages = data?.totalPages || 1;

  // Render Section 10 AI Operating State Indicator
  const renderAiStateIndicator = (controlState?: string, leadStatus?: string) => {
    if (leadStatus === 'HUMAN_REVIEW') {
      return (
        <Tooltip title="Human review required before outbound transmission" arrow>
          <StatusDot tone="paused">Needs review</StatusDot>
        </Tooltip>
      );
    }

    if (controlState === 'PAUSED') {
      return (
        <Tooltip title="AI autonomous agent is paused by operator" arrow>
          <StatusDot tone="paused">AI paused</StatusDot>
        </Tooltip>
      );
    }

    if (controlState === 'TAKEN_OVER') {
      return (
        <Tooltip title="Thread taken over by human sales representative" arrow>
          <StatusDot tone="turn">Human handling</StatusDot>
        </Tooltip>
      );
    }

    if (controlState === 'AI_ACTIVE' || (!controlState && leadStatus)) {
      return (
        <Tooltip title="AI autonomous agent is actively handling this thread" arrow>
          <StatusDot tone="active">AI active</StatusDot>
        </Tooltip>
      );
    }

    return (
      <Box
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          px: 0.85,
          py: 0.25,
          borderRadius: 'var(--radius-sm)',
          bgcolor: 'var(--bg-surface-subtle)',
          border: '1px solid var(--border-subtle)',
          color: 'var(--text-muted)',
          fontSize: '0.75rem',
          fontWeight: 500,
        }}
      >
        <span>Unassigned</span>
      </Box>
    );
  };

  // Render lead lifecycle stage badge
  const renderLeadStatusBadge = (status?: string) => <LeadStatus status={status} />;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      <Header title="Conversations" />

      <Box
        component="main"
        sx={{
          p: { xs: 2, sm: 3, md: 4 },
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          maxWidth: 1400,
          width: '100%',
          mx: 'auto',
        }}
      >
        {/* Top Control Bar: Heading, Tabs Filter, and Sync Button */}
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          sx={{
            justifyContent: 'space-between',
            alignItems: { xs: 'flex-start', sm: 'flex-start' },
          }}
        >
          <Box>
            <Typography variant="h2" sx={{ color: 'var(--text-primary)', mb: 0.5 }}>
              Email conversations and replies
            </Typography>
            <Typography variant="body2" sx={{ color: 'var(--text-secondary)', mb: 2 }}>
              Showing {items.length} of {total} synchronized omnichannel threads across active sales pipelines
            </Typography>

            {/* Filter Tabs using standard design system button toggles */}
            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
              <Button
                component={Link}
                href="/conversations"
                size="small"
                variant={!statusFilter ? 'contained' : 'outlined'}
                sx={{
                  textTransform: 'none',
                  fontSize: '0.8125rem',
                  fontWeight: 500,
                  bgcolor: !statusFilter ? 'var(--accent-primary)' : 'var(--bg-surface-subtle)',
                  color: !statusFilter ? '#ffffff' : 'var(--text-secondary)',
                  borderColor: !statusFilter ? 'transparent' : 'var(--border-default)',
                  '&:hover': {
                    bgcolor: !statusFilter ? 'var(--accent-primary-hover)' : 'var(--bg-surface-hover)',
                    borderColor: 'var(--border-strong)',
                  },
                }}
              >
                All Threads ({total})
              </Button>

              <Button
                component={Link}
                href="/conversations?status=ASSIGNED"
                size="small"
                variant={statusFilter === 'ASSIGNED' ? 'contained' : 'outlined'}
                sx={{
                  textTransform: 'none',
                  fontSize: '0.8125rem',
                  fontWeight: 500,
                  bgcolor: statusFilter === 'ASSIGNED' ? 'var(--accent-primary)' : 'var(--bg-surface-subtle)',
                  color: statusFilter === 'ASSIGNED' ? '#ffffff' : 'var(--text-secondary)',
                  borderColor: statusFilter === 'ASSIGNED' ? 'transparent' : 'var(--border-default)',
                  '&:hover': {
                    bgcolor: statusFilter === 'ASSIGNED' ? 'var(--accent-primary-hover)' : 'var(--bg-surface-hover)',
                    borderColor: 'var(--border-strong)',
                  },
                }}
              >
                Assigned
              </Button>

              <Button
                component={Link}
                href="/conversations?status=UNASSIGNED"
                size="small"
                variant={statusFilter === 'UNASSIGNED' ? 'contained' : 'outlined'}
                sx={{
                  textTransform: 'none',
                  fontSize: '0.8125rem',
                  fontWeight: 500,
                  bgcolor: statusFilter === 'UNASSIGNED' ? 'var(--accent-warning)' : 'var(--bg-surface-subtle)',
                  color: statusFilter === 'UNASSIGNED' ? '#000000' : '#e3a94d',
                  borderColor: statusFilter === 'UNASSIGNED' ? 'transparent' : 'rgba(237, 237, 237, 0.09)',
                  '&:hover': {
                    bgcolor: statusFilter === 'UNASSIGNED' ? '#c48c32' : 'rgba(227, 169, 77, 0.1)',
                    borderColor: '#e3a94d',
                  },
                }}
              >
                Needs a lead
              </Button>
            </Stack>
          </Box>

          {/* Sync Inbox Button */}
          <SyncInboxButton />
        </Stack>

        {/* Conversations Data Table */}
        <Card
          sx={{
            overflow: 'hidden',
            bgcolor: 'var(--bg-surface)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'none',
          }}
        >
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: 'var(--bg-surface-subtle)' }}>
                  <TableCell sx={{ color: 'var(--text-secondary)', fontWeight: 500, fontSize: '0.75rem', borderBottom: '1px solid var(--border-subtle)' }}>
                    Account / Prospect
                  </TableCell>
                  <TableCell sx={{ color: 'var(--text-secondary)', fontWeight: 500, fontSize: '0.75rem', borderBottom: '1px solid var(--border-subtle)' }}>
                    AI Operating State
                  </TableCell>
                  <TableCell sx={{ color: 'var(--text-secondary)', fontWeight: 500, fontSize: '0.75rem', borderBottom: '1px solid var(--border-subtle)' }}>
                    Lifecycle stage
                  </TableCell>
                  <TableCell sx={{ color: 'var(--text-secondary)', fontWeight: 500, fontSize: '0.75rem', borderBottom: '1px solid var(--border-subtle)' }}>
                    Latest Message / Subject
                  </TableCell>
                  <TableCell sx={{ color: 'var(--text-secondary)', fontWeight: 500, fontSize: '0.75rem', borderBottom: '1px solid var(--border-subtle)' }}>
                    Messages
                  </TableCell>
                  <TableCell sx={{ color: 'var(--text-secondary)', fontWeight: 500, fontSize: '0.75rem', borderBottom: '1px solid var(--border-subtle)' }}>
                    Last activity
                  </TableCell>
                  <TableCell align="right" sx={{ color: 'var(--text-secondary)', fontWeight: 500, fontSize: '0.75rem', borderBottom: '1px solid var(--border-subtle)' }}>
                    Action
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} sx={{ textAlign: 'center', py: 8, color: 'var(--text-muted)' }}>
                      <Typography variant="body2">No conversations found matching this view.</Typography>
                      <Typography variant="caption" sx={{ color: 'var(--text-muted)', mt: 0.5, display: 'block' }}>
                        Click &quot;Sync Inbox Now&quot; above to fetch new email threads from connected Gmail accounts.
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((conv) => {
                    const isUnassigned = !conv.leadId;
                    const latestMsg = conv.messages?.[conv.messages.length - 1];
                    const msgSnippet = latestMsg?.metadata?.snippet || latestMsg?.bodyText || 'No message content';
                    const isInbound = latestMsg?.direction === 'INBOUND';

                    return (
                      <TableRow
                        key={conv.id}
                        sx={{
                          borderBottom: '1px solid var(--border-subtle)',
                          transition: 'var(--transition-default)',
                          '&:hover': {
                            bgcolor: 'var(--bg-surface-hover) !important',
                          },
                        }}
                      >
                        <TableCell>
                          <Link
                            href={`/conversations/${conv.id}`}
                            style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
                          >
                            {conv.lead?.company ? (
                              <>
                                <Typography variant="body2" fontWeight={600} sx={{ color: 'var(--text-primary)' }}>
                                  {conv.lead.company.name}
                                </Typography>
                                {conv.lead.primaryContact ? (
                                  <Typography variant="caption" sx={{ color: 'var(--accent-info)' }}>
                                    {conv.lead.primaryContact.firstName} {conv.lead.primaryContact.lastName || ''} ({conv.lead.primaryContact.email})
                                  </Typography>
                                ) : (
                                  <Typography variant="caption" sx={{ color: 'var(--text-muted)' }}>
                                    No contact assigned
                                  </Typography>
                                )}
                              </>
                            ) : (
                              <>
                                <Typography variant="body2" fontWeight={600} sx={{ color: '#e3a94d' }}>
                                  No lead assigned
                                </Typography>
                                <Typography variant="caption" sx={{ color: 'var(--text-muted)' }}>
                                  {conv.metadata?.senderEmail || latestMsg?.sender || 'Unknown Sender'}
                                </Typography>
                              </>
                            )}
                          </Link>
                        </TableCell>

                        <TableCell>
                          <Link
                            href={`/conversations/${conv.id}`}
                            style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
                          >
                            {renderAiStateIndicator(conv.lead?.aiControlState, conv.lead?.status)}
                          </Link>
                        </TableCell>

                        <TableCell>
                          <Link
                            href={`/conversations/${conv.id}`}
                            style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
                          >
                            {isUnassigned ? (
                              <Chip
                                size="small"
                                label="Needs a lead"
                                sx={{
                                  bgcolor: 'var(--accent-warning-muted)',
                                  border: '1px solid rgba(237, 237, 237, 0.09)',
                                  color: '#e3a94d',
                                  fontWeight: 600,
                                  fontSize: '0.75rem',
                                }}
                              />
                            ) : (
                              renderLeadStatusBadge(conv.lead?.status)
                            )}
                          </Link>
                        </TableCell>

                        <TableCell sx={{ maxWidth: 360 }}>
                          <Link
                            href={`/conversations/${conv.id}`}
                            style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
                          >
                            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 0.25 }}>
                              {latestMsg && (
                                <Chip
                                  size="small"
                                  label={isInbound ? 'Inbound' : 'Outbound'}
                                  sx={{
                                    height: 18,
                                    fontSize: '0.5625rem',
                                    fontWeight: 600,
                                    bgcolor: isInbound ? 'var(--accent-info-muted)' : 'var(--accent-success-muted)',
                                    color: isInbound ? '#86a9f2' : '#4cc38a',
                                    border: isInbound ? '1px solid rgba(237, 237, 237, 0.09)' : '1px solid rgba(237, 237, 237, 0.09)',
                                  }}
                                />
                              )}
                              <Typography variant="body2" fontWeight={600} sx={{ color: 'var(--text-primary)' }} noWrap>
                                {conv.subject || '(No Subject)'}
                              </Typography>
                            </Stack>
                            <Typography variant="caption" sx={{ color: 'var(--text-secondary)' }} noWrap display="block">
                              {msgSnippet}
                            </Typography>
                          </Link>
                        </TableCell>

                        <TableCell>
                          <Link
                            href={`/conversations/${conv.id}`}
                            style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
                          >
                            <Chip
                              size="small"
                              label={`${conv.messages?.length || 0} msg${conv.messages?.length === 1 ? '' : 's'}`}
                              sx={{
                                bgcolor: 'var(--bg-surface-subtle)',
                                border: '1px solid var(--border-subtle)',
                                color: 'var(--text-secondary)',
                                fontSize: '0.75rem',
                              }}
                            />
                          </Link>
                        </TableCell>

                        <TableCell>
                          <Link
                            href={`/conversations/${conv.id}`}
                            style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
                          >
                            <Typography variant="body2" sx={{ color: 'var(--text-secondary)' }}>
                              {conv.lastMessageAt
                                ? new Date(conv.lastMessageAt).toLocaleString(undefined, {
                                    month: 'short',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })
                                : '—'}
                            </Typography>
                          </Link>
                        </TableCell>

                        <TableCell align="right">
                          <Button
                            component={Link}
                            href={`/conversations/${conv.id}`}
                            size="small"
                            variant="text"
                            sx={{
                              color: 'var(--accent-primary-light)',
                              textTransform: 'none',
                              fontSize: '0.8125rem',
                              fontWeight: 500,
                              p: '4px 8px',
                            }}
                          >
                            Open thread
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>

          {/* Pagination Footer */}
          {totalPages > 1 && (
            <Box
              sx={{
                p: 2,
                px: 3,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderTop: '1px solid var(--border-subtle)',
                bgcolor: 'var(--bg-surface-subtle)',
              }}
            >
              <Typography variant="body2" sx={{ color: 'var(--text-secondary)' }}>
                Page <strong>{page}</strong> of <strong>{totalPages}</strong> ({total} total conversations)
              </Typography>

              <Stack direction="row" spacing={1}>
                {page > 1 ? (
                  <Button
                    component={Link}
                    href={`/conversations?page=${page - 1}&limit=${limit}${statusFilter ? `&status=${statusFilter}` : ''}`}
                    variant="outlined"
                    size="small"
                    className="btn-secondary"
                    sx={{ textTransform: 'none' }}
                  >
                    Previous
                  </Button>
                ) : (
                  <Button disabled variant="outlined" size="small" className="btn-secondary" sx={{ textTransform: 'none' }}>
                    Previous
                  </Button>
                )}

                {page < totalPages ? (
                  <Button
                    component={Link}
                    href={`/conversations?page=${page + 1}&limit=${limit}${statusFilter ? `&status=${statusFilter}` : ''}`}
                    variant="outlined"
                    size="small"
                    className="btn-secondary"
                    sx={{ textTransform: 'none' }}
                  >
                    Next
                  </Button>
                ) : (
                  <Button disabled variant="outlined" size="small" className="btn-secondary" sx={{ textTransform: 'none' }}>
                    Next
                  </Button>
                )}
              </Stack>
            </Box>
          )}
        </Card>
      </Box>
    </Box>
  );
}

