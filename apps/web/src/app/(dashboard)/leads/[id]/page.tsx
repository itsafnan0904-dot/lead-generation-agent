import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import LinearProgress from '@mui/material/LinearProgress';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import { Header } from '@/components/header';
import { serverApiFetch } from '@/lib/server-api-client';
import { LeadActionButtons } from './lead-actions';
import { LeadOutreachSection, OutreachDraftItem } from './lead-outreach-section';
import { HandoffCard, HandoffBriefData } from './handoff-card';
import { LeadPriority } from '@/components/lead-priority';

interface LeadDetailData {
  id: string;
  status: string;
  aiControlState: 'AI_ACTIVE' | 'PAUSED' | 'TAKEN_OVER';
  scoreTotal: number;
  priority?: LeadPriority;
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

  const [leadRes, reviewsRes, draftsRes, briefRes] = await Promise.all([
    serverApiFetch<LeadDetailData>(`/leads/${leadId}`),
    serverApiFetch<HumanReviewsResponse>(`/human-reviews?leadId=${leadId}`),
    serverApiFetch<OutreachDraftsResponse>(`/outreach?leadId=${leadId}`),
    serverApiFetch<HandoffBriefData>(`/leads/${leadId}/handoff`),
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
            borderRadius: '9999px',
            bgcolor: 'rgba(244, 63, 94, 0.10)',
            border: '1px solid rgba(244, 63, 94, 0.28)',
            color: '#fb7185',
            fontWeight: 600,
            fontSize: '0.71875rem',
            letterSpacing: '0.04em',
          }}
        >
          <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#fb7185' }} />
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
            borderRadius: '9999px',
            bgcolor: 'rgba(245, 158, 11, 0.10)',
            border: '1px solid rgba(245, 158, 11, 0.28)',
            color: '#fbbf24',
            fontWeight: 600,
            fontSize: '0.71875rem',
            letterSpacing: '0.04em',
          }}
        >
          <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#fbbf24' }} />
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
            borderRadius: '9999px',
            bgcolor: 'rgba(79, 70, 229, 0.12)',
            border: '1px solid rgba(99, 102, 241, 0.28)',
            color: '#818cf8',
            fontWeight: 600,
            fontSize: '0.71875rem',
            letterSpacing: '0.04em',
          }}
        >
          <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#6366f1' }} />
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
          borderRadius: '9999px',
          bgcolor: 'rgba(16, 185, 129, 0.10)',
          border: '1px solid rgba(16, 185, 129, 0.28)',
          color: '#34d399',
          fontWeight: 600,
          fontSize: '0.71875rem',
          letterSpacing: '0.04em',
        }}
      >
        <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#10b981' }} />
        AUTONOMOUS AI ACTIVE
      </Box>
    );
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, bgcolor: '#090a0f', minHeight: '100vh' }}>
      <Header title={`Lead Workspace: ${lead.company.name}`} />

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
        <HandoffCard priority={lead.priority} brief={briefRes.data} aiControlState={lead.aiControlState} />

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
            href="/leads"
            variant="text"
            size="small"
            sx={{
              color: '#9ca3af',
              textTransform: 'none',
              fontSize: '0.8125rem',
              p: 0,
              '&:hover': { color: '#f3f4f6' },
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

        {/* COMPLIANCE / REVIEW NOTICES */}
        {isRestricted ? (
          <Box
            sx={{
              p: 2.5,
              borderRadius: '8px',
              bgcolor: 'rgba(244, 63, 94, 0.08)',
              border: '1px solid rgba(244, 63, 94, 0.24)',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 2,
            }}
          >
            <Box sx={{ color: '#fb7185', mt: 0.25 }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </Box>
            <Box>
              <Typography variant="body1" fontWeight={600} sx={{ color: '#fb7185', mb: 0.5, fontSize: '0.875rem', letterSpacing: '-0.01em' }}>
                COMPLIANCE RESTRICTION ACTIVE — OUTREACH BLOCKED
              </Typography>
              <Typography variant="body2" sx={{ color: '#f3f4f6', lineHeight: 1.5, fontSize: '0.8125rem' }}>
                This prospect is restricted by internal compliance policy. All autonomous AI outreach and drafting actions are suppressed.
              </Typography>
            </Box>
          </Box>
        ) : hasPendingReview ? (
          <Box
            sx={{
              p: 2.5,
              borderRadius: '8px',
              bgcolor: 'rgba(245, 158, 11, 0.08)',
              border: '1px solid rgba(245, 158, 11, 0.24)',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 2,
            }}
          >
            <Box sx={{ color: '#fbbf24', mt: 0.25 }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </Box>
            <Box>
              <Typography variant="body1" fontWeight={600} sx={{ color: '#fbbf24', mb: 0.5, fontSize: '0.875rem', letterSpacing: '-0.01em' }}>
                HUMAN GOVERNANCE REVIEW REQUIRED — OUTREACH PAUSED
              </Typography>
              <Typography variant="body2" sx={{ color: '#f3f4f6', lineHeight: 1.5, fontSize: '0.8125rem' }}>
                Trigger Reason: <strong>{pendingReview.triggerReason}</strong>. Automated outreach is paused pending manager clearance.
              </Typography>
            </Box>
          </Box>
        ) : null}

        {/* NARRATIVE SECTION 1 & 2: COMPANY OVERVIEW & PRIMARY CONTACT */}
        <Card sx={{ bgcolor: '#111318', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '10px', boxShadow: '0 4px 20px -2px rgba(0, 0, 0, 0.6)' }}>
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
                  <Typography variant="h1" sx={{ color: '#f3f4f6', fontSize: '1.25rem', fontWeight: 600, letterSpacing: '-0.025em' }}>
                    {lead.company.name}
                  </Typography>
                  <Box
                    sx={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 0.75,
                      px: 1,
                      py: 0.35,
                      borderRadius: '6px',
                      bgcolor:
                        lead.status === 'RESTRICTED'
                          ? 'rgba(244, 63, 94, 0.10)'
                          : lead.status === 'HUMAN_REVIEW'
                            ? 'rgba(245, 158, 11, 0.10)'
                            : lead.status === 'QUALIFIED'
                              ? 'rgba(16, 185, 129, 0.10)'
                              : '#161820',
                      border:
                        lead.status === 'RESTRICTED'
                          ? '1px solid rgba(244, 63, 94, 0.28)'
                          : lead.status === 'HUMAN_REVIEW'
                            ? '1px solid rgba(245, 158, 11, 0.28)'
                            : lead.status === 'QUALIFIED'
                              ? '1px solid rgba(16, 185, 129, 0.28)'
                              : '1px solid rgba(255, 255, 255, 0.08)',
                      color:
                        lead.status === 'RESTRICTED'
                          ? '#fb7185'
                          : lead.status === 'HUMAN_REVIEW'
                            ? '#fbbf24'
                            : lead.status === 'QUALIFIED'
                              ? '#34d399'
                              : '#9ca3af',
                      fontSize: '0.6875rem',
                      fontWeight: 600,
                      letterSpacing: '0.04em',
                      textTransform: 'uppercase',
                    }}
                  >
                    <span>{lead.status.replace(/_/g, ' ')}</span>
                  </Box>
                </Stack>
                {lead.company.domain && (
                  <Typography variant="body2" sx={{ color: '#38bdf8', mt: 0.5, fontSize: '0.8125rem' }}>
                    {lead.company.domain}
                  </Typography>
                )}
              </Box>
              <Box>{renderAIControlStateBadge(lead.aiControlState, lead.status)}</Box>
            </Stack>

            <Divider sx={{ mb: 2.5, borderColor: 'rgba(255, 255, 255, 0.06)' }} />

            <Grid container spacing={3}>
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <Typography variant="subtitle2" sx={{ color: '#9ca3af', fontSize: '0.78125rem', fontWeight: 500 }}>
                  Primary Contact
                </Typography>
                {lead.primaryContact ? (
                  <Box sx={{ mt: 0.5 }}>
                    <Typography variant="body2" fontWeight={600} sx={{ color: '#f3f4f6', fontSize: '0.84375rem' }}>
                      {lead.primaryContact.firstName} {lead.primaryContact.lastName || ''}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#38bdf8', display: 'block', fontSize: '0.75rem' }}>
                      {lead.primaryContact.email}
                    </Typography>
                  </Box>
                ) : (
                  <Typography variant="body2" sx={{ color: '#64748b', mt: 0.5, fontSize: '0.8125rem' }}>
                    No contact assigned
                  </Typography>
                )}
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <Typography variant="subtitle2" sx={{ color: '#9ca3af', fontSize: '0.78125rem', fontWeight: 500 }}>
                  Industry & Location
                </Typography>
                <Typography variant="body2" sx={{ color: '#f3f4f6', mt: 0.5, fontSize: '0.84375rem' }}>
                  {lead.company.industry || 'General Industry'}
                </Typography>
                <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.75rem' }}>
                  {lead.company.location || 'Location unspecified'}
                </Typography>
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <Typography variant="subtitle2" sx={{ color: '#9ca3af', fontSize: '0.78125rem', fontWeight: 500 }}>
                  Total Lead Score
                </Typography>
                <Typography
                  variant="h3"
                  fontWeight={600}
                  sx={{
                    color: lead.scoreTotal >= 70 ? '#34d399' : lead.scoreTotal >= 50 ? '#fbbf24' : '#f3f4f6',
                    mt: 0.5,
                    fontSize: '1.25rem',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {lead.scoreTotal}
                  <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 400 }}>/100</span>
                </Typography>
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <Typography variant="subtitle2" sx={{ color: '#9ca3af', fontSize: '0.78125rem', fontWeight: 500 }}>
                  Created Date
                </Typography>
                <Typography variant="body2" sx={{ color: '#f3f4f6', mt: 0.5, fontSize: '0.84375rem', fontVariantNumeric: 'tabular-nums' }}>
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

        {/* NARRATIVE SECTION 3 & 4: 5-FACTOR QUALIFICATION SCORE & COMPANY RESEARCH */}
        <Grid container spacing={2.5}>
          <Grid size={{ xs: 12, md: 6 }}>
            <Card sx={{ height: '100%', bgcolor: '#111318', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '10px' }}>
              <CardContent sx={{ p: 3, '&:last-child': { pb: 3 } }}>
                <Typography variant="h3" sx={{ color: '#f3f4f6', mb: 1, fontSize: '0.9375rem', fontWeight: 600, letterSpacing: '-0.01em' }}>
                  5-Factor Qualification Scoring
                </Typography>
                <Stack spacing={2}>
                  <Box>
                    <Stack direction="row" spacing={1.5} sx={{ justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography variant="body2" sx={{ color: '#f3f4f6', fontSize: '0.8125rem' }}>
                        Service & Capabilities Match
                      </Typography>
                      <Typography variant="body2" fontWeight={600} sx={{ color: '#f3f4f6', fontSize: '0.8125rem', fontVariantNumeric: 'tabular-nums' }}>
                        {lead.scoreServiceMatch} / 40
                      </Typography>
                    </Stack>
                    <LinearProgress
                      variant="determinate"
                      value={(lead.scoreServiceMatch / 40) * 100}
                      sx={{ height: 5, borderRadius: '9999px', bgcolor: 'rgba(255, 255, 255, 0.05)', '& .MuiLinearProgress-bar': { bgcolor: '#4f46e5' } }}
                    />
                  </Box>
                  <Box>
                    <Stack direction="row" spacing={1.5} sx={{ justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography variant="body2" sx={{ color: '#f3f4f6', fontSize: '0.8125rem' }}>
                        Company Size & Market Relevance
                      </Typography>
                      <Typography variant="body2" fontWeight={600} sx={{ color: '#f3f4f6', fontSize: '0.8125rem', fontVariantNumeric: 'tabular-nums' }}>
                        {lead.scoreCompanyRelevance} / 20
                      </Typography>
                    </Stack>
                    <LinearProgress
                      variant="determinate"
                      value={(lead.scoreCompanyRelevance / 20) * 100}
                      sx={{ height: 5, borderRadius: '9999px', bgcolor: 'rgba(255, 255, 255, 0.05)', '& .MuiLinearProgress-bar': { bgcolor: '#4f46e5' } }}
                    />
                  </Box>
                  <Box>
                    <Stack direction="row" spacing={1.5} sx={{ justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography variant="body2" sx={{ color: '#f3f4f6', fontSize: '0.8125rem' }}>
                        Decision Maker & Contact Quality
                      </Typography>
                      <Typography variant="body2" fontWeight={600} sx={{ color: '#f3f4f6', fontSize: '0.8125rem', fontVariantNumeric: 'tabular-nums' }}>
                        {lead.scoreContactQuality} / 15
                      </Typography>
                    </Stack>
                    <LinearProgress
                      variant="determinate"
                      value={(lead.scoreContactQuality / 15) * 100}
                      sx={{ height: 5, borderRadius: '9999px', bgcolor: 'rgba(255, 255, 255, 0.05)', '& .MuiLinearProgress-bar': { bgcolor: '#4f46e5' } }}
                    />
                  </Box>
                  <Box>
                    <Stack direction="row" spacing={1.5} sx={{ justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography variant="body2" sx={{ color: '#f3f4f6', fontSize: '0.8125rem' }}>
                        Project & Intent Potential
                      </Typography>
                      <Typography variant="body2" fontWeight={600} sx={{ color: '#f3f4f6', fontSize: '0.8125rem', fontVariantNumeric: 'tabular-nums' }}>
                        {lead.scoreProjectPotential} / 15
                      </Typography>
                    </Stack>
                    <LinearProgress
                      variant="determinate"
                      value={(lead.scoreProjectPotential / 15) * 100}
                      sx={{ height: 5, borderRadius: '9999px', bgcolor: 'rgba(255, 255, 255, 0.05)', '& .MuiLinearProgress-bar': { bgcolor: '#4f46e5' } }}
                    />
                  </Box>
                  <Box>
                    <Stack direction="row" spacing={1.5} sx={{ justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography variant="body2" sx={{ color: '#f3f4f6', fontSize: '0.8125rem' }}>
                        Geographic & Timezone Alignment
                      </Typography>
                      <Typography variant="body2" fontWeight={600} sx={{ color: '#f3f4f6', fontSize: '0.8125rem', fontVariantNumeric: 'tabular-nums' }}>
                        {lead.scoreLocationMatch} / 10
                      </Typography>
                    </Stack>
                    <LinearProgress
                      variant="determinate"
                      value={(lead.scoreLocationMatch / 10) * 100}
                      sx={{ height: 5, borderRadius: '9999px', bgcolor: 'rgba(255, 255, 255, 0.05)', '& .MuiLinearProgress-bar': { bgcolor: '#4f46e5' } }}
                    />
                  </Box>
                </Stack>
                {lead.scoreBreakdownReason && (
                  <Box sx={{ mt: 2.5, p: 2, borderRadius: '6px', bgcolor: '#161820', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                    <Typography variant="caption" sx={{ color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, display: 'block', mb: 0.5, fontSize: '0.6875rem' }}>
                      AI Evaluation Rationale
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#9ca3af', fontSize: '0.8125rem', lineHeight: 1.5 }}>
                      {typeof lead.scoreBreakdownReason === 'string' ? lead.scoreBreakdownReason : JSON.stringify(lead.scoreBreakdownReason)}
                    </Typography>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <Stack spacing={2.5}>
              <Card sx={{ bgcolor: '#111318', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '10px' }}>
                <CardContent sx={{ p: 3, '&:last-child': { pb: 3 } }}>
                  <Typography variant="h3" sx={{ color: '#f3f4f6', mb: 1, fontSize: '0.9375rem', fontWeight: 600, letterSpacing: '-0.01em' }}>
                    Company Research Summary
                  </Typography>
                  {lead.research && lead.research.length > 0 && lead.research[0].companySummary ? (
                    <Box sx={{ mt: 1 }}>
                      <Typography variant="body2" sx={{ color: '#9ca3af', lineHeight: 1.6, mb: 2, fontSize: '0.8125rem' }}>
                        {lead.research[0].companySummary}
                      </Typography>
                      {lead.research[0].keyInsights && Array.isArray(lead.research[0].keyInsights) && lead.research[0].keyInsights.length > 0 && (
                        <Box sx={{ mb: 1 }}>
                          <Typography variant="caption" sx={{ color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', display: 'block', mb: 0.5, fontSize: '0.6875rem', letterSpacing: '0.04em' }}>
                            Key Insights
                          </Typography>
                          <Box component="ul" sx={{ pl: 2, m: 0 }}>
                            {lead.research[0].keyInsights.map((insight: string, idx: number) => (
                              <Typography key={idx} component="li" variant="caption" sx={{ color: '#9ca3af', mb: 0.25, fontSize: '0.75rem' }}>
                                {insight}
                              </Typography>
                            ))}
                          </Box>
                        </Box>
                      )}
                    </Box>
                  ) : (
                    <Typography variant="body2" sx={{ color: '#64748b', mt: 1, fontSize: '0.8125rem' }}>
                      No automated intelligence research conducted yet.
                    </Typography>
                  )}
                </CardContent>
              </Card>

              {/* NARRATIVE SECTION 5: HUMAN GOVERNANCE REVIEW LOG */}
              {humanReviews.length > 0 && (
                <Card sx={{ bgcolor: '#111318', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '10px' }}>
                  <CardContent sx={{ p: 3, '&:last-child': { pb: 3 } }}>
                    <Typography variant="h3" sx={{ color: '#f3f4f6', mb: 1.5, fontSize: '0.9375rem', fontWeight: 600, letterSpacing: '-0.01em' }}>
                      Governance Review Log
                    </Typography>
                    <Stack spacing={1.25}>
                      {humanReviews.map((rev) => (
                        <Box
                          key={rev.id}
                          sx={{
                            p: 2,
                            borderRadius: '6px',
                            bgcolor: '#161820',
                            border: '1px solid rgba(255, 255, 255, 0.06)',
                          }}
                        >
                          <Stack direction="row" spacing={1} sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                            <Box
                              sx={{
                                px: 0.85,
                                py: 0.2,
                                borderRadius: '4px',
                                bgcolor: rev.status === 'APPROVED' ? 'rgba(16, 185, 129, 0.10)' : rev.status === 'REJECTED' ? 'rgba(244, 63, 94, 0.10)' : 'rgba(245, 158, 11, 0.10)',
                                color: rev.status === 'APPROVED' ? '#34d399' : rev.status === 'REJECTED' ? '#fb7185' : '#fbbf24',
                                fontSize: '0.625rem',
                                fontWeight: 600,
                                textTransform: 'uppercase',
                                letterSpacing: '0.04em',
                              }}
                            >
                              {rev.status}
                            </Box>
                            <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.71875rem', fontVariantNumeric: 'tabular-nums' }}>
                              {new Date(rev.createdAt).toLocaleString(undefined, {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </Typography>
                          </Stack>
                          <Typography variant="body2" fontWeight={600} sx={{ color: '#f3f4f6', mb: 0.5, fontSize: '0.8125rem' }}>
                            Trigger Reason: {rev.triggerReason}
                          </Typography>
                          {rev.resolutionJustification && (
                            <Typography variant="body2" sx={{ color: '#9ca3af', fontSize: '0.8125rem', mt: 0.5 }}>
                              <strong>Resolution Justification:</strong> {rev.resolutionJustification}
                            </Typography>
                          )}
                          {rev.resolvedByUser && (
                            <Typography variant="caption" sx={{ color: '#64748b', display: 'block', mt: 0.5, fontSize: '0.71875rem' }}>
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

