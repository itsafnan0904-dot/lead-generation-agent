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
import Tooltip from '@mui/material/Tooltip';
import { Header } from '@/components/header';
import { serverApiFetch } from '@/lib/server-api-client';

interface AiReplyAnalysis {
  intent: 'INTERESTED' | 'NOT_INTERESTED' | 'MORE_INFO_REQUESTED' | 'OUT_OF_OFFICE' | 'OBJECTION_RAISED' | 'UNSUBSCRIBE' | 'NEUTRAL';
  sentiment: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE' | 'HOSTILE';
  suggestedLeadStage?: string;
  objectionsIdentified?: string[];
  questionsAsked?: string[];
  requiresHumanIntervention?: boolean;
  recommendedNextAction?: string;
  draftFollowUp?: string;
}

interface ThreadMessage {
  id: string;
  conversationId: string;
  gmailMessageId?: string | null;
  direction: 'INBOUND' | 'OUTBOUND';
  sender: string;
  recipient: string;
  subject?: string | null;
  bodyText: string;
  bodyHtml?: string | null;
  sentAt: string;
  metadata?: {
    snippet?: string;
    aiReplyAnalysis?: AiReplyAnalysis;
    aiActionId?: string;
  } | null;
}

interface ConversationDetailData {
  id: string;
  leadId?: string | null;
  gmailThreadId?: string | null;
  subject?: string | null;
  channel: string;
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
      industry?: string | null;
    };
    primaryContact?: {
      firstName: string;
      lastName?: string | null;
      email: string;
      title?: string | null;
    } | null;
  } | null;
  messages: ThreadMessage[];
}

export default async function ConversationDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const conversationId = params.id;

  const { data: conv, status } = await serverApiFetch<ConversationDetailData>(`/conversations/${conversationId}`);

  if (!conv || status === 404) {
    notFound();
  }

  const isUnassigned = !conv.leadId;
  const messages = conv.messages || [];

  // Render Section 10 AI Operating State Indicator
  const renderAiStateIndicator = (controlState?: string, leadStatus?: string) => {
    if (leadStatus === 'HUMAN_REVIEW') {
      return (
        <Tooltip title="Human review required before outbound transmission" arrow>
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.6,
              px: 1,
              py: 0.35,
              borderRadius: 'var(--radius-sm)',
              bgcolor: 'var(--accent-warning-muted)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              color: '#fbbf24',
              fontSize: '0.6875rem',
              fontWeight: 700,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}
          >
            <span>⚠ Review Required</span>
          </Box>
        </Tooltip>
      );
    }

    if (controlState === 'PAUSED') {
      return (
        <Tooltip title="AI autonomous agent is paused by operator" arrow>
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.6,
              px: 1,
              py: 0.35,
              borderRadius: 'var(--radius-sm)',
              bgcolor: 'var(--accent-warning-muted)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              color: '#fbbf24',
              fontSize: '0.6875rem',
              fontWeight: 700,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}
          >
            <span>Ⅱ AI Paused</span>
          </Box>
        </Tooltip>
      );
    }

    if (controlState === 'TAKEN_OVER') {
      return (
        <Tooltip title="Thread taken over by human sales representative" arrow>
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.6,
              px: 1,
              py: 0.35,
              borderRadius: 'var(--radius-sm)',
              bgcolor: 'var(--accent-primary-muted)',
              border: '1px solid rgba(99, 102, 241, 0.3)',
              color: '#818cf8',
              fontSize: '0.6875rem',
              fontWeight: 700,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}
          >
            <span>✋ Human Controlled</span>
          </Box>
        </Tooltip>
      );
    }

    if (controlState === 'AI_ACTIVE' || (!controlState && leadStatus)) {
      return (
        <Tooltip title="AI autonomous agent is actively monitoring and qualifying this thread" arrow>
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.6,
              px: 1,
              py: 0.35,
              borderRadius: 'var(--radius-sm)',
              bgcolor: 'var(--accent-success-muted)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              color: '#34d399',
              fontSize: '0.6875rem',
              fontWeight: 700,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}
          >
            <span>● Autonomous Active</span>
          </Box>
        </Tooltip>
      );
    }

    return null;
  };

  const getIntentChip = (intent: string) => {
    switch (intent) {
      case 'INTERESTED':
        return (
          <Chip
            size="small"
            label="INTERESTED"
            sx={{
              bgcolor: 'var(--accent-success-muted)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              color: '#34d399',
              fontWeight: 700,
              fontSize: '0.6875rem',
            }}
          />
        );
      case 'MORE_INFO_REQUESTED':
        return (
          <Chip
            size="small"
            label="INFO REQUESTED"
            sx={{
              bgcolor: 'var(--accent-info-muted)',
              border: '1px solid rgba(14, 165, 233, 0.3)',
              color: '#38bdf8',
              fontWeight: 700,
              fontSize: '0.6875rem',
            }}
          />
        );
      case 'OBJECTION_RAISED':
        return (
          <Chip
            size="small"
            label="OBJECTION"
            sx={{
              bgcolor: 'var(--accent-warning-muted)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              color: '#fbbf24',
              fontWeight: 700,
              fontSize: '0.6875rem',
            }}
          />
        );
      case 'NOT_INTERESTED':
      case 'UNSUBSCRIBE':
        return (
          <Chip
            size="small"
            label={intent}
            sx={{
              bgcolor: 'var(--accent-danger-muted)',
              border: '1px solid rgba(244, 63, 94, 0.3)',
              color: '#fb7185',
              fontWeight: 700,
              fontSize: '0.6875rem',
            }}
          />
        );
      default:
        return (
          <Chip
            size="small"
            label={intent}
            sx={{
              bgcolor: 'var(--bg-surface-subtle)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-secondary)',
              fontSize: '0.6875rem',
            }}
          />
        );
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      <Header title={conv.subject || 'Conversation Thread'} />

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
        {/* Back Link */}
        <Box>
          <Button
            component={Link}
            href="/conversations"
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
            ← Back to Inbox & Conversations
          </Button>
        </Box>

        {/* Lead Association & Status Alert */}
        {isUnassigned ? (
          <Box
            sx={{
              p: 2.5,
              borderRadius: 'var(--radius-md)',
              bgcolor: 'var(--accent-warning-muted)',
              border: '1px solid rgba(245, 158, 11, 0.35)',
            }}
          >
            <Typography variant="subtitle1" fontWeight={700} sx={{ color: '#fbbf24', mb: 0.5 }}>
              Unassigned Conversation (Needs Human Lead Assignment)
            </Typography>
            <Typography variant="body2" sx={{ color: 'var(--text-primary)', lineHeight: 1.5 }}>
              This sender matched zero or multiple open leads. AI autonomous actions & reply classification are deferred.
            </Typography>
            <Typography variant="caption" sx={{ color: 'var(--text-secondary)', display: 'block', mt: 0.75 }}>
              Note: Manual conversation assignment requires future backend endpoint support.
            </Typography>
          </Box>
        ) : (
          <Card
            sx={{
              bgcolor: 'var(--bg-surface)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-md)',
              boxShadow: 'var(--shadow-card)',
            }}
          >
            <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
              <Stack
                direction={{ xs: 'column', md: 'row' }}
                spacing={2}
                sx={{
                  justifyContent: 'space-between',
                  alignItems: { xs: 'flex-start', md: 'center' },
                }}
              >
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={3}
                  sx={{
                    alignItems: { xs: 'flex-start', sm: 'center' },
                    flexWrap: 'wrap',
                  }}
                >
                  <Box>
                    <Typography variant="caption" sx={{ color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                      Associated Account & Lead
                    </Typography>
                    <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', mt: 0.5, flexWrap: 'wrap' }}>
                      <Typography variant="h3" sx={{ color: 'var(--text-primary)' }}>
                        {conv.lead?.company.name}
                      </Typography>
                      {conv.lead?.company.domain && (
                        <Typography variant="caption" sx={{ color: 'var(--accent-info)' }}>
                          {conv.lead.company.domain}
                        </Typography>
                      )}
                      <Chip
                        size="small"
                        label={conv.lead?.status}
                        sx={{
                          height: 20,
                          fontSize: '0.6875rem',
                          fontWeight: 700,
                          bgcolor: conv.lead?.status === 'QUALIFIED' ? 'var(--accent-success-muted)' : 'var(--accent-info-muted)',
                          color: conv.lead?.status === 'QUALIFIED' ? '#34d399' : '#38bdf8',
                          border: conv.lead?.status === 'QUALIFIED' ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(14, 165, 233, 0.3)',
                        }}
                      />
                    </Stack>
                  </Box>

                  {conv.lead?.primaryContact && (
                    <Box sx={{ borderLeft: { sm: '1px solid var(--border-subtle)' }, pl: { sm: 3 } }}>
                      <Typography variant="caption" sx={{ color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                        Primary Contact
                      </Typography>
                      <Typography variant="body2" sx={{ color: 'var(--text-primary)', mt: 0.5, fontWeight: 500 }}>
                        {conv.lead.primaryContact.firstName} {conv.lead.primaryContact.lastName || ''}{' '}
                        <span style={{ color: 'var(--accent-info)' }}>({conv.lead.primaryContact.email})</span>
                      </Typography>
                    </Box>
                  )}

                  <Box sx={{ borderLeft: { sm: '1px solid var(--border-subtle)' }, pl: { sm: 3 } }}>
                    <Typography variant="caption" sx={{ color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, display: 'block', mb: 0.5 }}>
                      AI Operating State
                    </Typography>
                    {renderAiStateIndicator(conv.lead?.aiControlState, conv.lead?.status)}
                  </Box>
                </Stack>

                <Button
                  component={Link}
                  href={`/leads/${conv.lead?.id}`}
                  variant="contained"
                  size="small"
                  className="btn-primary"
                  sx={{ textTransform: 'none', px: 2, py: 0.75 }}
                >
                  View Full Lead Detail & Score →
                </Button>
              </Stack>
            </CardContent>
          </Card>
        )}

        {/* Thread Header */}
        <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
          <Typography variant="h2" sx={{ color: 'var(--text-primary)' }}>
            {conv.subject || '(No Subject)'}
          </Typography>
          <Typography variant="body2" sx={{ color: 'var(--text-secondary)' }}>
            {messages.length} message{messages.length === 1 ? '' : 's'} in thread
          </Typography>
        </Stack>

        {/* Chronological Messages Timeline */}
        <Stack spacing={2.5}>
          {messages.length === 0 ? (
            <Card
              sx={{
                p: 6,
                textAlign: 'center',
                bgcolor: 'var(--bg-surface)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-md)',
              }}
            >
              <Typography variant="body2" sx={{ color: 'var(--text-muted)' }}>
                No messages found in this conversation thread.
              </Typography>
            </Card>
          ) : (
            messages.map((msg) => {
              const isInbound = msg.direction === 'INBOUND';
              const aiAnalysis = msg.metadata?.aiReplyAnalysis;

              return (
                <Card
                  key={msg.id}
                  sx={{
                    bgcolor: 'var(--bg-surface)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 'var(--radius-md)',
                    boxShadow: 'var(--shadow-card)',
                    borderLeft: isInbound ? '3px solid var(--accent-info)' : '3px solid var(--accent-success)',
                    transition: 'var(--transition-default)',
                  }}
                >
                  <CardContent sx={{ p: 3, '&:last-child': { pb: 3 } }}>
                    {/* Message Meta Header */}
                    <Stack
                      direction={{ xs: 'column', sm: 'row' }}
                      spacing={1}
                      sx={{
                        justifyContent: 'space-between',
                        alignItems: { xs: 'flex-start', sm: 'center' },
                        mb: 2,
                      }}
                    >
                      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                        <Chip
                          size="small"
                          label={isInbound ? 'INBOUND EMAIL' : 'OUTBOUND EMAIL'}
                          sx={{
                            fontWeight: 700,
                            fontSize: '0.625rem',
                            bgcolor: isInbound ? 'var(--accent-info-muted)' : 'var(--accent-success-muted)',
                            color: isInbound ? '#38bdf8' : '#34d399',
                            border: isInbound ? '1px solid rgba(14, 165, 233, 0.3)' : '1px solid rgba(16, 185, 129, 0.3)',
                          }}
                        />
                        <Typography variant="body2" fontWeight={600} sx={{ color: 'var(--text-primary)' }}>
                          {msg.sender}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'var(--text-muted)' }}>
                          to {msg.recipient}
                        </Typography>
                      </Stack>

                      <Typography variant="caption" sx={{ color: 'var(--text-muted)' }}>
                        {new Date(msg.sentAt).toLocaleString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </Typography>
                    </Stack>

                    {/* Message Body Content */}
                    <Box
                      sx={{
                        p: 2,
                        borderRadius: 'var(--radius-sm)',
                        bgcolor: 'var(--bg-surface-subtle)',
                        border: '1px solid var(--border-subtle)',
                        fontSize: '0.875rem',
                        lineHeight: 1.6,
                        color: 'var(--text-primary)',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        mb: aiAnalysis ? 2 : 0,
                      }}
                    >
                      {msg.bodyText || '(Empty message body)'}
                    </Box>

                    {/* AI Inbound Reply Analysis Annotation Card */}
                    {aiAnalysis && (
                      <Box
                        sx={{
                          p: 2,
                          borderRadius: 'var(--radius-sm)',
                          bgcolor: 'rgba(14, 165, 233, 0.05)',
                          border: '1px solid rgba(14, 165, 233, 0.25)',
                        }}
                      >
                        <Stack
                          direction="row"
                          sx={{
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            mb: 1.5,
                            flexWrap: 'wrap',
                            gap: 1,
                          }}
                        >
                          <Typography
                            variant="subtitle2"
                            sx={{
                              color: '#38bdf8',
                              fontWeight: 700,
                              letterSpacing: '0.04em',
                              fontSize: '0.75rem',
                              textTransform: 'uppercase',
                            }}
                          >
                            AI Inbound Reply Analysis & Intelligence
                          </Typography>

                          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                            {getIntentChip(aiAnalysis.intent)}
                            <Chip
                              size="small"
                              label={`Sentiment: ${aiAnalysis.sentiment}`}
                              sx={{
                                fontWeight: 600,
                                fontSize: '0.625rem',
                                bgcolor:
                                  aiAnalysis.sentiment === 'POSITIVE'
                                    ? 'var(--accent-success-muted)'
                                    : aiAnalysis.sentiment === 'NEGATIVE' || aiAnalysis.sentiment === 'HOSTILE'
                                      ? 'var(--accent-danger-muted)'
                                      : 'var(--bg-surface-subtle)',
                                border:
                                  aiAnalysis.sentiment === 'POSITIVE'
                                    ? '1px solid rgba(16, 185, 129, 0.3)'
                                    : aiAnalysis.sentiment === 'NEGATIVE' || aiAnalysis.sentiment === 'HOSTILE'
                                      ? '1px solid rgba(244, 63, 94, 0.3)'
                                      : '1px solid var(--border-subtle)',
                                color:
                                  aiAnalysis.sentiment === 'POSITIVE'
                                    ? '#34d399'
                                    : aiAnalysis.sentiment === 'NEGATIVE' || aiAnalysis.sentiment === 'HOSTILE'
                                      ? '#fb7185'
                                      : 'var(--text-secondary)',
                              }}
                            />
                          </Stack>
                        </Stack>

                        <Grid container spacing={2}>
                          {aiAnalysis.recommendedNextAction && (
                            <Grid size={{ xs: 12, sm: 6 }}>
                              <Typography variant="caption" sx={{ color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, display: 'block', mb: 0.25 }}>
                                Recommended Next Action
                              </Typography>
                              <Typography variant="body2" sx={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                                {aiAnalysis.recommendedNextAction}
                              </Typography>
                            </Grid>
                          )}

                          {aiAnalysis.suggestedLeadStage && (
                            <Grid size={{ xs: 12, sm: 6 }}>
                              <Typography variant="caption" sx={{ color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, display: 'block', mb: 0.25 }}>
                                Suggested Stage Progression
                              </Typography>
                              <Typography variant="body2" sx={{ color: 'var(--accent-info)', fontWeight: 600 }}>
                                {aiAnalysis.suggestedLeadStage}
                              </Typography>
                            </Grid>
                          )}

                          {aiAnalysis.objectionsIdentified && aiAnalysis.objectionsIdentified.length > 0 && (
                            <Grid size={12}>
                              <Typography variant="caption" sx={{ color: '#fb7185', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, display: 'block', mb: 0.25 }}>
                                Objections Identified
                              </Typography>
                              <Box component="ul" sx={{ pl: 2.5, m: 0, mt: 0.5 }}>
                                {aiAnalysis.objectionsIdentified.map((obj, i) => (
                                  <Typography key={i} component="li" variant="body2" sx={{ color: 'var(--text-secondary)', mb: 0.5, lineHeight: 1.5 }}>
                                    {obj}
                                  </Typography>
                                ))}
                              </Box>
                            </Grid>
                          )}

                          {aiAnalysis.questionsAsked && aiAnalysis.questionsAsked.length > 0 && (
                            <Grid size={12}>
                              <Typography variant="caption" sx={{ color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, display: 'block', mb: 0.25 }}>
                                Questions Asked by Prospect
                              </Typography>
                              <Box component="ul" sx={{ pl: 2.5, m: 0, mt: 0.5 }}>
                                {aiAnalysis.questionsAsked.map((q, i) => (
                                  <Typography key={i} component="li" variant="body2" sx={{ color: 'var(--text-secondary)', mb: 0.5, lineHeight: 1.5 }}>
                                    {q}
                                  </Typography>
                                ))}
                              </Box>
                            </Grid>
                          )}
                        </Grid>
                      </Box>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </Stack>
      </Box>
    </Box>
  );
}

