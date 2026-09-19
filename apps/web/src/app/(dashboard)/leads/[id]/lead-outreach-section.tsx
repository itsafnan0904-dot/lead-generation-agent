'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Card,
  CardContent,
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
    <Card sx={{ width: '100%', bgcolor: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)' }}>
      <CardContent sx={{ p: 3, '&:last-child': { pb: 3 } }}>
        {/* Section Header */}
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          sx={{
            justifyContent: 'space-between',
            alignItems: { xs: 'flex-start', sm: 'center' },
            mb: 2,
          }}
        >
          <Box>
            <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
              <Typography variant="h3" sx={{ color: 'var(--text-primary)' }}>
                Conversations & Outreach Sequences
              </Typography>
              <Box
                sx={{
                  px: 1,
                  py: 0.25,
                  borderRadius: 'var(--radius-sm)',
                  bgcolor: 'var(--accent-primary-muted)',
                  color: 'var(--accent-primary-light)',
                  fontSize: '0.6875rem',
                  fontWeight: 600,
                }}
              >
                {drafts.length} {drafts.length === 1 ? 'draft' : 'drafts'}
              </Box>
            </Stack>
            <Typography variant="body2" sx={{ color: 'var(--text-secondary)', mt: 0.5 }}>
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
                  className="btn-secondary"
                  sx={{ opacity: 0.5, cursor: 'not-allowed', textTransform: 'none' }}
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
              className="btn-primary"
              startIcon={
                isGenerating ? (
                  <CircularProgress size={14} color="inherit" />
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                  </svg>
                )
              }
              sx={{ textTransform: 'none' }}
            >
              {isGenerating ? 'Drafting with AI...' : 'Generate Outreach Draft'}
            </Button>
          )}
        </Stack>

        {/* Action / Generation Result Alerts */}
        {genError && (
          <Alert severity="error" sx={{ mb: 2, fontSize: '0.8125rem' }} onClose={() => setGenError(null)}>
            {genError}
          </Alert>
        )}
        {genSuccessMsg && (
          <Alert severity="success" sx={{ mb: 2, fontSize: '0.8125rem' }} onClose={() => setGenSuccessMsg(null)}>
            {genSuccessMsg}
          </Alert>
        )}
        {sendResult && (
          <Alert
            severity="success"
            sx={{ mb: 2.5, fontSize: '0.8125rem' }}
            onClose={() => setSendResult(null)}
          >
            <AlertTitle sx={{ fontWeight: 700, fontSize: '0.875rem' }}>Outreach Email Successfully Dispatched</AlertTitle>
            <Typography variant="body2" component="div" sx={{ fontSize: '0.8125rem' }}>
              • <strong>Gmail Message ID:</strong> <code>{sendResult.gmailMessageId}</code>
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
                    borderRadius: 'var(--radius-sm)',
                    bgcolor: 'var(--accent-warning-muted)',
                    color: '#fbbf24',
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
              borderRadius: 'var(--radius-md)',
              border: '1px dashed var(--border-default)',
              bgcolor: 'var(--bg-surface-subtle)',
            }}
          >
            <Typography variant="body2" sx={{ color: 'var(--text-secondary)' }}>
              No outreach email drafts created yet for {companyName}.
            </Typography>
            {!isRestricted && (
              <Typography variant="caption" sx={{ color: 'var(--text-muted)', mt: 0.5, display: 'block' }}>
                Click &quot;Generate Outreach Draft&quot; to formulate a tailored outreach message using company research.
              </Typography>
            )}
          </Box>
        ) : (
          <Stack spacing={2.5}>
            {drafts.map((draft) => {
              const aiMeta = draft.aiUsageMetadata;
              const isDraftStatus = draft.status === 'DRAFT';
              const isSentStatus = draft.status === 'SENT';

              return (
                <Box
                  key={draft.id}
                  sx={{
                    p: 2.5,
                    borderRadius: 'var(--radius-md)',
                    bgcolor: 'var(--bg-surface-subtle)',
                    border: isDraftStatus ? '1px solid var(--border-focus)' : '1px solid var(--border-subtle)',
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
                          borderRadius: 'var(--radius-sm)',
                          bgcolor: isDraftStatus ? 'var(--accent-warning-muted)' : isSentStatus ? 'var(--accent-success-muted)' : 'var(--accent-danger-muted)',
                          color: isDraftStatus ? '#fbbf24' : isSentStatus ? '#34d399' : '#fb7185',
                          fontSize: '0.625rem',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                        }}
                      >
                        {draft.status}
                      </Box>
                      <Typography variant="subtitle2" sx={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                        Subject: {draft.subject}
                      </Typography>
                    </Stack>

                    <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                      <Typography variant="caption" sx={{ color: 'var(--text-muted)' }}>
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
                          className="btn-primary"
                          sx={{
                            textTransform: 'none',
                            py: 0.5,
                            px: 1.5,
                            fontSize: '0.8125rem',
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
                      borderRadius: 'var(--radius-sm)',
                      bgcolor: 'rgba(0, 0, 0, 0.3)',
                      border: '1px solid var(--border-subtle)',
                      whiteSpace: 'pre-wrap',
                      fontSize: '0.875rem',
                      lineHeight: 1.6,
                      color: 'var(--text-primary)',
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
                        <Typography variant="caption" sx={{ color: 'var(--text-secondary)' }}>
                          <strong>Call to Action:</strong> {draft.callToAction}
                        </Typography>
                      )}
                      {draft.gmailMessageId && (
                        <Typography variant="caption" sx={{ color: 'var(--text-muted)' }}>
                          <strong>Gmail ID:</strong> {draft.gmailMessageId}
                        </Typography>
                      )}
                      {draft.errorMessage && (
                        <Typography variant="caption" sx={{ color: 'var(--accent-danger)' }}>
                          <strong>Error:</strong> {draft.errorMessage}
                        </Typography>
                      )}
                    </Stack>

                    {aiMeta && (
                      <Typography variant="caption" sx={{ color: 'var(--text-muted)' }}>
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
      </CardContent>

      {/* MANDATORY SEND CONFIRMATION DIALOG */}
      <Dialog
        open={!!selectedDraftForSend}
        onClose={handleCloseSendDialog}
        maxWidth="md"
        fullWidth
        disableEscapeKeyDown={isSending}
        PaperProps={{
          sx: {
            bgcolor: 'var(--bg-surface-elevated)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-elevated)',
          },
        }}
      >
        <DialogTitle sx={{ fontWeight: 700, borderBottom: '1px solid var(--border-subtle)' }}>
          Confirm Live Outreach Email Send
        </DialogTitle>

        <DialogContent sx={{ py: 2.5 }}>
          {sendError && (
            <Alert severity="error" sx={{ mb: 2.5, fontSize: '0.8125rem' }}>
              <AlertTitle sx={{ fontWeight: 700 }}>Dispatch Failed</AlertTitle>
              {sendError}
            </Alert>
          )}

          <DialogContentText sx={{ color: 'var(--text-secondary)', mb: 2, fontSize: '0.875rem' }}>
            Please carefully review the recipient and email content before confirming dispatch.
            This action will trigger an authentic email via the system Gmail integration.
          </DialogContentText>

          {/* Prominent Recipient & Subject Summary Card */}
          <Box
            sx={{
              p: 2,
              mb: 2.5,
              borderRadius: 'var(--radius-sm)',
              bgcolor: 'var(--bg-surface-subtle)',
              border: '1px solid var(--border-default)',
            }}
          >
            <Stack spacing={1}>
              <Box>
                <Typography variant="caption" sx={{ color: 'var(--text-secondary)', fontWeight: 600, display: 'block' }}>
                  INTENDED RECIPIENT EMAIL
                </Typography>
                <Typography variant="body1" fontWeight={700} sx={{ color: 'var(--accent-info)' }}>
                  {recipientTarget} {primaryContactName ? `(${primaryContactName})` : ''}
                </Typography>
              </Box>
              <Divider sx={{ my: 0.5, borderColor: 'var(--border-subtle)' }} />
              <Box>
                <Typography variant="caption" sx={{ color: 'var(--text-secondary)', fontWeight: 600, display: 'block' }}>
                  SUBJECT LINE
                </Typography>
                <Typography variant="body2" fontWeight={600} sx={{ color: 'var(--text-primary)' }}>
                  {selectedDraftForSend?.subject}
                </Typography>
              </Box>
            </Stack>
          </Box>

          {/* Body Preview Excerpt */}
          <Box sx={{ mb: 2.5 }}>
            <Typography variant="caption" sx={{ color: 'var(--text-secondary)', fontWeight: 600, display: 'block', mb: 0.5 }}>
              MESSAGE BODY PREVIEW
            </Typography>
            <Box
              sx={{
                p: 2,
                borderRadius: 'var(--radius-sm)',
                bgcolor: 'rgba(0, 0, 0, 0.3)',
                border: '1px solid var(--border-subtle)',
                maxHeight: 180,
                overflowY: 'auto',
                whiteSpace: 'pre-wrap',
                fontSize: '0.8125rem',
                lineHeight: 1.5,
                color: 'var(--text-secondary)',
              }}
            >
              {selectedDraftForSend?.bodyText}
            </Box>
          </Box>

          {/* Safety Notice */}
          <Alert severity="warning" sx={{ bgcolor: 'var(--accent-warning-muted)', border: '1px solid rgba(245, 158, 11, 0.25)' }}>
            <AlertTitle sx={{ fontWeight: 700, fontSize: '0.875rem', color: '#fbbf24' }}>
              Safety Notice & Environment Routing
            </AlertTitle>
            <Typography variant="caption" sx={{ color: 'var(--text-primary)' }} component="div">
              • If Safe Test Mode is active on the server, this email will be safely redirected to the server&apos;s configured test inbox.
              <br />
              • Full delivery target confirmation will be verified and displayed immediately upon completion.
            </Typography>
          </Alert>
        </DialogContent>

        <DialogActions sx={{ p: 2.5, borderTop: '1px solid var(--border-subtle)' }}>
          <Button
            onClick={handleCloseSendDialog}
            disabled={isSending}
            variant="outlined"
            size="small"
            className="btn-secondary"
            sx={{ textTransform: 'none' }}
          >
            Cancel
          </Button>

          <Button
            onClick={handleConfirmSend}
            disabled={isSending}
            variant="contained"
            size="small"
            className="btn-primary"
            startIcon={
              isSending ? <CircularProgress size={16} color="inherit" /> : undefined
            }
            sx={{ textTransform: 'none', minWidth: 160 }}
          >
            {isSending ? 'Dispatching Email...' : 'Confirm & Send Email'}
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
}
