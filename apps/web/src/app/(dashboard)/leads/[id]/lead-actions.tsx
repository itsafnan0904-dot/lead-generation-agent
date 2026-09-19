'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  TextField,
  Typography,
  Alert,
  Stack,
  Tooltip,
} from '@mui/material';
import { useAuth } from '@/lib/auth-context';

interface LeadActionButtonsProps {
  leadId: string;
  currentStatus: string;
  currentAIState: string;
  pendingReviewId?: string | null;
}

export function LeadActionButtons({
  leadId,
  currentStatus,
  currentAIState,
  pendingReviewId,
}: LeadActionButtonsProps) {
  const router = useRouter();
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Human Review Modal State
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [decision, setDecision] = useState<'APPROVED' | 'REJECTED'>('APPROVED');
  const [justification, setJustification] = useState('');
  const [resolveError, setResolveError] = useState<string | null>(null);

  const handleScore = async () => {
    setLoadingAction('score');
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await fetch(`/api/leads/${leadId}/score`, { method: 'POST' });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Score recalculation failed');
      } else {
        setSuccessMsg(`Score updated to ${data.scoreTotal}/100`);
        router.refresh();
      }
    } catch (err: any) {
      setError(err.message || 'Network error');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleRestrictionCheck = async () => {
    setLoadingAction('restriction');
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await fetch(`/api/leads/${leadId}/restriction-check`, { method: 'POST' });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Restriction check failed');
      } else {
        const isRestricted = data.status === 'RESTRICTED';
        setSuccessMsg(
          isRestricted
            ? 'Restriction check completed: LEAD RESTRICTED'
            : 'Restriction check completed: CLEAR'
        );
        router.refresh();
      }
    } catch (err: any) {
      setError(err.message || 'Network error');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleAIControl = async (action: 'pause' | 'take-over' | 'resume') => {
    setLoadingAction(action);
    setError(null);
    setSuccessMsg(null);

    try {
      const endpoint =
        action === 'pause'
          ? `/api/leads/${leadId}/pause-ai`
          : action === 'take-over'
            ? `/api/leads/${leadId}/take-over`
            : `/api/leads/${leadId}/resume-ai`;

      const res = await fetch(endpoint, { method: 'POST' });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || `Failed to ${action} AI`);
      } else {
        setSuccessMsg(`AI control transitioned to ${data.aiControlState}`);
        router.refresh();
      }
    } catch (err: any) {
      setError(err.message || 'Network error');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleResolveSubmit = async () => {
    setLoadingAction('resolve');
    setResolveError(null);

    try {
      const res = await fetch(`/api/human-reviews/${pendingReviewId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, justification }),
      });

      const data = await res.json();

      if (!res.ok) {
        setResolveError(data.error || 'Failed to resolve review');
      } else {
        setShowResolveModal(false);
        setJustification('');
        setSuccessMsg(`Human review successfully resolved: ${decision}`);
        router.refresh();
      }
    } catch (err: any) {
      setResolveError(err.message || 'Network error');
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <Stack spacing={1.5} sx={{ alignItems: 'flex-end', width: { xs: '100%', sm: 'auto' } }}>
      <Stack direction="row" spacing={1.5} sx={{ flexWrap: 'wrap', gap: 1 }}>
        {/* Recalculate Score Button */}
        <Button
          onClick={handleScore}
          disabled={loadingAction !== null}
          variant="outlined"
          size="small"
          className="btn-secondary"
          startIcon={
            loadingAction === 'score' ? (
              <CircularProgress size={14} color="inherit" />
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M23 4v6h-6" />
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
            )
          }
          sx={{ textTransform: 'none', fontSize: '0.8125rem' }}
        >
          {loadingAction === 'score' ? 'Recalculating...' : 'Recalculate Score'}
        </Button>

        {/* Run Restriction Check Button */}
        <Button
          onClick={handleRestrictionCheck}
          disabled={loadingAction !== null}
          variant="outlined"
          size="small"
          className="btn-secondary"
          startIcon={
            loadingAction === 'restriction' ? (
              <CircularProgress size={14} color="inherit" />
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            )
          }
          sx={{ textTransform: 'none', fontSize: '0.8125rem' }}
        >
          {loadingAction === 'restriction' ? 'Checking Safety...' : 'Run Restriction Check'}
        </Button>

        {/* AI Control Buttons (Deliberate & Trustworthy Controls per Section 11) */}
        {currentAIState === 'AI_ACTIVE' && (
          <Button
            onClick={() => handleAIControl('pause')}
            disabled={loadingAction !== null}
            variant="outlined"
            size="small"
            sx={{
              textTransform: 'none',
              fontSize: '0.8125rem',
              borderColor: 'rgba(245, 158, 11, 0.4)',
              color: '#fbbf24',
              bgcolor: 'var(--accent-warning-muted)',
              '&:hover': {
                borderColor: 'rgba(245, 158, 11, 0.7)',
                bgcolor: 'rgba(245, 158, 11, 0.18)',
              },
            }}
          >
            {loadingAction === 'pause' ? 'Pausing...' : 'Pause AI Engine'}
          </Button>
        )}

        {currentAIState !== 'TAKEN_OVER' && (
          <Button
            onClick={() => handleAIControl('take-over')}
            disabled={loadingAction !== null}
            variant="outlined"
            size="small"
            sx={{
              textTransform: 'none',
              fontSize: '0.8125rem',
              borderColor: 'rgba(99, 102, 241, 0.4)',
              color: 'var(--accent-primary-light)',
              bgcolor: 'var(--accent-primary-muted)',
              '&:hover': {
                borderColor: 'rgba(99, 102, 241, 0.7)',
                bgcolor: 'rgba(99, 102, 241, 0.18)',
              },
            }}
          >
            {loadingAction === 'take-over' ? 'Taking Over...' : 'Take Over Lead'}
          </Button>
        )}

        {currentAIState !== 'AI_ACTIVE' && (
          <Button
            onClick={() => handleAIControl('resume')}
            disabled={loadingAction !== null}
            variant="outlined"
            size="small"
            sx={{
              textTransform: 'none',
              fontSize: '0.8125rem',
              borderColor: 'rgba(16, 185, 129, 0.4)',
              color: '#34d399',
              bgcolor: 'var(--accent-success-muted)',
              '&:hover': {
                borderColor: 'rgba(16, 185, 129, 0.7)',
                bgcolor: 'rgba(16, 185, 129, 0.18)',
              },
            }}
          >
            {loadingAction === 'resume' ? 'Resuming...' : 'Resume Autonomous AI'}
          </Button>
        )}

        {/* Human Review Resolution Button (ADMIN Only) */}
        {pendingReviewId && (
          isAdmin ? (
            <Button
              onClick={() => setShowResolveModal(true)}
              disabled={loadingAction !== null}
              variant="contained"
              size="small"
              sx={{
                bgcolor: 'var(--accent-warning)',
                color: '#000000',
                fontWeight: 600,
                fontSize: '0.8125rem',
                textTransform: 'none',
                px: 2,
                '&:hover': {
                  bgcolor: '#d97706',
                },
              }}
            >
              Resolve Human Review →
            </Button>
          ) : (
            <Tooltip title="Only operators with ADMIN role can resolve compliance reviews" arrow>
              <span>
                <Button
                  disabled
                  variant="outlined"
                  size="small"
                  sx={{
                    opacity: 0.5,
                    cursor: 'not-allowed',
                    textTransform: 'none',
                    fontSize: '0.8125rem',
                    borderColor: 'var(--border-subtle)',
                    color: 'var(--text-muted)',
                  }}
                >
                  Resolve Review (Admin Only)
                </Button>
              </span>
            </Tooltip>
          )
        )}
      </Stack>

      {/* Real Success Alert */}
      {successMsg && (
        <Alert severity="success" sx={{ py: 0.5, width: '100%', fontSize: '0.8125rem' }}>
          {successMsg}
        </Alert>
      )}

      {/* Real Error Alert */}
      {error && (
        <Alert severity="error" sx={{ py: 0.5, width: '100%', fontSize: '0.8125rem' }}>
          {error}
        </Alert>
      )}

      {/* MUI Dialog: Resolve Human Review */}
      <Dialog
        open={showResolveModal}
        onClose={() => !loadingAction && setShowResolveModal(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: 'var(--bg-surface-elevated)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-elevated)',
          },
        }}
      >
        <DialogTitle sx={{ pb: 1, borderBottom: '1px solid var(--border-subtle)' }}>
          <Typography variant="h3" sx={{ color: 'var(--text-primary)', mb: 0.5 }}>
            Resolve Governance Review
          </Typography>
          <Typography variant="body2" sx={{ color: 'var(--text-secondary)' }}>
            Lead #{leadId.substring(0, 8)} • Mandatory Audit Justification Required
          </Typography>
        </DialogTitle>

        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, py: 3 }}>
          {/* Decision Choice */}
          <FormControl component="fieldset">
            <FormLabel component="legend" sx={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', mb: 1 }}>
              Resolution Clearance Decision:
            </FormLabel>
            <RadioGroup
              row
              value={decision}
              onChange={(e) => setDecision(e.target.value as 'APPROVED' | 'REJECTED')}
            >
              <FormControlLabel
                value="APPROVED"
                control={<Radio sx={{ color: '#34d399', '&.Mui-checked': { color: '#10b981' } }} size="small" />}
                label={
                  <Typography variant="body2" sx={{ color: '#34d399', fontWeight: 600 }}>
                    APPROVE (Clear & Resume Outreach)
                  </Typography>
                }
              />
              <FormControlLabel
                value="REJECTED"
                control={<Radio sx={{ color: '#fb7185', '&.Mui-checked': { color: '#f43f5e' } }} size="small" />}
                label={
                  <Typography variant="body2" sx={{ color: '#fb7185', fontWeight: 600 }}>
                    REJECT (Uphold Restriction)
                  </Typography>
                }
              />
            </RadioGroup>
          </FormControl>

          {/* Written Justification Field */}
          <Box>
            <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="subtitle2" sx={{ color: 'var(--text-secondary)' }}>
                Mandatory Written Justification (min 10 chars):
              </Typography>
              <Typography
                variant="caption"
                sx={{
                  color: justification.trim().length >= 10 ? '#34d399' : '#fbbf24',
                  fontWeight: 600,
                }}
              >
                {justification.trim().length} / 10 min chars
              </Typography>
            </Stack>

            <TextField
              multiline
              rows={3}
              fullWidth
              value={justification}
              onChange={(e: any) => setJustification(e.target.value)}
              placeholder="Explain the compliance rationale for approving or rejecting this restriction..."
              size="small"
              sx={{
                bgcolor: 'var(--bg-surface-subtle)',
                borderRadius: 'var(--radius-sm)',
                '& .MuiOutlinedInput-root': {
                  border: '1px solid var(--border-default)',
                  color: 'var(--text-primary)',
                  fontSize: '0.875rem',
                },
              }}
            />
          </Box>

          {resolveError && (
            <Alert severity="error" sx={{ py: 0.5, fontSize: '0.8125rem' }}>
              {resolveError}
            </Alert>
          )}
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2, borderTop: '1px solid var(--border-subtle)' }}>
          <Button
            onClick={() => setShowResolveModal(false)}
            disabled={loadingAction !== null}
            variant="outlined"
            size="small"
            className="btn-secondary"
            sx={{ textTransform: 'none' }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleResolveSubmit}
            disabled={loadingAction !== null || justification.trim().length < 10}
            variant="contained"
            size="small"
            sx={{
              textTransform: 'none',
              fontWeight: 600,
              bgcolor: decision === 'APPROVED' ? 'var(--accent-success)' : 'var(--accent-danger)',
              '&:hover': {
                bgcolor: decision === 'APPROVED' ? '#059669' : '#e11d48',
              },
            }}
            startIcon={
              loadingAction === 'resolve' ? <CircularProgress size={14} color="inherit" /> : undefined
            }
          >
            {loadingAction === 'resolve' ? 'Submitting Resolution...' : `Confirm ${decision}`}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
