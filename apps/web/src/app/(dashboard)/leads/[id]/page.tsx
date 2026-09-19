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
import LinearProgress from '@mui/material/LinearProgress';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import { Header } from '@/components/header';
import { serverApiFetch } from '@/lib/server-api-client';
import { LeadActionButtons } from './lead-actions';
import { LeadOutreachSection, OutreachDraftItem } from './lead-outreach-section';

interface LeadDetailData {
  id: string;
  status: string;
  aiControlState: 'AI_ACTIVE' | 'PAUSED' | 'TAKEN_OVER';
  scoreTotal: number;
  scoreServiceMatch: number;
  scoreCompanyRelevance: number;
  scoreContactQuality: number;
  scoreProjectPotential: number;
  scoreLocationMatch: number;
  scoreBreakdownReason?: any;
  metadata?: any;
  createdAt: string;
  updatedAt: string;
  company: {
    id: string;
    name: string;
    domain?: string;
    industry?: string;
    size?: string;
    location?: string;
    website?: string;
    linkedinUrl?: string;
  };
  primaryContact?: {
    id: string;
    firstName: string;
    lastName?: string;
    email: string;
    title?: string;
    phone?: string;
  } | null;
  research?: Array<{
    id: string;
    companySummary?: string;
    keyInsights?: any;
    techStack?: any;
    painPoints?: any;
    completedAt?: string;
  }>;
}

interface HumanReviewItem {
  id: string;
  leadId: string;
  status: 'PENDING' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED' | 'ESCALATED';
  triggerSource: string;
  triggerReason: string;
  resolutionJustification?: string;
  resolvedAt?: string;
  resolvedByUser?: { name: string; email: string };
  createdAt: string;
}

interface HumanReviewsResponse {
  items: HumanReviewItem[];
  total: number;
}

interface OutreachDraftsResponse {
  items: OutreachDraftItem[];
  total: number;
}

export default async function LeadDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const leadId = params.id;

  const [leadRes, reviewsRes, draftsRes] = await Promise.all([
    serverApiFetch<LeadDetailData>(`/leads/${leadId}`),
    serverApiFetch<HumanReviewsResponse>(`/human-reviews?leadId=${leadId}`),
    serverApiFetch<OutreachDraftsResponse>(`/outreach?leadId=${leadId}`),
  ]);

  if (!leadRes.data || leadRes.status === 404) {
    notFound();
  }

  const lead = leadRes.data;
  const humanReviews = reviewsRes.data?.items || [];
  const pendingReview = humanReviews.find((r) => r.status === 'PENDING');
  const drafts = draftsRes.data?.items || [];

  const isRestricted = lead.status === 'RESTRICTED';
  const hasPendingReview = !!pendingReview;

  const renderAIControlStateBadge = (controlState: string, status: string) => {
    if (status === 'RESTRICTED') {
      return (
        <Box
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 1,
            px: 1.5,
            py: 0.5,
            borderRadius: 'var(--radius-full)',
            bgcolor: 'var(--accent-danger-muted)',
            border: '1px solid rgba(244, 63, 94, 0.3)',
            color: '#fb7185',
            fontWeight: 600,
            fontSize: '0.75rem',
          }}
        >
          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#fb7185' }} />
          POLICY RESTRICTED
        </Box>
      );
    }
    if (controlState === 'PAUSED') {
      return (
        <Box
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 1,
            px: 1.5,
            py: 0.5,
            borderRadius: 'var(--radius-full)',
            bgcolor: 'var(--accent-warning-muted)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            color: '#fbbf24',
            fontWeight: 600,
            fontSize: '0.75rem',
          }}
        >
          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#fbbf24' }} />
          AI PAUSED
        </Box>
      );
    }
    if (controlState === 'TAKEN_OVER') {
      return (
        <Box
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 1,
            px: 1.5,
            py: 0.5,
            borderRadius: 'var(--radius-full)',
            bgcolor: 'var(--accent-primary-muted)',
            border: '1px solid rgba(99, 102, 241, 0.3)',
            color: 'var(--accent-primary-light)',
            fontWeight: 600,
            fontSize: '0.75rem',
          }}
        >
          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'var(--accent-primary)' }} />
          HUMAN TAKEOVER ACTIVE
        </Box>
      );
    }
    return (
      <Box
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 1,
          px: 1.5,
          py: 0.5,
          borderRadius: 'var(--radius-full)',
          bgcolor: 'var(--accent-success-muted)',
          border: '1px solid rgba(16, 185, 129, 0.3)',
          color: '#34d399',
          fontWeight: 600,
          fontSize: '0.75rem',
        }}
      >
        <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#34d399' }} />
        AUTONOMOUS AI ACTIVE
      </Box>
    );
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      <Header title={`Lead Workspace: ${lead.company.name}`} />

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
            href="/leads"
            variant="text"
            size="small"
            sx={{
              color: 'var(--text-secondary)',
              textTransform: 'none',
              p: 0,
              '&:hover': { color: 'var(--text-primary)' },
            }}
          >
            ← Back to Leads Directory
          </Button>

          <LeadActionButtons
            leadId={lead.id}
            currentStatus={lead.status}
            currentAIState={lead.aiControlState}
            pendingReviewId={pendingReview?.id}
          />
        </Stack>

        {isRestricted ? (
          <Box
            sx={{
              p: 2.5,
              borderRadius: 'var(--radius-md)',
              bgcolor: 'var(--accent-danger-muted)',
              border: '1px solid rgba(244, 63, 94, 0.3)',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 2,
            }}
          >
            <Box sx={{ color: '#fb7185', mt: 0.25 }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </Box>
            <Box>
              <Typography variant="body1" fontWeight={700} sx={{ color: '#fb7185', mb: 0.5 }}>
                COMPLIANCE RESTRICTION ACTIVE — OUTREACH BLOCKED
              </Typography>
              <Typography variant="body2" sx={{ color: 'var(--text-primary)', lineHeight: 1.5 }}>
                This prospect is restricted by internal compliance policy. All autonomous AI outreach and drafting actions are suppressed.
              </Typography>
            </Box>
          </Box>
        ) : hasPendingReview ? (
          <Box
            sx={{
              p: 2.5,
              borderRadius: 'var(--radius-md)',
              bgcolor: 'var(--accent-warning-muted)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 2,
            }}
          >
            <Box sx={{ color: '#fbbf24', mt: 0.25 }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </Box>
            <Box>
              <Typography variant="body1" fontWeight={700} sx={{ color: '#fbbf24', mb: 0.5 }}>
                HUMAN GOVERNANCE REVIEW REQUIRED — OUTREACH PAUSED
              </Typography>
              <Typography variant="body2" sx={{ color: 'var(--text-primary)', lineHeight: 1.5 }}>
                Trigger Reason: <strong>{pendingReview.triggerReason}</strong>. Automated outreach is paused.
              </Typography>
            </Box>
          </Box>
        ) : null}

        <Card sx={{ bgcolor: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)' }}>
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
                    {lead.company.name}
                  </Typography>
                  <Box
                    sx={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 0.75,
                      px: 1,
                      py: 0.35,
                      borderRadius: 'var(--radius-sm)',
                      bgcolor:
                        lead.status === 'RESTRICTED'
                          ? 'var(--accent-danger-muted)'
                          : lead.status === 'HUMAN_REVIEW'
                            ? 'var(--accent-warning-muted)'
                            : lead.status === 'QUALIFIED'
                              ? 'var(--accent-success-muted)'
                              : 'var(--bg-surface-subtle)',
                      border:
                        lead.status === 'RESTRICTED'
                          ? '1px solid rgba(244, 63, 94, 0.3)'
                          : lead.status === 'HUMAN_REVIEW'
                            ? '1px solid rgba(245, 158, 11, 0.3)'
                            : lead.status === 'QUALIFIED'
                              ? '1px solid rgba(16, 185, 129, 0.3)'
                              : '1px solid var(--border-subtle)',
                      color:
                        lead.status === 'RESTRICTED'
                          ? '#fb7185'
                          : lead.status === 'HUMAN_REVIEW'
                            ? '#fbbf24'
                            : lead.status === 'QUALIFIED'
                              ? '#34d399'
                              : 'var(--text-secondary)',
                      fontSize: '0.6875rem',
                      fontWeight: 700,
                      letterSpacing: '0.04em',
                      textTransform: 'uppercase',
                    }}
                  >
                    <span>{lead.status.replace(/_/g, ' ')}</span>
                  </Box>
                </Stack>
                {lead.company.domain && (
                  <Typography variant="body2" sx={{ color: 'var(--accent-info)', mt: 0.5 }}>
                    {lead.company.domain}
                  </Typography>
                )}
              </Box>
              <Box>{renderAIControlStateBadge(lead.aiControlState, lead.status)}</Box>
            </Stack>

            <Divider sx={{ mb: 2.5, borderColor: 'var(--border-subtle)' }} />

            <Grid container spacing={3}>
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <Typography variant="subtitle2" sx={{ color: 'var(--text-secondary)' }}>
                  Primary Contact
                </Typography>
                {lead.primaryContact ? (
                  <Box sx={{ mt: 0.5 }}>
                    <Typography variant="body2" fontWeight={600} sx={{ color: 'var(--text-primary)' }}>
                      {lead.primaryContact.firstName} {lead.primaryContact.lastName || ''}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'var(--accent-info)', display: 'block' }}>
                      {lead.primaryContact.email}
                    </Typography>
                  </Box>
                ) : (
                  <Typography variant="body2" sx={{ color: 'var(--text-muted)', mt: 0.5 }}>
                    No contact assigned
                  </Typography>
                )}
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <Typography variant="subtitle2" sx={{ color: 'var(--text-secondary)' }}>
                  Industry & Location
                </Typography>
                <Typography variant="body2" sx={{ color: 'var(--text-primary)', mt: 0.5 }}>
                  {lead.company.industry || 'General Industry'}
                </Typography>
                <Typography variant="caption" sx={{ color: 'var(--text-muted)' }}>
                  {lead.company.location || 'Location unspecified'}
                </Typography>
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <Typography variant="subtitle2" sx={{ color: 'var(--text-secondary)' }}>
                  Total Lead Score
                </Typography>
                <Typography
                  variant="h3"
                  fontWeight={700}
                  sx={{
                    color: lead.scoreTotal >= 70 ? '#34d399' : lead.scoreTotal >= 50 ? '#fbbf24' : 'var(--text-primary)',
                    mt: 0.5,
                  }}
                >
                  {lead.scoreTotal}
                  <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)', fontWeight: 400 }}>/100</span>
                </Typography>
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <Typography variant="subtitle2" sx={{ color: 'var(--text-secondary)' }}>
                  Created Date
                </Typography>
                <Typography variant="body2" sx={{ color: 'var(--text-primary)', mt: 0.5 }}>
                  {new Date(lead.createdAt).toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                </Typography>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 6 }}>
            <Card sx={{ height: '100%', bgcolor: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)' }}>
              <CardContent sx={{ p: 3, '&:last-child': { pb: 3 } }}>
                <Typography variant="h3" sx={{ color: 'var(--text-primary)', mb: 0.5 }}>
                  5-Factor Qualification Scoring
                </Typography>
                <Stack spacing={2.5}>
                  <Box>
                    <Stack direction="row" spacing={1.5} sx={{ justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography variant="body2" sx={{ color: 'var(--text-primary)' }}>
                        Service & Capabilities Match
                      </Typography>
                      <Typography variant="body2" fontWeight={600} sx={{ color: 'var(--text-primary)' }}>
                        {lead.scoreServiceMatch} / 40
                      </Typography>
                    </Stack>
                    <LinearProgress
                      variant="determinate"
                      value={(lead.scoreServiceMatch / 40) * 100}
                      sx={{ height: 6, borderRadius: 'var(--radius-full)', bgcolor: 'rgba(255, 255, 255, 0.05)' }}
                    />
                  </Box>
                  <Box>
                    <Stack direction="row" spacing={1.5} sx={{ justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography variant="body2" sx={{ color: 'var(--text-primary)' }}>
                        Company Size & Market Relevance
                      </Typography>
                      <Typography variant="body2" fontWeight={600} sx={{ color: 'var(--text-primary)' }}>
                        {lead.scoreCompanyRelevance} / 20
                      </Typography>
                    </Stack>
                    <LinearProgress
                      variant="determinate"
                      value={(lead.scoreCompanyRelevance / 20) * 100}
                      sx={{ height: 6, borderRadius: 'var(--radius-full)', bgcolor: 'rgba(255, 255, 255, 0.05)' }}
                    />
                  </Box>
                  <Box>
                    <Stack direction="row" spacing={1.5} sx={{ justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography variant="body2" sx={{ color: 'var(--text-primary)' }}>
                        Decision Maker & Contact Quality
                      </Typography>
                      <Typography variant="body2" fontWeight={600} sx={{ color: 'var(--text-primary)' }}>
                        {lead.scoreContactQuality} / 15
                      </Typography>
                    </Stack>
                    <LinearProgress
                      variant="determinate"
                      value={(lead.scoreContactQuality / 15) * 100}
                      sx={{ height: 6, borderRadius: 'var(--radius-full)', bgcolor: 'rgba(255, 255, 255, 0.05)' }}
                    />
                  </Box>
                  <Box>
                    <Stack direction="row" spacing={1.5} sx={{ justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography variant="body2" sx={{ color: 'var(--text-primary)' }}>
                        Project & Intent Potential
                      </Typography>
                      <Typography variant="body2" fontWeight={600} sx={{ color: 'var(--text-primary)' }}>
                        {lead.scoreProjectPotential} / 15
                      </Typography>
                    </Stack>
                    <LinearProgress
                      variant="determinate"
                      value={(lead.scoreProjectPotential / 15) * 100}
                      sx={{ height: 6, borderRadius: 'var(--radius-full)', bgcolor: 'rgba(255, 255, 255, 0.05)' }}
                    />
                  </Box>
                  <Box>
                    <Stack direction="row" spacing={1.5} sx={{ justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography variant="body2" sx={{ color: 'var(--text-primary)' }}>
                        Geographic & Timezone Alignment
                      </Typography>
                      <Typography variant="body2" fontWeight={600} sx={{ color: 'var(--text-primary)' }}>
                        {lead.scoreLocationMatch} / 10
                      </Typography>
                    </Stack>
                    <LinearProgress
                      variant="determinate"
                      value={(lead.scoreLocationMatch / 10) * 100}
                      sx={{ height: 6, borderRadius: 'var(--radius-full)', bgcolor: 'rgba(255, 255, 255, 0.05)' }}
                    />
                  </Box>
                </Stack>
                {lead.scoreBreakdownReason && (
                  <Box sx={{ mt: 3, p: 2, borderRadius: 'var(--radius-sm)', bgcolor: 'var(--bg-surface-subtle)', border: '1px solid var(--border-subtle)' }}>
                    <Typography variant="caption" sx={{ color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, display: 'block', mb: 0.5 }}>
                      AI Evaluation Rationale
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'var(--text-secondary)', fontSize: '0.8125rem', lineHeight: 1.5 }}>
                      {typeof lead.scoreBreakdownReason === 'string' ? lead.scoreBreakdownReason : JSON.stringify(lead.scoreBreakdownReason)}
                    </Typography>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <Stack spacing={3}>
              <Card sx={{ bgcolor: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)' }}>
                <CardContent sx={{ p: 3, '&:last-child': { pb: 3 } }}>
                  <Typography variant="h3" sx={{ color: 'var(--text-primary)', mb: 0.5 }}>
                    Company Research Summary
                  </Typography>
                  {lead.research && lead.research.length > 0 && lead.research[0].companySummary ? (
                    <Box sx={{ mt: 1.5 }}>
                      <Typography variant="body2" sx={{ color: 'var(--text-secondary)', lineHeight: 1.6, mb: 2 }}>
                        {lead.research[0].companySummary}
                      </Typography>
                      {lead.research[0].keyInsights && Array.isArray(lead.research[0].keyInsights) && lead.research[0].keyInsights.length > 0 && (
                        <Box sx={{ mb: 1.5 }}>
                          <Typography variant="caption" sx={{ color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', display: 'block', mb: 0.5 }}>
                            Key Insights
                          </Typography>
                          <Box component="ul" sx={{ pl: 2, m: 0 }}>
                            {lead.research[0].keyInsights.map((insight: string, idx: number) => (
                              <Typography key={idx} component="li" variant="caption" sx={{ color: 'var(--text-secondary)', mb: 0.25 }}>
                                {insight}
                              </Typography>
                            ))}
                          </Box>
                        </Box>
                      )}
                    </Box>
                  ) : (
                    <Typography variant="body2" sx={{ color: 'var(--text-muted)', mt: 1 }}>
                      No automated intelligence research conducted yet.
                    </Typography>
                  )}
                </CardContent>
              </Card>

              {/* Human Governance Reviews History */}
              {humanReviews.length > 0 && (
                <Card sx={{ bgcolor: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)' }}>
                  <CardContent sx={{ p: 3, '&:last-child': { pb: 3 } }}>
                    <Typography variant="h3" sx={{ color: 'var(--text-primary)', mb: 1.5 }}>
                      Governance Review Log
                    </Typography>
                    <Stack spacing={1.5}>
                      {humanReviews.map((rev) => (
                        <Box
                          key={rev.id}
                          sx={{
                            p: 2,
                            borderRadius: 'var(--radius-sm)',
                            bgcolor: 'var(--bg-surface-subtle)',
                            border: '1px solid var(--border-subtle)',
                          }}
                        >
                          <Stack direction="row" spacing={1} sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                            <Box
                              sx={{
                                px: 1,
                                py: 0.25,
                                borderRadius: 'var(--radius-sm)',
                                bgcolor: rev.status === 'APPROVED' ? 'var(--accent-success-muted)' : rev.status === 'REJECTED' ? 'var(--accent-danger-muted)' : 'var(--accent-warning-muted)',
                                color: rev.status === 'APPROVED' ? '#34d399' : rev.status === 'REJECTED' ? '#fb7185' : '#fbbf24',
                                fontSize: '0.625rem',
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                letterSpacing: '0.04em',
                              }}
                            >
                              {rev.status}
                            </Box>
                            <Typography variant="caption" sx={{ color: 'var(--text-muted)' }}>
                              {new Date(rev.createdAt).toLocaleString(undefined, {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </Typography>
                          </Stack>
                          <Typography variant="body2" fontWeight={600} sx={{ color: 'var(--text-primary)', mb: 0.5 }}>
                            Trigger Reason: {rev.triggerReason}
                          </Typography>
                          {rev.resolutionJustification && (
                            <Typography variant="body2" sx={{ color: 'var(--text-secondary)', fontSize: '0.8125rem', mt: 0.5 }}>
                              <strong>Resolution Justification:</strong> {rev.resolutionJustification}
                            </Typography>
                          )}
                          {rev.resolvedByUser && (
                            <Typography variant="caption" sx={{ color: 'var(--text-muted)', display: 'block', mt: 0.5 }}>
                              Resolved by: {rev.resolvedByUser.name} ({rev.resolvedByUser.email})
                            </Typography>
                          )}
                        </Box>
                      ))}
                    </Stack>
                  </CardContent>
                </Card>
              )}
            </Stack>
          </Grid>
        </Grid>

        {/* NARRATIVE SECTION 6 & 7: CONVERSATIONS & OUTREACH WORKSPACE */}
        <LeadOutreachSection
          leadId={lead.id}
          leadStatus={lead.status}
          primaryContactEmail={lead.primaryContact?.email}
          primaryContactName={
            lead.primaryContact
              ? `${lead.primaryContact.firstName} ${lead.primaryContact.lastName || ''}`.trim()
              : null
          }
          companyName={lead.company.name}
          initialDrafts={drafts}
        />
      </Box>
    </Box>
  );
}
