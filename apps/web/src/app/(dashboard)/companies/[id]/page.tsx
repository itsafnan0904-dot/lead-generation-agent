import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Tooltip from '@mui/material/Tooltip';
import { Header } from '@/components/header';
import { serverApiFetch } from '@/lib/server-api-client';
import { CompanyActionButtons } from './company-actions';

interface ResearchRecord {
  id: string;
  companyId: string;
  leadId?: string | null;
  companySummary?: string | null;
  keyInsights?: any;
  techStack?: any;
  painPoints?: any;
  newsAndEvents?: any;
  rawResearchData?: any;
  completedAt?: string | null;
  createdAt: string;
}

interface LinkedLead {
  id: string;
  status: string;
  scoreTotal: number;
  aiControlState: string;
  createdAt: string;
  primaryContact?: {
    id: string;
    firstName: string;
    lastName?: string;
    email: string;
  } | null;
}

interface CompanyContact {
  id: string;
  firstName: string;
  lastName?: string | null;
  email: string;
  title?: string | null;
  phone?: string | null;
  isPrimary: boolean;
}

interface CompanyDetailData {
  id: string;
  name: string;
  domain?: string | null;
  industry?: string | null;
  size?: string | null;
  location?: string | null;
  country?: string | null;
  website?: string | null;
  linkedinUrl?: string | null;
  metadata?: any;
  createdAt: string;
  updatedAt: string;
  contacts: CompanyContact[];
  leads: LinkedLead[];
  research: ResearchRecord[];
}

export default async function CompanyDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const companyId = params.id;

  const { data: company, status } = await serverApiFetch<CompanyDetailData>(`/companies/${companyId}`);

  if (!company || status === 404) {
    notFound();
  }

  const researchHistory = company.research || [];
  const linkedLeads = company.leads || [];
  const contacts = company.contacts || [];

  const latestResearch = researchHistory[0];

  // Render lead lifecycle status badge consistent with Lead Detail & Directory
  const getLeadStatusBadge = (leadStatus: string) => {
    if (leadStatus === 'RESTRICTED') {
      return (
        <Box
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.5,
            px: 0.85,
            py: 0.25,
            borderRadius: 'var(--radius-sm)',
            bgcolor: 'var(--accent-danger-muted)',
            border: '1px solid rgba(244, 63, 94, 0.3)',
            color: '#fb7185',
            fontSize: '0.625rem',
            fontWeight: 700,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
          }}
        >
          <span>RESTRICTED</span>
        </Box>
      );
    }

    if (leadStatus === 'HUMAN_REVIEW') {
      return (
        <Box
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.5,
            px: 0.85,
            py: 0.25,
            borderRadius: 'var(--radius-sm)',
            bgcolor: 'var(--accent-warning-muted)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            color: '#fbbf24',
            fontSize: '0.625rem',
            fontWeight: 700,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
          }}
        >
          <span>HUMAN REVIEW</span>
        </Box>
      );
    }

    if (leadStatus === 'QUALIFIED' || leadStatus === 'WON') {
      return (
        <Box
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.5,
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
          <span>{leadStatus}</span>
        </Box>
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
          color: 'var(--text-secondary)',
          fontSize: '0.625rem',
          fontWeight: 600,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
        }}
      >
        <span>{leadStatus.replace(/_/g, ' ')}</span>
      </Box>
    );
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      <Header title={`Company: ${company.name}`} />

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
        {/* Navigation & Action Bar */}
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          sx={{
            justifyContent: 'space-between',
            alignItems: { xs: 'flex-start', sm: 'center' },
          }}
        >
          <Button
            component={Link}
            href="/companies"
            variant="text"
            size="small"
            sx={{
              color: 'var(--text-secondary)',
              textTransform: 'none',
              fontSize: '0.8125rem',
              p: 0,
              '&:hover': { color: 'var(--text-primary)', bgcolor: 'transparent' },
            }}
          >
            ← Back to Companies Directory
          </Button>

          {/* AI Action Trigger */}
          <CompanyActionButtons companyId={company.id} companyName={company.name} />
        </Stack>

        {/* Company Overview Dossier Card */}
        <Card
          sx={{
            bgcolor: 'var(--bg-surface)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <CardContent sx={{ p: 3, '&:last-child': { pb: 3 } }}>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={2}
              sx={{
                justifyContent: 'space-between',
                alignItems: { xs: 'flex-start', sm: 'center' },
                mb: 2.5,
              }}
            >
              <Box>
                <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                  <Typography variant="h1" sx={{ color: 'var(--text-primary)' }}>
                    {company.name}
                  </Typography>
                  <Chip
                    size="small"
                    label={company.industry || 'General Industry'}
                    sx={{
                      bgcolor: 'var(--bg-surface-subtle)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-secondary)',
                      fontSize: '0.75rem',
                      fontWeight: 500,
                    }}
                  />
                  {latestResearch && (
                    <Box
                      sx={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 0.5,
                        px: 1,
                        py: 0.35,
                        borderRadius: 'var(--radius-full)',
                        bgcolor: 'var(--accent-info-muted)',
                        border: '1px solid rgba(14, 165, 233, 0.3)',
                        color: '#38bdf8',
                        fontSize: '0.6875rem',
                        fontWeight: 600,
                        letterSpacing: '0.03em',
                      }}
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                      </svg>
                      <span>
                        Last Researched:{' '}
                        {new Date(latestResearch.createdAt).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </span>
                    </Box>
                  )}
                </Stack>
                {company.domain && (
                  <Typography variant="body2" sx={{ color: 'var(--accent-info)', mt: 0.5 }}>
                    {company.domain}
                  </Typography>
                )}
              </Box>

              <Stack direction="row" spacing={1}>
                {company.website && (
                  <Button
                    component="a"
                    href={company.website.startsWith('http') ? company.website : `https://${company.website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    variant="outlined"
                    size="small"
                    className="btn-secondary"
                    sx={{ textTransform: 'none', fontSize: '0.8125rem' }}
                  >
                    Official Website ↗
                  </Button>
                )}
                {company.linkedinUrl && (
                  <Button
                    component="a"
                    href={company.linkedinUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    variant="outlined"
                    size="small"
                    className="btn-secondary"
                    sx={{ textTransform: 'none', fontSize: '0.8125rem' }}
                  >
                    LinkedIn Profile ↗
                  </Button>
                )}
              </Stack>
            </Stack>

            <Divider sx={{ mb: 2.5, borderColor: 'var(--border-subtle)' }} />

            <Grid container spacing={3}>
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <Typography variant="caption" sx={{ color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                  Location
                </Typography>
                <Typography variant="body2" sx={{ color: 'var(--text-primary)', mt: 0.5, fontWeight: 500 }}>
                  {company.location
                    ? `${company.location}${company.country ? `, ${company.country}` : ''}`
                    : 'Not Specified'}
                </Typography>
              </Grid>

              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <Typography variant="caption" sx={{ color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                  Company Scale / Size
                </Typography>
                <Typography variant="body2" sx={{ color: 'var(--text-primary)', mt: 0.5, fontWeight: 500 }}>
                  {company.size || 'Not Specified'}
                </Typography>
              </Grid>

              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <Typography variant="caption" sx={{ color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                  Linked Active Leads
                </Typography>
                <Typography variant="body2" sx={{ color: 'var(--text-primary)', mt: 0.5, fontWeight: 600 }}>
                  {linkedLeads.length} Lead{linkedLeads.length === 1 ? '' : 's'}
                </Typography>
              </Grid>

              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <Typography variant="caption" sx={{ color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                  Research Dossiers
                </Typography>
                <Typography variant="body2" sx={{ color: 'var(--text-primary)', mt: 0.5, fontWeight: 600 }}>
                  {researchHistory.length} Record{researchHistory.length === 1 ? '' : 's'}
                </Typography>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* 2-Column Section: Chronological Research Timeline (Left) & Pipeline / Contacts (Right) */}
        <Grid container spacing={3}>
          {/* Left Column: Multi-Record Research History Timeline */}
          <Grid size={{ xs: 12, md: 7 }}>
            <Stack spacing={2.5}>
              <Box>
                <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="h3" sx={{ color: 'var(--text-primary)' }}>
                    AI Research & Market Intelligence History
                  </Typography>
                  <Chip
                    size="small"
                    label={`${researchHistory.length} Record${researchHistory.length === 1 ? '' : 's'}`}
                    sx={{
                      bgcolor: 'var(--bg-surface-subtle)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-secondary)',
                      fontWeight: 600,
                      fontSize: '0.75rem',
                    }}
                  />
                </Stack>
                <Typography variant="body2" sx={{ color: 'var(--text-muted)', mt: 0.5 }}>
                  Chronological intelligence stream generated by AI agents (most recent first). Older records remain preserved.
                </Typography>
              </Box>

              {researchHistory.length === 0 ? (
                <Card
                  sx={{
                    p: 4,
                    textAlign: 'center',
                    bgcolor: 'var(--bg-surface)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 'var(--radius-md)',
                  }}
                >
                  <Typography variant="body2" sx={{ color: 'var(--text-secondary)' }}>
                    No AI research dossiers generated for this company yet.
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'var(--text-muted)', mt: 1, display: 'block' }}>
                    Click &quot;Run AI Research&quot; above to execute automated market analysis, scope extraction, and restriction evaluation.
                  </Typography>
                </Card>
              ) : (
                researchHistory.map((rec, idx) => {
                  const insights = Array.isArray(rec.keyInsights) ? rec.keyInsights : [];
                  const tech = Array.isArray(rec.techStack) ? rec.techStack : [];
                  const pains = Array.isArray(rec.painPoints) ? rec.painPoints : [];
                  const news = Array.isArray(rec.newsAndEvents) ? rec.newsAndEvents : [];
                  const restrictionResult = rec.rawResearchData?.restrictionResult;
                  const tokensUsed =
                    rec.rawResearchData?.metadata?.usage?.totalTokens ||
                    rec.rawResearchData?.metadata?.tokensUsed?.totalTokens;

                  return (
                    <Card
                      key={rec.id}
                      sx={{
                        bgcolor: 'var(--bg-surface)',
                        border: '1px solid var(--border-default)',
                        borderRadius: 'var(--radius-md)',
                        boxShadow: 'var(--shadow-card)',
                        borderLeft: idx === 0 ? '3px solid var(--accent-info)' : '1px solid var(--border-default)',
                        transition: 'var(--transition-default)',
                      }}
                    >
                      <CardContent sx={{ p: 3, '&:last-child': { pb: 3 } }}>
                        {/* Timeline Header Row */}
                        <Stack
                          direction={{ xs: 'column', sm: 'row' }}
                          spacing={1}
                          sx={{
                            justifyContent: 'space-between',
                            alignItems: { xs: 'flex-start', sm: 'center' },
                            mb: 2,
                          }}
                        >
                          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                            <Typography variant="subtitle1" fontWeight={600} sx={{ color: 'var(--text-primary)' }}>
                              {idx === 0 ? 'Latest Intelligence Dossier' : `Historical Dossier #${researchHistory.length - idx}`}
                            </Typography>

                            {idx === 0 && (
                              <Chip
                                size="small"
                                label="CURRENT"
                                sx={{
                                  bgcolor: 'var(--accent-info-muted)',
                                  border: '1px solid rgba(14, 165, 233, 0.3)',
                                  color: '#38bdf8',
                                  fontSize: '0.625rem',
                                  fontWeight: 700,
                                  height: 20,
                                }}
                              />
                            )}

                            {restrictionResult && (
                              <Chip
                                size="small"
                                label={`POLICY: ${restrictionResult}`}
                                sx={{
                                  fontWeight: 700,
                                  fontSize: '0.625rem',
                                  height: 20,
                                  bgcolor:
                                    restrictionResult === 'RESTRICTED'
                                      ? 'var(--accent-danger-muted)'
                                      : restrictionResult === 'HUMAN_REVIEW'
                                        ? 'var(--accent-warning-muted)'
                                        : 'var(--accent-success-muted)',
                                  border:
                                    restrictionResult === 'RESTRICTED'
                                      ? '1px solid rgba(244, 63, 94, 0.3)'
                                      : restrictionResult === 'HUMAN_REVIEW'
                                        ? '1px solid rgba(245, 158, 11, 0.3)'
                                        : '1px solid rgba(16, 185, 129, 0.3)',
                                  color:
                                    restrictionResult === 'RESTRICTED'
                                      ? '#fb7185'
                                      : restrictionResult === 'HUMAN_REVIEW'
                                        ? '#fbbf24'
                                        : '#34d399',
                                }}
                              />
                            )}

                            {tokensUsed && (
                              <Chip
                                size="small"
                                label={`${tokensUsed} tokens`}
                                sx={{
                                  bgcolor: 'var(--bg-surface-subtle)',
                                  color: 'var(--text-muted)',
                                  fontSize: '0.625rem',
                                  height: 20,
                                }}
                              />
                            )}
                          </Stack>

                          <Typography variant="caption" sx={{ color: 'var(--text-muted)' }}>
                            Researched on{' '}
                            {new Date(rec.createdAt).toLocaleString(undefined, {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </Typography>
                        </Stack>

                        {/* Summary Block */}
                        {rec.companySummary && (
                          <Box
                            sx={{
                              p: 2,
                              borderRadius: 'var(--radius-sm)',
                              bgcolor: 'var(--bg-surface-subtle)',
                              border: '1px solid var(--border-subtle)',
                              mb: 2,
                            }}
                          >
                            <Typography variant="caption" sx={{ color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, display: 'block', mb: 0.5 }}>
                              Company Profile Summary
                            </Typography>
                            <Typography variant="body2" sx={{ color: 'var(--text-primary)', lineHeight: 1.6 }}>
                              {rec.companySummary}
                            </Typography>
                          </Box>
                        )}

                        {/* Key Market Insights */}
                        {insights.length > 0 && (
                          <Box sx={{ mb: 2 }}>
                            <Typography variant="caption" sx={{ color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, display: 'block', mb: 0.75 }}>
                              Key Market Insights & Positioning
                            </Typography>
                            <Box component="ul" sx={{ pl: 2.5, m: 0 }}>
                              {insights.map((insight: string, i: number) => (
                                <Typography key={i} component="li" variant="body2" sx={{ color: 'var(--text-secondary)', mb: 0.5, lineHeight: 1.5 }}>
                                  {insight}
                                </Typography>
                              ))}
                            </Box>
                          </Box>
                        )}

                        {/* Pain Points & Scope */}
                        {pains.length > 0 && (
                          <Box sx={{ mb: 2 }}>
                            <Typography variant="caption" sx={{ color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, display: 'block', mb: 0.75 }}>
                              Identified Pain Points & Scope
                            </Typography>
                            <Box component="ul" sx={{ pl: 2.5, m: 0 }}>
                              {pains.map((pain: string, i: number) => (
                                <Typography key={i} component="li" variant="body2" sx={{ color: 'var(--text-secondary)', mb: 0.5, lineHeight: 1.5 }}>
                                  {pain}
                                </Typography>
                              ))}
                            </Box>
                          </Box>
                        )}

                        {/* Recent Events */}
                        {news.length > 0 && (
                          <Box sx={{ mb: 2 }}>
                            <Typography variant="caption" sx={{ color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, display: 'block', mb: 0.75 }}>
                              Recent Events & Triggers
                            </Typography>
                            <Box component="ul" sx={{ pl: 2.5, m: 0 }}>
                              {news.map((item: string, i: number) => (
                                <Typography key={i} component="li" variant="body2" sx={{ color: 'var(--text-secondary)', mb: 0.5, lineHeight: 1.5 }}>
                                  {item}
                                </Typography>
                              ))}
                            </Box>
                          </Box>
                        )}

                        {/* Detected Tech Stack */}
                        {tech.length > 0 && (
                          <Box>
                            <Typography variant="caption" sx={{ color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, display: 'block', mb: 0.75 }}>
                              Detected Tech Stack & Systems
                            </Typography>
                            <Stack direction="row" spacing={0.75} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
                              {tech.map((t: string, i: number) => (
                                <Chip
                                  key={i}
                                  size="small"
                                  label={t}
                                  sx={{
                                    bgcolor: 'var(--bg-surface-subtle)',
                                    border: '1px solid var(--border-subtle)',
                                    color: 'var(--text-primary)',
                                    fontSize: '0.6875rem',
                                  }}
                                />
                              ))}
                            </Stack>
                          </Box>
                        )}
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </Stack>
          </Grid>

          {/* Right Column: Linked Leads & Contacts */}
          <Grid size={{ xs: 12, md: 5 }}>
            <Stack spacing={3}>
              {/* Linked Leads Card */}
              <Card
                sx={{
                  bgcolor: 'var(--bg-surface)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-md)',
                  boxShadow: 'var(--shadow-card)',
                }}
              >
                <CardContent sx={{ p: 3, '&:last-child': { pb: 3 } }}>
                  <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="h3" sx={{ color: 'var(--text-primary)' }}>
                      Linked Pipeline Leads
                    </Typography>
                    <Chip
                      size="small"
                      label={`${linkedLeads.length}`}
                      sx={{
                        bgcolor: 'var(--bg-surface-subtle)',
                        border: '1px solid var(--border-subtle)',
                        color: 'var(--text-secondary)',
                        fontWeight: 600,
                      }}
                    />
                  </Stack>

                  {linkedLeads.length === 0 ? (
                    <Box sx={{ p: 2, textAlign: 'center', bgcolor: 'var(--bg-surface-subtle)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                      <Typography variant="body2" sx={{ color: 'var(--text-muted)' }}>
                        No pipeline leads created for this account yet.
                      </Typography>
                    </Box>
                  ) : (
                    <Stack spacing={1.5}>
                      {linkedLeads.map((lead) => (
                        <Box
                          key={lead.id}
                          component={Link}
                          href={`/leads/${lead.id}`}
                          sx={{
                            p: 2,
                            borderRadius: 'var(--radius-sm)',
                            bgcolor: 'var(--bg-surface-subtle)',
                            border: '1px solid var(--border-default)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            transition: 'var(--transition-default)',
                            textDecoration: 'none',
                            '&:hover': {
                              bgcolor: 'var(--bg-surface-hover)',
                              borderColor: 'var(--border-strong)',
                            },
                          }}
                        >
                          <Box>
                            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                              <Typography variant="body2" fontWeight={600} sx={{ color: 'var(--text-primary)' }}>
                                Lead #{lead.id.substring(0, 8)}
                              </Typography>
                              {getLeadStatusBadge(lead.status)}
                            </Stack>
                            {lead.primaryContact && (
                              <Typography variant="caption" sx={{ color: 'var(--text-secondary)', mt: 0.5, display: 'block' }}>
                                Contact: {lead.primaryContact.firstName} ({lead.primaryContact.email})
                              </Typography>
                            )}
                          </Box>

                          <Box sx={{ textAlign: 'right' }}>
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
                            <Typography variant="caption" sx={{ color: 'var(--accent-primary-light)', display: 'block', mt: 0.25 }}>
                              Inspect →
                            </Typography>
                          </Box>
                        </Box>
                      ))}
                    </Stack>
                  )}
                </CardContent>
              </Card>

              {/* Key Contacts Directory Card */}
              <Card
                sx={{
                  bgcolor: 'var(--bg-surface)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-md)',
                  boxShadow: 'var(--shadow-card)',
                }}
              >
                <CardContent sx={{ p: 3, '&:last-child': { pb: 3 } }}>
                  <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="h3" sx={{ color: 'var(--text-primary)' }}>
                      Account Contacts
                    </Typography>
                    <Chip
                      size="small"
                      label={`${contacts.length}`}
                      sx={{
                        bgcolor: 'var(--bg-surface-subtle)',
                        border: '1px solid var(--border-subtle)',
                        color: 'var(--text-secondary)',
                        fontWeight: 600,
                      }}
                    />
                  </Stack>

                  {contacts.length === 0 ? (
                    <Box sx={{ p: 2, textAlign: 'center', bgcolor: 'var(--bg-surface-subtle)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                      <Typography variant="body2" sx={{ color: 'var(--text-muted)' }}>
                        No contacts registered for this company.
                      </Typography>
                    </Box>
                  ) : (
                    <Stack spacing={1.5}>
                      {contacts.map((c) => (
                        <Box
                          key={c.id}
                          sx={{
                            p: 2,
                            borderRadius: 'var(--radius-sm)',
                            bgcolor: 'var(--bg-surface-subtle)',
                            border: '1px solid var(--border-subtle)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}
                        >
                          <Box>
                            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                              <Typography variant="body2" fontWeight={600} sx={{ color: 'var(--text-primary)' }}>
                                {c.firstName} {c.lastName || ''}
                              </Typography>
                              {c.isPrimary && (
                                <Chip
                                  size="small"
                                  label="PRIMARY"
                                  sx={{
                                    bgcolor: 'var(--accent-success-muted)',
                                    border: '1px solid rgba(16, 185, 129, 0.3)',
                                    color: '#34d399',
                                    fontWeight: 700,
                                    fontSize: '0.625rem',
                                    height: 18,
                                  }}
                                />
                              )}
                            </Stack>
                            {c.title && (
                              <Typography variant="caption" sx={{ color: 'var(--text-secondary)', mt: 0.25, display: 'block' }}>
                                {c.title}
                              </Typography>
                            )}
                          </Box>

                          <Box sx={{ textAlign: 'right' }}>
                            <Typography variant="caption" sx={{ color: 'var(--accent-info)', display: 'block' }}>
                              {c.email}
                            </Typography>
                            {c.phone && (
                              <Typography variant="caption" sx={{ color: 'var(--text-muted)' }}>
                                {c.phone}
                              </Typography>
                            )}
                          </Box>
                        </Box>
                      ))}
                    </Stack>
                  )}
                </CardContent>
              </Card>

              {/* Honest System Architecture Callout */}
              <Box
                sx={{
                  p: 2,
                  borderRadius: 'var(--radius-md)',
                  bgcolor: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <Typography variant="caption" sx={{ color: 'var(--text-muted)', display: 'block', lineHeight: 1.5 }}>
                  <strong>Account Intelligence Policy:</strong> Companies in the AI Employee Control Center can hold zero, one, or multiple research dossiers as market signals evolve over time. Research dossiers may exist independently of active sales leads.
                </Typography>
              </Box>
            </Stack>
          </Grid>
        </Grid>
      </Box>
    </Box>
  );
}

