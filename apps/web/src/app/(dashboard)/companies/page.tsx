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
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import { Header } from '@/components/header';
import { serverApiFetch } from '@/lib/server-api-client';

interface CompanyItem {
  id: string;
  name: string;
  domain?: string | null;
  industry?: string | null;
  size?: string | null;
  location?: string | null;
  country?: string | null;
  website?: string | null;
  linkedinUrl?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface CompaniesResponse {
  items: CompanyItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export default async function CompaniesListPage({
  searchParams,
}: {
  searchParams: { page?: string; limit?: string; search?: string; industry?: string };
}) {
  const page = parseInt(searchParams.page || '1', 10);
  const limit = parseInt(searchParams.limit || '10', 10);
  const searchFilter = searchParams.search || '';
  const industryFilter = searchParams.industry || '';

  const queryParams = new URLSearchParams();
  queryParams.set('page', page.toString());
  queryParams.set('limit', limit.toString());
  if (searchFilter) {
    queryParams.set('search', searchFilter);
  }
  if (industryFilter) {
    queryParams.set('industry', industryFilter);
  }

  const { data } = await serverApiFetch<CompaniesResponse>(`/companies?${queryParams.toString()}`);

  const items = data?.items || [];
  const total = data?.total || 0;
  const totalPages = data?.totalPages || 1;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      <Header title="Company & Account Intelligence" />

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
        {/* Top Control Bar: Heading, Total Counter & Search Filter */}
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          sx={{
            justifyContent: 'space-between',
            alignItems: { xs: 'flex-start', sm: 'center' },
          }}
        >
          <Box>
            <Typography variant="h2" sx={{ color: 'var(--text-primary)', mb: 0.5 }}>
              Company Directory
            </Typography>
            <Typography variant="body2" sx={{ color: 'var(--text-secondary)' }}>
              Showing {items.length} of {total} enterprise accounts undergoing autonomous market intelligence
            </Typography>
          </Box>

          {/* Search Controls Form */}
          <Box
            component="form"
            method="GET"
            action="/companies"
            sx={{
              display: 'flex',
              gap: 1.5,
              alignItems: 'center',
              width: { xs: '100%', sm: 'auto' },
            }}
          >
            <TextField
              name="search"
              defaultValue={searchFilter}
              placeholder="Search name, domain, city..."
              size="small"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2.5">
                      <circle cx="11" cy="11" r="8" />
                      <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                  </InputAdornment>
                ),
              }}
              sx={{
                width: { xs: '100%', sm: 260 },
                bgcolor: 'var(--bg-surface-subtle)',
                borderRadius: 'var(--radius-sm)',
                '& .MuiOutlinedInput-root': {
                  fontSize: '0.8125rem',
                  color: 'var(--text-primary)',
                  '& fieldset': {
                    borderColor: 'var(--border-default)',
                  },
                  '&:hover fieldset': {
                    borderColor: 'var(--border-strong)',
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: 'var(--border-focus)',
                  },
                },
              }}
            />

            <Button
              type="submit"
              variant="outlined"
              size="small"
              className="btn-secondary"
              sx={{ textTransform: 'none', px: 2 }}
            >
              Filter
            </Button>

            {(searchFilter || industryFilter) && (
              <Button
                component={Link}
                href="/companies"
                variant="text"
                size="small"
                sx={{ color: 'var(--text-muted)', textTransform: 'none' }}
              >
                Clear
              </Button>
            )}
          </Box>
        </Stack>

        {/* Companies Data Table */}
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
                    Company / Domain
                  </TableCell>
                  <TableCell sx={{ color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border-subtle)' }}>
                    Industry
                  </TableCell>
                  <TableCell sx={{ color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border-subtle)' }}>
                    Location
                  </TableCell>
                  <TableCell sx={{ color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border-subtle)' }}>
                    Size
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
                      <Typography variant="body2">No companies found matching the search criteria.</Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((company) => (
                    <TableRow
                      key={company.id}
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
                          href={`/companies/${company.id}`}
                          style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
                        >
                          <Typography variant="body2" fontWeight={600} sx={{ color: 'var(--text-primary)' }}>
                            {company.name}
                          </Typography>
                          <Typography variant="caption" sx={{ color: company.domain ? 'var(--accent-info)' : 'var(--text-muted)' }}>
                            {company.domain ? company.domain : (company.website || 'No domain registered')}
                          </Typography>
                        </Link>
                      </TableCell>

                      <TableCell>
                        <Link
                          href={`/companies/${company.id}`}
                          style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
                        >
                          <Chip
                            size="small"
                            label={company.industry || 'General Industry'}
                            sx={{
                              bgcolor: 'var(--bg-surface-subtle)',
                              border: '1px solid var(--border-subtle)',
                              color: 'var(--text-secondary)',
                              fontSize: '0.6875rem',
                              fontWeight: 500,
                            }}
                          />
                        </Link>
                      </TableCell>

                      <TableCell>
                        <Link
                          href={`/companies/${company.id}`}
                          style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
                        >
                          <Typography variant="body2" sx={{ color: 'var(--text-secondary)' }}>
                            {company.location
                              ? `${company.location}${company.country ? `, ${company.country}` : ''}`
                              : '—'}
                          </Typography>
                        </Link>
                      </TableCell>

                      <TableCell>
                        <Link
                          href={`/companies/${company.id}`}
                          style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
                        >
                          <Typography variant="body2" sx={{ color: 'var(--text-secondary)' }}>
                            {company.size || '—'}
                          </Typography>
                        </Link>
                      </TableCell>

                      <TableCell>
                        <Link
                          href={`/companies/${company.id}`}
                          style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
                        >
                          <Typography variant="body2" sx={{ color: 'var(--text-secondary)' }}>
                            {new Date(company.createdAt).toLocaleDateString(undefined, {
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
                          href={`/companies/${company.id}`}
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
                          View Dossier →
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
                Page <strong>{page}</strong> of <strong>{totalPages}</strong> ({total} total companies)
              </Typography>

              <Stack direction="row" spacing={1}>
                {page > 1 ? (
                  <Button
                    component={Link}
                    href={`/companies?page=${page - 1}&limit=${limit}${searchFilter ? `&search=${encodeURIComponent(searchFilter)}` : ''}${industryFilter ? `&industry=${encodeURIComponent(industryFilter)}` : ''}`}
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
                    href={`/companies?page=${page + 1}&limit=${limit}${searchFilter ? `&search=${encodeURIComponent(searchFilter)}` : ''}${industryFilter ? `&industry=${encodeURIComponent(industryFilter)}` : ''}`}
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

