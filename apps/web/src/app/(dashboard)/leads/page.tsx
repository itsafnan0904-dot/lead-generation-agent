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
import Button from '@mui/material/Button';
import FormControl from '@mui/material/FormControl';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Tooltip from '@mui/material/Tooltip';
import Chip from '@mui/material/Chip';
import { Header } from '@/components/header';
import { serverApiFetch } from '@/lib/server-api-client';

interface LeadItem {
  id: string;
  status: string;
  scoreTotal: number;
  createdAt: string;
  company: {
    id: string;
    name: string;
    domain?: string;
    industry?: string;
  };
  primaryContact?: {
    id: string;
    firstName: string;
    lastName?: string;
    email: string;
  } | null;
  assignedUser?: {
    id: string;
    name: string;
    email: string;
  } | null;
}

interface LeadsResponse {
  items: LeadItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const ALL_LIFECYCLE_STATUSES = [
  'COLD_LEAD',
  'CONTACTED',
  'RESPONDED',
  'INTERESTED',
  'GATHERING_REQUIREMENTS',
  'QUALIFIED',
  'DEAL_DISCUSSION',
  'WON',
  'LOST',
  'WAITING_FOR_CLIENT',
  'FOLLOW_UP_REQUIRED',
  'HUMAN_REVIEW',
  'RESTRICTED',
  'DISQUALIFIED',
];

interface FilterPreset {
  id: string;
  label: string;
  description: string;
  statuses: string[];
  href: string;
  accentColor?: string;
  badgeBg?: string;
}

const PRESETS: FilterPreset[] = [
  {
    id: 'all',
    label: 'All Leads',
    description: 'Complete directory across all lifecycle stages',
    statuses: [],
    href: '/leads',
  },
  {
    id: 'opportunities',
    label: 'Opportunities',
    description: 'Qualified leads, active deal discussions & won clients',
    statuses: ['QUALIFIED', 'DEAL_DISCUSSION', 'WON'],
    href: '/leads?preset=opportunities',
    accentColor: '#34d399',
    badgeBg: 'rgba(16, 185, 129, 0.12)',
  },
  {
    id: 'human_review',
    label: 'Human Review',
    description: 'Flagged by AI safety checks or policy restrictions',
    statuses: ['HUMAN_REVIEW', 'RESTRICTED'],
    href: '/leads?preset=human_review',
    accentColor: '#fbbf24',
    badgeBg: 'rgba(245, 158, 11, 0.12)',
  },
  {
    id: 'won',
    label: 'Won',
    description: 'Successfully converted clients',
    statuses: ['WON'],
    href: '/leads?preset=won&status=WON',
    accentColor: '#38bdf8',
    badgeBg: 'rgba(56, 189, 248, 0.12)',
  },
  {
    id: 'lost',
    label: 'Lost',
    description: 'Disqualified or closed-lost leads',
    statuses: ['LOST'],
    href: '/leads?preset=lost&status=LOST',
    accentColor: '#fb7185',
    badgeBg: 'rgba(244, 63, 94, 0.12)',
  },
];

export default async function LeadsListPage({
  searchParams,
}: {
  searchParams: { page?: string; limit?: string; status?: string; preset?: string };
}) {
  const page = parseInt(searchParams.page || '1', 10);
  const limit = parseInt(searchParams.limit || '10', 10);
  const statusFilter = searchParams.status || '';
  const presetParam = searchParams.preset || '';

  // Determine active preset
  let activePresetId = 'all';
  if (presetParam === 'opportunities' || (!presetParam && (statusFilter === 'QUALIFIED' || statusFilter === 'DEAL_DISCUSSION'))) {
    activePresetId = 'opportunities';
  } else if (presetParam === 'human_review' || (!presetParam && (statusFilter === 'HUMAN_REVIEW' || statusFilter === 'RESTRICTED'))) {
    activePresetId = 'human_review';
  } else if (presetParam === 'won' || (!presetParam && statusFilter === 'WON')) {
    activePresetId = 'won';
  } else if (presetParam === 'lost' || (!presetParam && statusFilter === 'LOST')) {
    activePresetId = 'lost';
  } else if (!statusFilter && (!presetParam || presetParam === 'all')) {
    activePresetId = 'all';
  } else {
    activePresetId = ''; // Custom single status from dropdown
  }

  let items: LeadItem[] = [];
  let total = 0;
  let totalPages = 1;

  if (activePresetId === 'opportunities') {
    // Multi-status preset: QUALIFIED, DEAL_DISCUSSION, WON
    const [resQual, resDeal, resWon] = await Promise.all([
      serverApiFetch<LeadsResponse>('/leads?status=QUALIFIED&limit=100'),
      serverApiFetch<LeadsResponse>('/leads?status=DEAL_DISCUSSION&limit=100'),
      serverApiFetch<LeadsResponse>('/leads?status=WON&limit=100'),
    ]);

    const combined = [
      ...(resQual.data?.items || []),
      ...(resDeal.data?.items || []),
      ...(resWon.data?.items || []),
    ];

    // Deduplicate and sort by createdAt descending
    const map = new Map<string, LeadItem>();
    combined.forEach((item) => map.set(item.id, item));
    const allSorted = Array.from(map.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    total = allSorted.length;
    totalPages = Math.ceil(total / limit) || 1;
    items = allSorted.slice((page - 1) * limit, page * limit);
  } else if (activePresetId === 'human_review') {
    // Multi-status preset: HUMAN_REVIEW, RESTRICTED
    const [resReview, resRestricted] = await Promise.all([
      serverApiFetch<LeadsResponse>('/leads?status=HUMAN_REVIEW&limit=100'),
      serverApiFetch<LeadsResponse>('/leads?status=RESTRICTED&limit=100'),
    ]);

    const combined = [
      ...(resReview.data?.items || []),
      ...(resRestricted.data?.items || []),
    ];

    const map = new Map<string, LeadItem>();
    combined.forEach((item) => map.set(item.id, item));
    const allSorted = Array.from(map.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    total = allSorted.length;
    totalPages = Math.ceil(total / limit) || 1;
    items = allSorted.slice((page - 1) * limit, page * limit);
  } else {
    // Standard single status or all leads
    const queryParams = new URLSearchParams();
    queryParams.set('page', page.toString());
    queryParams.set('limit', limit.toString());
    if (statusFilter) {
      queryParams.set('status', statusFilter);
    }

    const { data } = await serverApiFetch<LeadsResponse>(`/leads?${queryParams.toString()}`);
    items = data?.items || [];
    total = data?.total || 0;
    totalPages = data?.totalPages || 1;
  }

  // Helper for pagination links
  const getPaginationHref = (targetPage: number) => {
    const params = new URLSearchParams();
    params.set('page', targetPage.toString());
    params.set('limit', limit.toString());
    if (presetParam) params.set('preset', presetParam);
    if (statusFilter) params.set('status', statusFilter);
    return `/leads?${params.toString()}`;
  };

  // Render comprehensive status indicator (Label + Icon + Plain Text + Color per Section 12)
  const getStatusBadge = (status: string) => {
    if (status === 'RESTRICTED') {
      return (
        <Tooltip title="Outreach blocked by compliance or safety rules" arrow>
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.75,
              px: 1,
              py: 0.35,
              borderRadius: 'var(--radius-sm)',
              bgcolor: 'var(--accent-danger-muted)',
              border: '1px solid rgba(244, 63, 94, 0.3)',
              color: '#fb7185',
              fontSize: '0.6875rem',
              fontWeight: 600,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <span>RESTRICTED</span>
          </Box>
        </Tooltip>
      );
    }

    if (status === 'HUMAN_REVIEW') {
      return (
        <Tooltip title="Flagged by AI: Requires manager review before outreach" arrow>
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.75,
              px: 1,
              py: 0.35,
              borderRadius: 'var(--radius-sm)',
              bgcolor: 'var(--accent-warning-muted)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              color: '#fbbf24',
              fontSize: '0.6875rem',
              fontWeight: 600,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>HUMAN REVIEW</span>
          </Box>
        </Tooltip>
      );
    }

    if (status === 'QUALIFIED' || status === 'WON' || status === 'DEAL_DISCUSSION') {
      return (
        <Box
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.75,
            px: 1,
            py: 0.35,
            borderRadius: 'var(--radius-sm)',
            bgcolor: 'var(--accent-success-muted)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            color: '#34d399',
            fontSize: '0.6875rem',
            fontWeight: 600,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M20 6L9 17l-5-5" />
          </svg>
          <span>{status.replace(/_/g, ' ')}</span>
        </Box>
      );
    }

    if (status === 'CONTACTED' || status === 'INTERESTED' || status === 'RESPONDED') {
      return (
        <Box
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.75,
            px: 1,
            py: 0.35,
            borderRadius: 'var(--radius-sm)',
            bgcolor: 'var(--accent-info-muted)',
            border: '1px solid rgba(14, 165, 233, 0.3)',
            color: '#38bdf8',
            fontSize: '0.6875rem',
            fontWeight: 600,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <span>{status.replace(/_/g, ' ')}</span>
        </Box>
      );
    }

    return (
      <Box
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          px: 1,
          py: 0.35,
          borderRadius: 'var(--radius-sm)',
          bgcolor: 'var(--bg-surface-subtle)',
          border: '1px solid var(--border-subtle)',
          color: 'var(--text-secondary)',
          fontSize: '0.6875rem',
          fontWeight: 500,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
        }}
      >
        <span>{status.replace(/_/g, ' ')}</span>
      </Box>
    );
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      <Header title="Lead Pipeline & Governance" />

      <Box
        component="main"
        sx={{
          p: { xs: 2, sm: 3, md: 4 },
          display: 'flex',
          flexDirection: 'column',
          gap: 3,
          maxWidth: 1400,
          width: '100%',
          mx: 'auto',
        }}
      >
        {/* Top Control Bar: Heading & Granular Lifecycle Selector */}
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={2}
          sx={{
            justifyContent: 'space-between',
            alignItems: { xs: 'flex-start', md: 'center' },
          }}
        >
          <Box>
            <Typography variant="h2" sx={{ color: 'var(--text-primary)', mb: 0.5, fontSize: '1.5rem', fontWeight: 700 }}>
              Prospect Directory
            </Typography>
            <Typography variant="body2" sx={{ color: 'var(--text-secondary)' }}>
              Showing {items.length} of {total} leads across the autonomous sales lifecycle
            </Typography>
          </Box>

          {/* Granular Single-Status Filter Form */}
          <Box
            component="form"
            method="GET"
            action="/leads"
            sx={{
              display: 'flex',
              gap: 1.5,
              alignItems: 'center',
              width: { xs: '100%', sm: 'auto' },
            }}
          >
            <FormControl size="small" sx={{ minWidth: 220 }}>
              <Select
                name="status"
                defaultValue={statusFilter}
                displayEmpty
                sx={{
                  bgcolor: 'var(--bg-surface-subtle)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.8125rem',
                  color: 'var(--text-primary)',
                  '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
                }}
              >
                <MenuItem value="" sx={{ fontSize: '0.8125rem' }}>
                  <em>All Lifecycle Statuses</em>
                </MenuItem>
                {ALL_LIFECYCLE_STATUSES.map((st) => (
                  <MenuItem key={st} value={st} sx={{ fontSize: '0.8125rem' }}>
                    {st.replace(/_/g, ' ')}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Button
              type="submit"
              variant="outlined"
              size="small"
              className="btn-secondary"
              sx={{ textTransform: 'none', px: 2 }}
            >
              Filter
            </Button>

            {(statusFilter || presetParam) && (
              <Button
                component={Link}
                href="/leads"
                variant="text"
                size="small"
                sx={{ color: 'var(--text-muted)', textTransform: 'none' }}
              >
                Clear
              </Button>
            )}
          </Box>
        </Stack>

        {/* Filter Preset Navigation Tabs / Buttons */}
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 1.25,
            p: 1,
            bgcolor: 'var(--bg-surface-subtle)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
          }}
        >
          {PRESETS.map((preset) => {
            const isActive = activePresetId === preset.id;
            return (
              <Button
                key={preset.id}
                component={Link}
                href={preset.href}
                size="small"
                variant={isActive ? 'contained' : 'text'}
                sx={{
                  textTransform: 'none',
                  fontSize: '0.8125rem',
                  fontWeight: isActive ? 600 : 500,
                  px: 2,
                  py: 0.85,
                  borderRadius: 'var(--radius-sm)',
                  color: isActive ? '#ffffff' : 'var(--text-secondary)',
                  bgcolor: isActive ? 'var(--accent-primary)' : 'transparent',
                  border: isActive ? '1px solid var(--accent-primary-light)' : '1px solid transparent',
                  boxShadow: isActive ? '0 2px 8px rgba(99, 102, 241, 0.35)' : 'none',
                  transition: 'var(--transition-default)',
                  '&:hover': {
                    bgcolor: isActive ? 'var(--accent-primary-hover)' : 'var(--bg-surface-hover)',
                    color: 'var(--text-primary)',
                  },
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <span>{preset.label}</span>
                  {preset.statuses.length > 0 && (
                    <Box
                      component="span"
                      sx={{
                        fontSize: '0.6875rem',
                        px: 0.75,
                        py: 0.1,
                        borderRadius: 'var(--radius-full)',
                        bgcolor: isActive ? 'rgba(255, 255, 255, 0.2)' : 'var(--bg-surface-elevated)',
                        color: isActive ? '#ffffff' : 'var(--text-muted)',
                        fontWeight: 600,
                      }}
                    >
                      {preset.statuses.length}
                    </Box>
                  )}
                </Box>
              </Button>
            );
          })}
        </Box>

        {/* Leads Data Table */}
        <Card
          sx={{
            overflow: 'hidden',
            bgcolor: 'var(--bg-surface)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: 'var(--bg-surface-subtle)' }}>
                  <TableCell sx={{ color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border-subtle)' }}>
                    Company
                  </TableCell>
                  <TableCell sx={{ color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border-subtle)' }}>
                    Primary Contact
                  </TableCell>
                  <TableCell sx={{ color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border-subtle)' }}>
                    Lifecycle Status
                  </TableCell>
                  <TableCell sx={{ color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border-subtle)' }}>
                    Qualification Score
                  </TableCell>
                  <TableCell sx={{ color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border-subtle)' }}>
                    Date Ingested
                  </TableCell>
                  <TableCell align="right" sx={{ color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border-subtle)' }}>
                    Action
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} sx={{ textAlign: 'center', py: 8, color: 'var(--text-muted)' }}>
                      <Typography variant="body2">No leads found matching the selected filter preset or criteria.</Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((lead) => (
                    <TableRow
                      key={lead.id}
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
                          href={`/leads/${lead.id}`}
                          style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
                        >
                          <Typography variant="body2" fontWeight={600} sx={{ color: 'var(--text-primary)' }}>
                            {lead.company?.name || 'Unknown Company'}
                          </Typography>
                          <Typography variant="caption" sx={{ color: 'var(--text-muted)' }}>
                            {lead.company?.industry || 'General Industry'} {lead.company?.domain ? `• ${lead.company.domain}` : ''}
                          </Typography>
                        </Link>
                      </TableCell>

                      <TableCell>
                        <Link
                          href={`/leads/${lead.id}`}
                          style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
                        >
                          {lead.primaryContact ? (
                            <>
                              <Typography variant="body2" sx={{ color: 'var(--text-primary)' }}>
                                {lead.primaryContact.firstName} {lead.primaryContact.lastName || ''}
                              </Typography>
                              <Typography variant="caption" sx={{ color: 'var(--accent-info)' }}>
                                {lead.primaryContact.email}
                              </Typography>
                            </>
                          ) : (
                            <Typography variant="body2" sx={{ color: 'var(--text-muted)' }}>
                              No contact assigned
                            </Typography>
                          )}
                        </Link>
                      </TableCell>

                      <TableCell>
                        <Link
                          href={`/leads/${lead.id}`}
                          style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
                        >
                          {getStatusBadge(lead.status)}
                        </Link>
                      </TableCell>

                      <TableCell>
                        <Link
                          href={`/leads/${lead.id}`}
                          style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
                        >
                          <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
                            <Typography
                              variant="body2"
                              fontWeight={700}
                              sx={{
                                color:
                                  lead.scoreTotal >= 70
                                    ? '#34d399'
                                    : lead.scoreTotal >= 50
                                      ? '#fbbf24'
                                      : 'var(--text-primary)',
                              }}
                            >
                              {lead.scoreTotal}
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 400 }}>/100</span>
                            </Typography>
                          </Box>
                        </Link>
                      </TableCell>

                      <TableCell>
                        <Link
                          href={`/leads/${lead.id}`}
                          style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
                        >
                          <Typography variant="body2" sx={{ color: 'var(--text-secondary)' }}>
                            {new Date(lead.createdAt).toLocaleDateString(undefined, {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </Typography>
                        </Link>
                      </TableCell>

                      <TableCell align="right">
                        <Button
                          component={Link}
                          href={`/leads/${lead.id}`}
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
                          Inspect Lead →
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
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
                Page <strong>{page}</strong> of <strong>{totalPages}</strong> ({total} total leads)
              </Typography>

              <Stack direction="row" spacing={1}>
                {page > 1 ? (
                  <Button
                    component={Link}
                    href={getPaginationHref(page - 1)}
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
                    href={getPaginationHref(page + 1)}
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
