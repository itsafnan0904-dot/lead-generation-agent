'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Typography,
  Stack,
  Button,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Alert,
  AlertTitle,
  Divider,
  Tooltip,
} from '@mui/material';

export interface OutreachDraftItem {
  id: string;
  leadId: string;
  subject: string;
  bodyText: string;
  bodyHtml?: string | null;
  callToAction?: string | null;
  rationale?: string | null;
  personalizationPoints?: any;
  status: 'DRAFT' | 'SENT' | 'FAILED' | 'CANCELLED';
  gmailMessageId?: string | null;
  gmailThreadId?: string | null;
  errorMessage?: string | null;
  sentAt?: string | null;
  createdAt: string;
  aiUsageMetadata?: {
    totalTokens?: number;
    promptTokens?: number;
    completionTokens?: number;
    estimatedCostUsd?: number;
    latencyMs?: number;
    model?: string;
  } | null;
}

interface LeadOutreachSectionProps {
  leadId: string;
  leadStatus: string;
  primaryContactEmail?: string | null;
  primaryContactName?: string | null;
  companyName: string;
  initialDrafts: OutreachDraftItem[];
}

export function LeadOutreachSection({
  leadId,
  leadStatus,
  primaryContactEmail,
  primaryContactName,
  companyName,
  initialDrafts,
}: LeadOutreachSectionProps) {
  const router = useRouter();
  const isRestricted = leadStatus === 'RESTRICTED';

  const [drafts, setDrafts] = useState<OutreachDraftItem[]>(initialDrafts);
  const [isGenerating, setIsGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [genSuccessMsg, setGenSuccessMsg] = useState<string | null>(null);

  // Send Confirmation Dialog State
  const [selectedDraftForSend, setSelectedDraftForSend] = useState<OutreachDraftItem | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendResult, setSendResult] = useState<{
    draftId: string;
    gmailMessageId: string;
    actualRecipientUsed: string;
    originalRecipient: string;
    safeTestModeActive: boolean;
  } | null>(null);

  const handleGenerateDraft = async () => {
    if (isRestricted) return;

    setIsGenerating(true);
    setGenError(null);
    setGenSuccessMsg(null);

    try {
      const res = await fetch(`/api/leads/${leadId}/outreach/draft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tone: 'professional and consultative' }),
      });
      const data = await res.json();

      if (!res.ok) {
        setGenError(data.error || 'Failed to generate outreach draft');
      } else {
        const costStr = data.aiUsageMetadata?.estimatedCostUsd
          ? ` ($${data.aiUsageMetadata.estimatedCostUsd.toFixed(5)}, ${data.aiUsageMetadata.totalTokens} tokens)`
          : '';
        setGenSuccessMsg(`Outreach draft generated successfully via AI${costStr}.`);
        setDrafts((prev) => [data, ...prev]);
        router.refresh();
      }
    } catch (err: any) {
      setGenError(err.message || 'Network error during draft generation');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleOpenSendDialog = (draft: OutreachDraftItem) => {
    setSelectedDraftForSend(draft);
    setSendError(null);
  };

  const handleCloseSendDialog = () => {
    if (isSending) return; // Prevent closing while in-flight
    setSelectedDraftForSend(null);
    setSendError(null);
  };

  const handleConfirmSend = async () => {
    if (!selectedDraftForSend) return;

    setIsSending(true);
    setSendError(null);

    try {
      const res = await fetch(`/api/outreach/${selectedDraftForSend.id}/send`, {
        method: 'POST',
      });
      const data = await res.json();

      if (!res.ok) {
        setSendError(data.error || `Send failed with status ${res.status}`);
      } else {
        setSendResult(data);
        // Update draft in list
        setDrafts((prev) =>
          prev.map((d) =>
            d.id === selectedDraftForSend.id
              ? {
                  ...d,
                  status: 'SENT',
                  gmailMessageId: data.gmailMessageId,
                  sentAt: data.sentAt || new Date().toISOString(),
                }
              : d,
          ),
        );
        setSelectedDraftForSend(null);
        router.refresh();
      }
    } catch (err: any) {
      setSendError(err.message || 'Network error during send request');
    } finally {
      setIsSending(false);
    }
  };

  const recipientTarget = primaryContactEmail || 'No primary contact email assigned';

  return (
    <Box
      sx={{
        width: '100%',
        bgcolor: '#151628',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '8px',
        p: { xs: 2, sm: 3 },
      }}
    >
      {/* Section Header */}
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        sx={{
          justifyContent: 'space-between',
          alignItems: { xs: 'flex-start', sm: 'center' },
          mb: 2.5,
          pb: 2,
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
        }}
      >
        <Box>
          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
            <Typography
              variant="h3"
              sx={{
                color: '#f4f4fa',
                fontSize: '0.9375rem',
                fontWeight: 600,
                letterSpacing: '-0.015em',
              }}
            >
              Conversations & Outreach Sequences
            </Typography>
            <Box
              sx={{
                px: 1,
                py: 0.25,
                borderRadius: '4px',
                bgcolor: 'rgba(124, 110, 224, 0.12)',
                color: '#a99ef2',
                border: '1px solid rgba(124, 110, 224, 0.25)',
                fontSize: '0.6875rem',
                fontWeight: 600,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {drafts.length} {drafts.length === 1 ? 'draft' : 'drafts'}
            </Box>
          </Stack>
          <Typography variant="body2" sx={{ color: '#a1a3b8', mt: 0.5, fontSize: '0.8125rem' }}>
            AI-generated personalized email sequences with mandatory human-in-the-loop review before sending.
          </Typography>
        </Box>

        {/* Generate Draft Button */}
        {isRestricted ? (
          <Tooltip title="Outreach drafting is suppressed for RESTRICTED leads" arrow>
            <span>
              <Button
                disabled
                variant="outlined"
                size="small"
                sx={{
                  opacity: 0.4,
                  cursor: 'not-allowed',
                  textTransform: 'none',
                  fontSize: '0.8125rem',
                  color: '#6e7089',
                  borderColor: 'rgba(255, 255, 255, 0.08)',
                  bgcolor: '#1a1b30',
                  borderRadius: '6px',
                  px: 2,
                  py: 0.6,
                }}
              >
                Generate Draft (Restricted)
              </Button>
            </span>
          </Tooltip>
        ) : (
          <Button
            onClick={handleGenerateDraft}
            disabled={isGenerating}
            variant="contained"
            size="small"
            startIcon={
              isGenerating ? (
                <CircularProgress size={13} color="inherit" />
              ) : (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
              )
            }
            sx={{
              textTransform: 'none',
              bgcolor: '#8f82e8',
              color: '#ffffff',
              fontWeight: 500,
              fontSize: '0.8125rem',
              borderRadius: '6px',
              px: 2,
              py: 0.6,
              boxShadow: 'none',
              transition: 'background-color 140ms cubic-bezier(0.23, 1, 0.32, 1)',
              '&:hover:not(:disabled)': {
                bgcolor: '#6c5ed0',
                boxShadow: 'none',
              },
              '&:active:not(:disabled)': {
                transform: 'scale(0.97)',
              },
            }}
          >
            {isGenerating ? 'Drafting with AI...' : 'Generate Outreach Draft'}
          </Button>
        )}
      </Stack>

      {/* Action / Generation Result Alerts */}
      {genError && (
        <Alert
          severity="error"
          sx={{
            mb: 2,
            fontSize: '0.8125rem',
            bgcolor: 'rgba(244, 63, 94, 0.10)',
            color: '#fb7185',
            border: '1px solid rgba(244, 63, 94, 0.25)',
            borderRadius: '6px',
          }}
          onClose={() => setGenError(null)}
        >
          {genError}
        </Alert>
      )}
      {genSuccessMsg && (
        <Alert
          severity="success"
          sx={{
            mb: 2,
            fontSize: '0.8125rem',
            bgcolor: 'rgba(16, 185, 129, 0.10)',
            color: '#34d399',
            border: '1px solid rgba(16, 185, 129, 0.25)',
            borderRadius: '6px',
          }}
          onClose={() => setGenSuccessMsg(null)}
        >
          {genSuccessMsg}
        </Alert>
      )}
      {sendResult && (
        <Alert
          severity="success"
          sx={{
            mb: 2.5,
            fontSize: '0.8125rem',
            bgcolor: 'rgba(16, 185, 129, 0.10)',
            color: '#34d399',
            border: '1px solid rgba(16, 185, 129, 0.25)',
            borderRadius: '6px',
          }}
          onClose={() => setSendResult(null)}
        >
          <AlertTitle sx={{ fontWeight: 600, fontSize: '0.875rem' }}>Outreach Email Successfully Dispatched</AlertTitle>
          <Typography variant="body2" component="div" sx={{ fontSize: '0.8125rem', mt: 0.5 }}>
            • <strong>Gmail Message ID:</strong> <code style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.75rem', background: 'rgba(0,0,0,0.3)', padding: '2px 4px', borderRadius: '4px' }}>{sendResult.gmailMessageId}</code>
            <br />
            • <strong>Intended Recipient:</strong> {sendResult.originalRecipient}
            <br />
            • <strong>Actual Delivery Target:</strong> {sendResult.actualRecipientUsed}{' '}
            {sendResult.safeTestModeActive && (
              <Box
                component="span"
                sx={{
                  ml: 1,
                  px: 0.75,
                  py: 0.25,
                  borderRadius: '4px',
                  bgcolor: 'rgba(245, 158, 11, 0.15)',
                  color: '#fbbf24',
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                  fontSize: '0.625rem',
                  fontWeight: 700,
                }}
              >
                SAFE TEST MODE ACTIVE
              </Box>
            )}
          </Typography>
        </Alert>
      )}

      {/* Drafts List */}
      {drafts.length === 0 ? (
        <Box
          sx={{
            p: 4,
            textAlign: 'center',
            borderRadius: '6px',
            border: '1px dashed rgba(255, 255, 255, 0.08)',
            bgcolor: '#0d0e1b',
          }}
        >
          <Typography variant="body2" sx={{ color: '#a1a3b8', fontSize: '0.84375rem' }}>
            No outreach email drafts created yet for {companyName}.
          </Typography>
          {!isRestricted && (
            <Typography variant="caption" sx={{ color: '#6e7089', mt: 0.5, display: 'block' }}>
              Click &quot;Generate Outreach Draft&quot; to formulate a tailored outreach message using company research.
            </Typography>
          )}
        </Box>
      ) : (
        <Stack spacing={2}>
          {drafts.map((draft) => {
            const aiMeta = draft.aiUsageMetadata;
            const isDraftStatus = draft.status === 'DRAFT';
            const isSentStatus = draft.status === 'SENT';

            return (
              <Box
                key={draft.id}
                sx={{
                  p: 2.5,
                  borderRadius: '6px',
                  bgcolor: '#1a1b30',
                  border: isDraftStatus
                    ? '1px solid rgba(245, 158, 11, 0.35)'
                    : '1px solid rgba(255, 255, 255, 0.08)',
                }}
              >
                {/* Draft Header Bar */}
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={1.5}
                  sx={{
                    justifyContent: 'space-between',
                    alignItems: { xs: 'flex-start', sm: 'center' },
                    mb: 1.5,
                  }}
                >
                  <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                    <Box
                      sx={{
                        px: 1,
                        py: 0.25,
                        borderRadius: '4px',
                        bgcolor: isDraftStatus
                          ? 'rgba(245, 158, 11, 0.12)'
                          : isSentStatus
                            ? 'rgba(16, 185, 129, 0.12)'
                            : 'rgba(244, 63, 94, 0.12)',
                        color: isDraftStatus ? '#fbbf24' : isSentStatus ? '#34d399' : '#fb7185',
                        border: isDraftStatus
                          ? '1px solid rgba(245, 158, 11, 0.25)'
                          : isSentStatus
                            ? '1px solid rgba(16, 185, 129, 0.25)'
                            : '1px solid rgba(244, 63, 94, 0.25)',
                        fontSize: '0.625rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                      }}
                    >
                      {draft.status}
                    </Box>
                    <Typography variant="subtitle2" sx={{ color: '#f4f4fa', fontWeight: 600, fontSize: '0.875rem' }}>
                      Subject: {draft.subject}
                    </Typography>
                  </Stack>

                  <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                    <Typography variant="caption" sx={{ color: '#6e7089', fontSize: '0.75rem', fontVariantNumeric: 'tabular-nums' }}>
                      {new Date(draft.createdAt).toLocaleString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Typography>

                    {/* Explicit Separate Send Action Button */}
                    {isDraftStatus && (
                      <Button
                        onClick={() => handleOpenSendDialog(draft)}
                        variant="contained"
                        size="small"
                        sx={{
                          textTransform: 'none',
                          fontSize: '0.8125rem',
                          fontWeight: 500,
                          bgcolor: '#8f82e8',
                          color: '#ffffff',
                          borderRadius: '6px',
                          py: 0.5,
                          px: 1.5,
                          boxShadow: 'none',
                          transition: 'background-color 140ms cubic-bezier(0.23, 1, 0.32, 1)',
                          '&:hover:not(:disabled)': {
                            bgcolor: '#6c5ed0',
                            boxShadow: 'none',
                          },
                          '&:active:not(:disabled)': {
                            transform: 'scale(0.97)',
                          },
                        }}
                      >
                        Send Email...
                      </Button>
                    )}
                  </Stack>
                </Stack>

                {/* Body Preview */}
                <Box
                  sx={{
                    p: 2,
                    borderRadius: '4px',
                    bgcolor: '#0d0e1b',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                    whiteSpace: 'pre-wrap',
                    fontSize: '0.84375rem',
                    lineHeight: 1.6,
                    color: '#e5e7eb',
                    mb: 1.5,
                  }}
                >
                  {draft.bodyText}
                </Box>

                {/* Metadata & AI Cost Footer */}
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={1}
                  sx={{
                    justifyContent: 'space-between',
                    alignItems: { xs: 'flex-start', sm: 'center' },
                  }}
                >
                  <Stack direction="row" spacing={2} sx={{ flexWrap: 'wrap' }}>
                    {draft.callToAction && (
                      <Typography variant="caption" sx={{ color: '#a1a3b8', fontSize: '0.75rem' }}>
                        <strong style={{ color: '#c9cadb' }}>Call to Action:</strong> {draft.callToAction}
                      </Typography>
                    )}
                    {draft.gmailMessageId && (
                      <Typography variant="caption" sx={{ color: '#6e7089', fontSize: '0.75rem' }}>
                        <strong style={{ color: '#a1a3b8' }}>Gmail ID:</strong> {draft.gmailMessageId}
                      </Typography>
                    )}
                    {draft.errorMessage && (
                      <Typography variant="caption" sx={{ color: '#fb7185', fontSize: '0.75rem' }}>
                        <strong>Error:</strong> {draft.errorMessage}
                      </Typography>
                    )}
                  </Stack>

                  {aiMeta && (
                    <Typography variant="caption" sx={{ color: '#6e7089', fontSize: '0.75rem', fontVariantNumeric: 'tabular-nums' }}>
                      AI Model: {aiMeta.model || 'gpt-4o-mini'} | {aiMeta.totalTokens || 0} tokens
                      {aiMeta.estimatedCostUsd ? ` (~$${aiMeta.estimatedCostUsd.toFixed(5)})` : ''}
                    </Typography>
                  )}
                </Stack>
              </Box>
            );
          })}
        </Stack>
      )}

      {/* MANDATORY SEND CONFIRMATION DIALOG */}
      <Dialog
        open={!!selectedDraftForSend}
        onClose={handleCloseSendDialog}
        maxWidth="md"
        fullWidth
        disableEscapeKeyDown={isSending}
        PaperProps={{
          sx: {
            bgcolor: '#151628',
            border: '1px solid rgba(255, 255, 255, 0.10)',
            borderRadius: '10px',
            boxShadow: '0 12px 32px -4px rgba(0, 0, 0, 0.7)',
          },
        }}
      >
        <DialogTitle sx={{ pb: 1.5, borderBottom: '1px solid rgba(255, 255, 255, 0.06)' }}>
          <Typography variant="h3" sx={{ color: '#f4f4fa', fontSize: '1.0625rem', fontWeight: 600, letterSpacing: '-0.015em' }}>
            Confirm Live Outreach Email Send
          </Typography>
        </DialogTitle>

        <DialogContent sx={{ py: 2.5 }}>
          {sendError && (
            <Alert
              severity="error"
              sx={{
                mb: 2.5,
                fontSize: '0.8125rem',
                bgcolor: 'rgba(244, 63, 94, 0.10)',
                color: '#fb7185',
                border: '1px solid rgba(244, 63, 94, 0.25)',
                borderRadius: '6px',
              }}
            >
              <AlertTitle sx={{ fontWeight: 600 }}>Dispatch Failed</AlertTitle>
              {sendError}
            </Alert>
          )}

          <DialogContentText sx={{ color: '#a1a3b8', mb: 2, fontSize: '0.84375rem' }}>
            Please carefully review the recipient and email content before confirming dispatch.
            This action will trigger an authentic email via the system Gmail integration.
          </DialogContentText>

          {/* Prominent Recipient & Subject Summary Card */}
          <Box
            sx={{
              p: 2,
              mb: 2.5,
              borderRadius: '6px',
              bgcolor: '#1a1b30',
              border: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            <Stack spacing={1}>
              <Box>
                <Typography variant="caption" sx={{ color: '#6e7089', fontWeight: 600, display: 'block', fontSize: '0.6875rem', letterSpacing: '0.04em' }}>
                  INTENDED RECIPIENT EMAIL
                </Typography>
                <Typography variant="body1" sx={{ color: '#a99ef2', fontWeight: 600, fontSize: '0.9375rem' }}>
                  {recipientTarget} {primaryContactName ? `(${primaryContactName})` : ''}
                </Typography>
              </Box>
              <Divider sx={{ my: 0.5, borderColor: 'rgba(255, 255, 255, 0.06)' }} />
              <Box>
                <Typography variant="caption" sx={{ color: '#6e7089', fontWeight: 600, display: 'block', fontSize: '0.6875rem', letterSpacing: '0.04em' }}>
                  SUBJECT LINE
                </Typography>
                <Typography variant="body2" sx={{ color: '#f4f4fa', fontWeight: 600, fontSize: '0.875rem' }}>
                  {selectedDraftForSend?.subject}
                </Typography>
              </Box>
            </Stack>
          </Box>

          {/* Body Preview Excerpt */}
          <Box sx={{ mb: 2.5 }}>
            <Typography variant="caption" sx={{ color: '#a1a3b8', fontWeight: 500, display: 'block', mb: 0.75, fontSize: '0.78125rem' }}>
              MESSAGE BODY PREVIEW
            </Typography>
            <Box
              sx={{
                p: 2,
                borderRadius: '4px',
                bgcolor: '#0d0e1b',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                maxHeight: 180,
                overflowY: 'auto',
                whiteSpace: 'pre-wrap',
                fontSize: '0.8125rem',
                lineHeight: 1.5,
                color: '#a1a3b8',
              }}
            >
              {selectedDraftForSend?.bodyText}
            </Box>
          </Box>

          {/* Safety Notice */}
          <Alert
            severity="warning"
            sx={{
              bgcolor: 'rgba(245, 158, 11, 0.10)',
              border: '1px solid rgba(245, 158, 11, 0.25)',
              borderRadius: '6px',
              color: '#fbbf24',
            }}
          >
            <AlertTitle sx={{ fontWeight: 600, fontSize: '0.84375rem', color: '#fbbf24' }}>
              Safety Notice & Environment Routing
            </AlertTitle>
            <Typography variant="caption" sx={{ color: '#c9cadb', fontSize: '0.75rem' }} component="div">
              • If Safe Test Mode is active on the server, this email will be safely redirected to the server&apos;s configured test inbox.
              <br />
              • Full delivery target confirmation will be verified and displayed immediately upon completion.
            </Typography>
          </Alert>
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2, borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}>
          <Button
            onClick={handleCloseSendDialog}
            disabled={isSending}
            variant="outlined"
            size="small"
            sx={{
              textTransform: 'none',
              fontSize: '0.8125rem',
              color: '#f4f4fa',
              borderColor: 'rgba(255, 255, 255, 0.10)',
              bgcolor: '#1a1b30',
              borderRadius: '6px',
              px: 2,
              '&:hover': {
                bgcolor: 'rgba(255, 255, 255, 0.06)',
                borderColor: 'rgba(255, 255, 255, 0.18)',
              },
            }}
          >
            Cancel
          </Button>

          <Button
            onClick={handleConfirmSend}
            disabled={isSending}
            variant="contained"
            size="small"
            startIcon={
              isSending ? <CircularProgress size={13} color="inherit" /> : undefined
            }
            sx={{
              textTransform: 'none',
              minWidth: 160,
              fontSize: '0.8125rem',
              fontWeight: 500,
              bgcolor: '#8f82e8',
              color: '#ffffff',
              borderRadius: '6px',
              px: 2,
              boxShadow: 'none',
              transition: 'background-color 140ms cubic-bezier(0.23, 1, 0.32, 1)',
              '&:hover:not(:disabled)': {
                bgcolor: '#6c5ed0',
                boxShadow: 'none',
              },
              '&:active:not(:disabled)': {
                transform: 'scale(0.97)',
              },
            }}
          >
            {isSending ? 'Dispatching Email...' : 'Confirm & Send Email'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
