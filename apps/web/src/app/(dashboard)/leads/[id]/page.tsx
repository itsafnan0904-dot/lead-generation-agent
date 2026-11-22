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
import { DealSection, DealItem } from './deal-section';
import { LeadPriority } from '@/components/lead-priority';
import { StatusDot, LeadStatus } from '@/components/ui';

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

  const [leadRes, reviewsRes, draftsRes, briefRes, dealsRes] = await Promise.all([
    serverApiFetch<LeadDetailData>(`/leads/${leadId}`),
    serverApiFetch<HumanReviewsResponse>(`/human-reviews?leadId=${leadId}`),
    serverApiFetch<OutreachDraftsResponse>(`/outreach?leadId=${leadId}`),
    serverApiFetch<HandoffBriefData>(`/leads/${leadId}/handoff`),
    serverApiFetch<DealItem[]>(`/leads/${leadId}/projects`),
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
    if (status === 'RESTRICTED') return <StatusDot tone="blocked">Policy restricted</StatusDot>;
    if (controlState === 'PAUSED') return <StatusDot tone="paused">AI paused</StatusDot>;
    if (controlState === 'TAKEN_OVER') return <StatusDot tone="turn">You are handling this</StatusDot>;
    return <StatusDot tone="active">AI active</StatusDot>;
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, bgcolor: '#141415', minHeight: '100vh' }}>
      <Header title={`Lead: ${lead.company.name}`} />

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

        <DealSection leadId={lead.id} status={lead.status} deals={dealsRes.data ?? []} />

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
              color: '#a1a1a6',
              textTransform: 'none',
              fontSize: '0.8125rem',
              p: 0,
              '&:hover': { color: '#ededed' },
            }}
          >
            Back to leads
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
              bgcolor: 'rgba(229, 72, 77, 0.08)',
              border: '1px solid rgba(237, 237, 237, 0.09)',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 2,
            }}
          >
            <Box sx={{ color: '#ee7378', mt: 0.25 }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </Box>
            <Box>
              <Typography variant="body1" fontWeight={600} sx={{ color: '#ee7378', mb: 0.5, fontSize: '0.875rem', }}>
                COMPLIANCE RESTRICTION ACTIVE — OUTREACH BLOCKED
              </Typography>
              <Typography variant="body2" sx={{ color: '#ededed', lineHeight: 1.5, fontSize: '0.8125rem' }}>
                This prospect is restricted by internal compliance policy. All autonomous AI outreach and drafting actions are suppressed.
              </Typography>
            </Box>
          </Box>
        ) : hasPendingReview ? (
          <Box
            sx={{
              p: 2.5,
              borderRadius: '8px',
              bgcolor: 'rgba(227, 169, 77, 0.08)',
              border: '1px solid rgba(237, 237, 237, 0.09)',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 2,
            }}
          >
            <Box sx={{ color: '#e3a94d', mt: 0.25 }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </Box>
            <Box>
              <Typography variant="body1" fontWeight={600} sx={{ color: '#e3a94d', mb: 0.5, fontSize: '0.875rem', }}>
                Review needed. Outreach is paused
              </Typography>
              <Typography variant="body2" sx={{ color: '#ededed', lineHeight: 1.5, fontSize: '0.8125rem' }}>
                Trigger Reason: <strong>{pendingReview.triggerReason}</strong>. Automated outreach is paused pending manager clearance.
              </Typography>
            </Box>
          </Box>
        ) : null}

        {/* NARRATIVE SECTION 1 & 2: COMPANY OVERVIEW & PRIMARY CONTACT */}
        <Card sx={{ bgcolor: '#19191b', border: '1px solid rgba(237, 237, 237, 0.09)', borderRadius: '12px' }}>
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
                  <Typography variant="h1" sx={{ color: '#ededed', fontSize: '1.25rem', fontWeight: 500, }}>
                    {lead.company.name}
                  </Typography>
                  <LeadStatus status={lead.status} />
                </Stack>
                {lead.company.domain && (
                  <Typography variant="body2" sx={{ color: '#86a9f2', mt: 0.5, fontSize: '0.8125rem' }}>
                    {lead.company.domain}
                  </Typography>
                )}
              </Box>
              <Box>{renderAIControlStateBadge(lead.aiControlState, lead.status)}</Box>
            </Stack>

            <Divider sx={{ mb: 2.5, borderColor: 'rgba(237, 237, 237, 0.06)' }} />

            <Grid container spacing={3}>
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <Typography variant="subtitle2" sx={{ color: '#a1a1a6', fontSize: '0.8125rem', fontWeight: 500 }}>
                  Primary contact
                </Typography>
                {lead.primaryContact ? (
                  <Box sx={{ mt: 0.5 }}>
                    <Typography variant="body2" fontWeight={600} sx={{ color: '#ededed', fontSize: '0.875rem' }}>
                      {lead.primaryContact.firstName} {lead.primaryContact.lastName || ''}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#86a9f2', display: 'block', fontSize: '0.75rem' }}>
                      {lead.primaryContact.email}
                    </Typography>
                  </Box>
                ) : (
                  <Typography variant="body2" sx={{ color: '#85858b', mt: 0.5, fontSize: '0.8125rem' }}>
                    No contact assigned
                  </Typography>
                )}
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <Typography variant="subtitle2" sx={{ color: '#a1a1a6', fontSize: '0.8125rem', fontWeight: 500 }}>
                  Industry and location
                </Typography>
                <Typography variant="body2" sx={{ color: '#ededed', mt: 0.5, fontSize: '0.875rem' }}>
                  {lead.company.industry || 'General Industry'}
                </Typography>
                <Typography variant="caption" sx={{ color: '#85858b', fontSize: '0.75rem' }}>
                  {lead.company.location || 'Location unspecified'}
                </Typography>
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <Typography variant="subtitle2" sx={{ color: '#a1a1a6', fontSize: '0.8125rem', fontWeight: 500 }}>
                  Total lead score
                </Typography>
                <Typography
                  variant="h3"
                  fontWeight={600}
                  sx={{
                    color: lead.scoreTotal >= 70 ? '#4cc38a' : lead.scoreTotal >= 50 ? '#e3a94d' : '#ededed',
                    mt: 0.5,
                    fontSize: '1.25rem',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {lead.scoreTotal}
                  <span style={{ fontSize: '0.75rem', color: '#85858b', fontWeight: 400 }}>/100</span>
                </Typography>
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <Typography variant="subtitle2" sx={{ color: '#a1a1a6', fontSize: '0.8125rem', fontWeight: 500 }}>
                  Created date
                </Typography>
                <Typography variant="body2" sx={{ color: '#ededed', mt: 0.5, fontSize: '0.875rem', fontVariantNumeric: 'tabular-nums' }}>
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
            <Card sx={{ height: '100%', bgcolor: '#19191b', border: '1px solid rgba(237, 237, 237, 0.09)', borderRadius: '12px' }}>
              <CardContent sx={{ p: 3, '&:last-child': { pb: 3 } }}>
                <Typography variant="h3" sx={{ color: '#ededed', mb: 1, fontSize: '0.9375rem', fontWeight: 500, }}>
                  5-Factor Qualification Scoring
                </Typography>
                <Stack spacing={2}>
                  <Box>
                    <Stack direction="row" spacing={1.5} sx={{ justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography variant="body2" sx={{ color: '#ededed', fontSize: '0.8125rem' }}>
                        Service and capabilities match
                      </Typography>
                      <Typography variant="body2" fontWeight={600} sx={{ color: '#ededed', fontSize: '0.8125rem', fontVariantNumeric: 'tabular-nums' }}>
                        {lead.scoreServiceMatch} / 40
                      </Typography>
                    </Stack>
                    <LinearProgress
                      variant="determinate"
                      value={(lead.scoreServiceMatch / 40) * 100}
                      sx={{ height: 5, borderRadius: '4px', bgcolor: 'rgba(237, 237, 237, 0.06)', '& .MuiLinearProgress-bar': { bgcolor: '#3d6fd8' } }}
                    />
                  </Box>
                  <Box>
                    <Stack direction="row" spacing={1.5} sx={{ justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography variant="body2" sx={{ color: '#ededed', fontSize: '0.8125rem' }}>
                        Company size and market relevance
                      </Typography>
                      <Typography variant="body2" fontWeight={600} sx={{ color: '#ededed', fontSize: '0.8125rem', fontVariantNumeric: 'tabular-nums' }}>
                        {lead.scoreCompanyRelevance} / 20
                      </Typography>
                    </Stack>
                    <LinearProgress
                      variant="determinate"
                      value={(lead.scoreCompanyRelevance / 20) * 100}
                      sx={{ height: 5, borderRadius: '4px', bgcolor: 'rgba(237, 237, 237, 0.06)', '& .MuiLinearProgress-bar': { bgcolor: '#3d6fd8' } }}
                    />
                  </Box>
                  <Box>
                    <Stack direction="row" spacing={1.5} sx={{ justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography variant="body2" sx={{ color: '#ededed', fontSize: '0.8125rem' }}>
                        Decision maker and contact quality
                      </Typography>
                      <Typography variant="body2" fontWeight={600} sx={{ color: '#ededed', fontSize: '0.8125rem', fontVariantNumeric: 'tabular-nums' }}>
                        {lead.scoreContactQuality} / 15
                      </Typography>
                    </Stack>
                    <LinearProgress
                      variant="determinate"
                      value={(lead.scoreContactQuality / 15) * 100}
                      sx={{ height: 5, borderRadius: '4px', bgcolor: 'rgba(237, 237, 237, 0.06)', '& .MuiLinearProgress-bar': { bgcolor: '#3d6fd8' } }}
                    />
                  </Box>
                  <Box>
                    <Stack direction="row" spacing={1.5} sx={{ justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography variant="body2" sx={{ color: '#ededed', fontSize: '0.8125rem' }}>
                        Project and intent potential
                      </Typography>
                      <Typography variant="body2" fontWeight={600} sx={{ color: '#ededed', fontSize: '0.8125rem', fontVariantNumeric: 'tabular-nums' }}>
                        {lead.scoreProjectPotential} / 15
                      </Typography>
                    </Stack>
                    <LinearProgress
                      variant="determinate"
                      value={(lead.scoreProjectPotential / 15) * 100}
                      sx={{ height: 5, borderRadius: '4px', bgcolor: 'rgba(237, 237, 237, 0.06)', '& .MuiLinearProgress-bar': { bgcolor: '#3d6fd8' } }}
                    />
                  </Box>
                  <Box>
                    <Stack direction="row" spacing={1.5} sx={{ justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography variant="body2" sx={{ color: '#ededed', fontSize: '0.8125rem' }}>
                        Geographic and timezone alignment
                      </Typography>
                      <Typography variant="body2" fontWeight={600} sx={{ color: '#ededed', fontSize: '0.8125rem', fontVariantNumeric: 'tabular-nums' }}>
                        {lead.scoreLocationMatch} / 10
                      </Typography>
                    </Stack>
                    <LinearProgress
                      variant="determinate"
                      value={(lead.scoreLocationMatch / 10) * 100}
                      sx={{ height: 5, borderRadius: '4px', bgcolor: 'rgba(237, 237, 237, 0.06)', '& .MuiLinearProgress-bar': { bgcolor: '#3d6fd8' } }}
                    />
                  </Box>
                </Stack>
                {lead.scoreBreakdownReason && (
                  <Box sx={{ mt: 2.5, p: 2, borderRadius: '8px', bgcolor: '#1e1e20', border: '1px solid rgba(237, 237, 237, 0.06)' }}>
                    <Typography variant="caption" sx={{ color: '#a1a1a6', fontWeight: 500, display: 'block', mb: 0.5, fontSize: '0.75rem' }}>
                      AI Evaluation Rationale
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#a1a1a6', fontSize: '0.8125rem', lineHeight: 1.5 }}>
                      {typeof lead.scoreBreakdownReason === 'string' ? lead.scoreBreakdownReason : JSON.stringify(lead.scoreBreakdownReason)}
                    </Typography>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <Stack spacing={2.5}>
              <Card sx={{ bgcolor: '#19191b', border: '1px solid rgba(237, 237, 237, 0.09)', borderRadius: '12px' }}>
                <CardContent sx={{ p: 3, '&:last-child': { pb: 3 } }}>
                  <Typography variant="h3" sx={{ color: '#ededed', mb: 1, fontSize: '0.9375rem', fontWeight: 500, }}>
                    Company research summary
                  </Typography>
                  {lead.research && lead.research.length > 0 && lead.research[0].companySummary ? (
                    <Box sx={{ mt: 1 }}>
                      <Typography variant="body2" sx={{ color: '#a1a1a6', lineHeight: 1.6, mb: 2, fontSize: '0.8125rem' }}>
                        {lead.research[0].companySummary}
                      </Typography>
                      {lead.research[0].keyInsights && Array.isArray(lead.research[0].keyInsights) && lead.research[0].keyInsights.length > 0 && (
                        <Box sx={{ mb: 1 }}>
                          <Typography variant="caption" sx={{ color: '#a1a1a6', fontWeight: 500, display: 'block', mb: 0.5, fontSize: '0.75rem', }}>
                            Key insights
                          </Typography>
                          <Box component="ul" sx={{ pl: 2, m: 0 }}>
                            {lead.research[0].keyInsights.map((insight: string, idx: number) => (
                              <Typography key={idx} component="li" variant="caption" sx={{ color: '#a1a1a6', mb: 0.25, fontSize: '0.75rem' }}>
                                {insight}
                              </Typography>
                            ))}
                          </Box>
                        </Box>
                      )}
                    </Box>
                  ) : (
                    <Typography variant="body2" sx={{ color: '#85858b', mt: 1, fontSize: '0.8125rem' }}>
                      No automated intelligence research conducted yet.
                    </Typography>
                  )}
                </CardContent>
              </Card>

              {/* NARRATIVE SECTION 5: HUMAN GOVERNANCE REVIEW LOG */}
              {humanReviews.length > 0 && (
                <Card sx={{ bgcolor: '#19191b', border: '1px solid rgba(237, 237, 237, 0.09)', borderRadius: '12px' }}>
                  <CardContent sx={{ p: 3, '&:last-child': { pb: 3 } }}>
                    <Typography variant="h3" sx={{ color: '#ededed', mb: 1.5, fontSize: '0.9375rem', fontWeight: 500, }}>
                      Review log
                    </Typography>
                    <Stack spacing={1.25}>
                      {humanReviews.map((rev) => (
                        <Box
                          key={rev.id}
                          sx={{
                            p: 2,
                            borderRadius: '8px',
                            bgcolor: '#1e1e20',
                            border: '1px solid rgba(237, 237, 237, 0.06)',
                          }}
                        >
                          <Stack direction="row" spacing={1} sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                            <Box
                              sx={{
                                px: 0.85,
                                py: 0.2,
                                borderRadius: '4px',
                                bgcolor: rev.status === 'APPROVED' ? 'rgba(76, 195, 138, 0.10)' : rev.status === 'REJECTED' ? 'rgba(229, 72, 77, 0.10)' : 'rgba(227, 169, 77, 0.10)',
                                color: rev.status === 'APPROVED' ? '#4cc38a' : rev.status === 'REJECTED' ? '#ee7378' : '#e3a94d',
                                fontSize: '0.75rem',
                                fontWeight: 500,
                              }}
                            >
                              {rev.status}
                            </Box>
                            <Typography variant="caption" sx={{ color: '#85858b', fontSize: '0.75rem', fontVariantNumeric: 'tabular-nums' }}>
                              {new Date(rev.createdAt).toLocaleString(undefined, {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </Typography>
                          </Stack>
                          <Typography variant="body2" fontWeight={600} sx={{ color: '#ededed', mb: 0.5, fontSize: '0.8125rem' }}>
                            Trigger Reason: {rev.triggerReason}
                          </Typography>
                          {rev.resolutionJustification && (
                            <Typography variant="body2" sx={{ color: '#a1a1a6', fontSize: '0.8125rem', mt: 0.5 }}>
                              <strong>Resolution Justification:</strong> {rev.resolutionJustification}
                            </Typography>
                          )}
                          {rev.resolvedByUser && (
                            <Typography variant="caption" sx={{ color: '#85858b', display: 'block', mt: 0.5, fontSize: '0.75rem' }}>
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

