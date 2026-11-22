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
import { Header } from '@/components/header';
import { serverApiFetch } from '@/lib/server-api-client';
import { LeadPriority, PriorityBadge, ReadinessMeter, NeedsYouBadge } from '@/components/lead-priority';
import { LeadStatus } from '@/components/ui';

interface LeadItem {
  id: string;
  status: string;
  scoreTotal: number;
  priority?: LeadPriority;
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
  },
  {
    id: 'human_review',
    label: 'Human Review',
    description: 'Flagged by AI safety checks or policy restrictions',
    statuses: ['HUMAN_REVIEW', 'RESTRICTED'],
    href: '/leads?preset=human_review',
  },
  {
    id: 'won',
    label: 'Won',
    description: 'Successfully converted clients',
    statuses: ['WON'],
    href: '/leads?preset=won&status=WON',
  },
  {
    id: 'lost',
    label: 'Lost',
    description: 'Disqualified or closed-lost leads',
    statuses: ['LOST'],
    href: '/leads?preset=lost&status=LOST',
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
    queryParams.set('sort', 'priority');
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

  // Render comprehensive status indicator (Label + Icon + Plain Text + Color per V2)
  const getStatusBadge = (status: string) => <LeadStatus status={status} />;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, bgcolor: '#141415', minHeight: '100vh' }}>
      <Header title="Leads" />

      <Box
        component="main"
        sx={{
          p: { xs: 2, sm: 3, md: 4 },
          display: 'flex',
          flexDirection: 'column',
          gap: 2.5,
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
            <Typography variant="h2" sx={{ color: '#ededed', mb: 0.5, fontSize: '1.25rem', fontWeight: 500, }}>
              All leads
            </Typography>
            <Typography variant="body2" sx={{ color: '#a1a1a6', fontSize: '0.8125rem' }}>
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
              gap: 1.25,
              alignItems: 'center',
              width: { xs: '100%', sm: 'auto' },
            }}
          >
            <FormControl size="small" sx={{ minWidth: 210 }}>
              <Select
                name="status"
                defaultValue={statusFilter}
                displayEmpty
                sx={{
                  bgcolor: '#1e1e20',
                  border: '1px solid rgba(237, 237, 237, 0.09)',
                  borderRadius: '8px',
                  fontSize: '0.8125rem',
                  color: '#ededed',
                  '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
                  '&:hover': {
                    borderColor: 'rgba(237, 237, 237, 0.16)',
                  },
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
              className="v2-btn-secondary"
              sx={{
                textTransform: 'none',
                px: 2,
                py: 0.65,
                fontSize: '0.8125rem',
                fontWeight: 500,
                color: '#ededed',
                borderColor: 'rgba(237, 237, 237, 0.09)',
                bgcolor: '#1e1e20',
                borderRadius: '8px',
                '&:hover': {
                  bgcolor: 'rgba(237, 237, 237, 0.06)',
                  borderColor: 'rgba(237, 237, 237, 0.16)',
                },
              }}
            >
              Filter
            </Button>

            {(statusFilter || presetParam) && (
              <Button
                component={Link}
                href="/leads"
                variant="text"
                size="small"
                sx={{ color: '#85858b', textTransform: 'none', fontSize: '0.8125rem', '&:hover': { color: '#ededed' } }}
              >
                Clear
              </Button>
            )}
          </Box>
        </Stack>

        {/* Filter Preset Navigation Tabs */}
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 4,
            p: 0.75,
            bgcolor: '#19191b',
            border: '1px solid rgba(237, 237, 237, 0.09)',
            borderRadius: '8px',
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
                sx={{
                  textTransform: 'none',
                  fontSize: '0.8125rem',
                  fontWeight: isActive ? 600 : 500,
                  px: 1.75,
                  py: 0.6,
                  borderRadius: '8px',
                  color: isActive ? '#ffffff' : '#a1a1a6',
                  bgcolor: isActive ? '#3d6fd8' : 'transparent',
                  border: isActive ? '1px solid #3d6fd8' : '1px solid transparent',
                  transition: 'background-color 140ms cubic-bezier(0.23, 1, 0.32, 1), color 140ms cubic-bezier(0.23, 1, 0.32, 1)',
                  '&:hover': {
                    bgcolor: isActive ? '#3563c4' : 'rgba(237, 237, 237, 0.06)',
                    color: '#ededed',
                  },
                  '&:active': {
                    transform: 'scale(0.97)',
                  },
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.85 }}>
                  <span>{preset.label}</span>
                  {preset.statuses.length > 0 && (
                    <Box
                      component="span"
                      sx={{
                        fontSize: '0.75rem',
                        px: 0.65,
                        py: 0.05,
                        borderRadius: '4px',
                        bgcolor: isActive ? 'rgba(237, 237, 237, 0.16)' : '#232325',
                        color: isActive ? '#ffffff' : '#85858b',
                        fontWeight: 500,
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
            bgcolor: '#19191b',
            border: '1px solid rgba(237, 237, 237, 0.09)',
            borderRadius: '12px',
            boxShadow: 'none',
          }}
        >
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: '#1e1e20' }}>
                  <TableCell sx={{ color: '#a1a1a6', fontWeight: 500, fontSize: '0.75rem', borderBottom: '1px solid rgba(237, 237, 237, 0.06)', py: 1.5 }}>
                    Company
                  </TableCell>
                  <TableCell sx={{ color: '#a1a1a6', fontWeight: 500, fontSize: '0.75rem', borderBottom: '1px solid rgba(237, 237, 237, 0.06)', py: 1.5 }}>
                    Primary contact
                  </TableCell>
                  <TableCell sx={{ color: '#a1a1a6', fontWeight: 500, fontSize: '0.75rem', borderBottom: '1px solid rgba(237, 237, 237, 0.06)', py: 1.5 }}>
                    Lifecycle status
                  </TableCell>
                  <TableCell sx={{ color: '#a1a1a6', fontWeight: 500, fontSize: '0.75rem', borderBottom: '1px solid rgba(237, 237, 237, 0.06)', py: 1.5 }}>
                    Qualification score
                  </TableCell>
                  <TableCell sx={{ color: '#a1a1a6', fontWeight: 500, fontSize: '0.75rem', borderBottom: '1px solid rgba(237, 237, 237, 0.06)', py: 1.5 }}>
                    Priority
                  </TableCell>
                  <TableCell sx={{ color: '#a1a1a6', fontWeight: 500, fontSize: '0.75rem', borderBottom: '1px solid rgba(237, 237, 237, 0.06)', py: 1.5 }}>
                    Deal readiness
                  </TableCell>
                  <TableCell sx={{ color: '#a1a1a6', fontWeight: 500, fontSize: '0.75rem', borderBottom: '1px solid rgba(237, 237, 237, 0.06)', py: 1.5 }}>
                    Date ingested
                  </TableCell>
                  <TableCell align="right" sx={{ color: '#a1a1a6', fontWeight: 500, fontSize: '0.75rem', borderBottom: '1px solid rgba(237, 237, 237, 0.06)', py: 1.5 }}>
                    Action
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} sx={{ textAlign: 'center', py: 8, color: '#85858b' }}>
                      <Typography variant="body2" sx={{ fontSize: '0.875rem' }}>No leads found matching the selected filter preset or criteria.</Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((lead) => (
                    <TableRow
                      key={lead.id}
                      sx={{
                        borderBottom: '1px solid rgba(237, 237, 237, 0.06)',
                        transition: 'background-color 120ms cubic-bezier(0.23, 1, 0.32, 1)',
                        '&:hover': {
                          bgcolor: 'rgba(237, 237, 237, 0.03) !important',
                        },
                      }}
                    >
                      <TableCell sx={{ py: 1.5 }}>
                        <Link
                          href={`/leads/${lead.id}`}
                          style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
                        >
                          <Typography variant="body2" fontWeight={600} sx={{ color: '#ededed', fontSize: '0.875rem', }}>
                            {lead.company?.name || 'Unknown Company'}
                          </Typography>
                          <Typography variant="caption" sx={{ color: '#85858b', fontSize: '0.75rem' }}>
                            {lead.company?.industry || 'General Industry'} {lead.company?.domain ? `• ${lead.company.domain}` : ''}
                          </Typography>
                        </Link>
                      </TableCell>

                      <TableCell sx={{ py: 1.5 }}>
                        <Link
                          href={`/leads/${lead.id}`}
                          style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
                        >
                          {lead.primaryContact ? (
                            <>
                              <Typography variant="body2" sx={{ color: '#ededed', fontSize: '0.875rem' }}>
                                {lead.primaryContact.firstName} {lead.primaryContact.lastName || ''}
                              </Typography>
                              <Typography variant="caption" sx={{ color: '#86a9f2', fontSize: '0.75rem' }}>
                                {lead.primaryContact.email}
                              </Typography>
                            </>
                          ) : (
                            <Typography variant="body2" sx={{ color: '#85858b', fontSize: '0.8125rem' }}>
                              No contact assigned
                            </Typography>
                          )}
                        </Link>
                      </TableCell>

                      <TableCell sx={{ py: 1.5 }}>
                        <Link
                          href={`/leads/${lead.id}`}
                          style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
                        >
                          {getStatusBadge(lead.status)}
                        </Link>
                      </TableCell>

                      <TableCell sx={{ py: 1.5 }}>
                        <Link
                          href={`/leads/${lead.id}`}
                          style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
                        >
                          <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                            <Typography
                              variant="body2"
                              fontWeight={600}
                              sx={{
                                color:
                                  lead.scoreTotal >= 70
                                    ? '#4cc38a'
                                    : lead.scoreTotal >= 50
                                      ? '#e3a94d'
                                      : '#ededed',
                                fontSize: '0.875rem',
                                fontVariantNumeric: 'tabular-nums',
                              }}
                            >
                              {lead.scoreTotal}
                              <span style={{ fontSize: '0.75rem', color: '#85858b', fontWeight: 400 }}>/100</span>
                            </Typography>
                          </Box>
                        </Link>
                      </TableCell>

                      <TableCell sx={{ py: 1.5 }}>
                        <Link href={`/leads/${lead.id}`} style={{ textDecoration: 'none', color: 'inherit', display: 'inline-flex', gap: 8, alignItems: 'center' }}>
                          <PriorityBadge priority={lead.priority} />
                          <NeedsYouBadge priority={lead.priority} />
                        </Link>
                      </TableCell>

                      <TableCell sx={{ py: 1.5 }}>
                        <Link href={`/leads/${lead.id}`} style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
                          <ReadinessMeter priority={lead.priority} />
                        </Link>
                      </TableCell>

                      <TableCell sx={{ py: 1.5 }}>
                        <Link
                          href={`/leads/${lead.id}`}
                          style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
                        >
                          <Typography variant="body2" sx={{ color: '#a1a1a6', fontSize: '0.8125rem', fontVariantNumeric: 'tabular-nums' }}>
                            {new Date(lead.createdAt).toLocaleDateString(undefined, {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </Typography>
                        </Link>
                      </TableCell>

                      <TableCell align="right" sx={{ py: 1.5 }}>
                        <Button
                          component={Link}
                          href={`/leads/${lead.id}`}
                          size="small"
                          variant="text"
                          sx={{
                            color: '#86a9f2',
                            textTransform: 'none',
                            fontSize: '0.8125rem',
                            fontWeight: 500,
                            p: '4px 8px',
                            borderRadius: '4px',
                            '&:hover': {
                              color: '#a9c1f6',
                              bgcolor: 'rgba(94, 140, 235, 0.08)',
                            },
                            '&:active': {
                              transform: 'scale(0.97)',
                            },
                          }}
                        >
                          Open lead
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
                borderTop: '1px solid rgba(237, 237, 237, 0.06)',
                bgcolor: '#1e1e20',
              }}
            >
              <Typography variant="body2" sx={{ color: '#a1a1a6', fontSize: '0.8125rem' }}>
                Page <strong>{page}</strong> of <strong>{totalPages}</strong> ({total} total leads)
              </Typography>

              <Stack direction="row" spacing={1}>
                {page > 1 ? (
                  <Button
                    component={Link}
                    href={getPaginationHref(page - 1)}
                    variant="outlined"
                    size="small"
                    sx={{
                      textTransform: 'none',
                      color: '#ededed',
                      borderColor: 'rgba(237, 237, 237, 0.09)',
                      bgcolor: '#19191b',
                      borderRadius: '8px',
                      fontSize: '0.8125rem',
                      '&:hover': {
                        bgcolor: 'rgba(237, 237, 237, 0.06)',
                        borderColor: 'rgba(237, 237, 237, 0.16)',
                      },
                      '&:active': { transform: 'scale(0.97)' },
                    }}
                  >
                    Previous
                  </Button>
                ) : (
                  <Button disabled variant="outlined" size="small" sx={{ textTransform: 'none', opacity: 0.4, borderRadius: '8px', fontSize: '0.8125rem' }}>
                    Previous
                  </Button>
                )}

                {page < totalPages ? (
                  <Button
                    component={Link}
                    href={getPaginationHref(page + 1)}
                    variant="outlined"
                    size="small"
                    sx={{
                      textTransform: 'none',
                      color: '#ededed',
                      borderColor: 'rgba(237, 237, 237, 0.09)',
                      bgcolor: '#19191b',
                      borderRadius: '8px',
                      fontSize: '0.8125rem',
                      '&:hover': {
                        bgcolor: 'rgba(237, 237, 237, 0.06)',
                        borderColor: 'rgba(237, 237, 237, 0.16)',
                      },
                      '&:active': { transform: 'scale(0.97)' },
                    }}
                  >
                    Next
                  </Button>
                ) : (
                  <Button disabled variant="outlined" size="small" sx={{ textTransform: 'none', opacity: 0.4, borderRadius: '8px', fontSize: '0.8125rem' }}>
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

