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
      <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 4 }}>
        {/* Recalculate Score Button */}
        <Button
          onClick={handleScore}
          disabled={loadingAction !== null}
          variant="outlined"
          size="small"
          startIcon={
            loadingAction === 'score' ? (
              <CircularProgress size={13} color="inherit" />
            ) : (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M23 4v6h-6" />
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
            )
          }
          sx={{
            textTransform: 'none',
            fontSize: '0.8125rem',
            fontWeight: 500,
            color: '#ededed',
            borderColor: 'rgba(237, 237, 237, 0.09)',
            bgcolor: '#1e1e20',
            borderRadius: '8px',
            px: 1.5,
            py: 0.6,
            transition: 'background-color 140ms cubic-bezier(0.23, 1, 0.32, 1), border-color 140ms cubic-bezier(0.23, 1, 0.32, 1)',
            '&:hover:not(:disabled)': {
              bgcolor: 'rgba(237, 237, 237, 0.06)',
              borderColor: 'rgba(237, 237, 237, 0.16)',
            },
            '&:active:not(:disabled)': {
              transform: 'scale(0.97)',
            },
          }}
        >
          {loadingAction === 'score' ? 'Recalculating...' : 'Recalculate Score'}
        </Button>

        {/* Run Restriction Check Button */}
        <Button
          onClick={handleRestrictionCheck}
          disabled={loadingAction !== null}
          variant="outlined"
          size="small"
          startIcon={
            loadingAction === 'restriction' ? (
              <CircularProgress size={13} color="inherit" />
            ) : (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            )
          }
          sx={{
            textTransform: 'none',
            fontSize: '0.8125rem',
            fontWeight: 500,
            color: '#ededed',
            borderColor: 'rgba(237, 237, 237, 0.09)',
            bgcolor: '#1e1e20',
            borderRadius: '8px',
            px: 1.5,
            py: 0.6,
            transition: 'background-color 140ms cubic-bezier(0.23, 1, 0.32, 1), border-color 140ms cubic-bezier(0.23, 1, 0.32, 1)',
            '&:hover:not(:disabled)': {
              bgcolor: 'rgba(237, 237, 237, 0.06)',
              borderColor: 'rgba(237, 237, 237, 0.16)',
            },
            '&:active:not(:disabled)': {
              transform: 'scale(0.97)',
            },
          }}
        >
          {loadingAction === 'restriction' ? 'Checking Safety...' : 'Run Restriction Check'}
        </Button>

        {/* AI Control Buttons */}
        {currentAIState === 'AI_ACTIVE' && (
          <Button
            onClick={() => handleAIControl('pause')}
            disabled={loadingAction !== null}
            variant="outlined"
            size="small"
            sx={{
              textTransform: 'none',
              fontSize: '0.8125rem',
              fontWeight: 500,
              borderColor: 'rgba(237, 237, 237, 0.09)',
              color: '#ededed',
              bgcolor: 'rgba(227, 169, 77, 0.08)',
              borderRadius: '8px',
              px: 1.5,
              py: 0.6,
              transition: 'background-color 140ms cubic-bezier(0.23, 1, 0.32, 1), border-color 140ms cubic-bezier(0.23, 1, 0.32, 1)',
              '&:hover:not(:disabled)': {
                borderColor: 'rgba(237, 237, 237, 0.09)',
                bgcolor: 'rgba(227, 169, 77, 0.14)',
              },
              '&:active:not(:disabled)': {
                transform: 'scale(0.97)',
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
              fontWeight: 500,
              borderColor: 'rgba(237, 237, 237, 0.09)',
              color: '#ededed',
              bgcolor: 'rgba(94, 140, 235, 0.08)',
              borderRadius: '8px',
              px: 1.5,
              py: 0.6,
              transition: 'background-color 140ms cubic-bezier(0.23, 1, 0.32, 1), border-color 140ms cubic-bezier(0.23, 1, 0.32, 1)',
              '&:hover:not(:disabled)': {
                borderColor: 'rgba(237, 237, 237, 0.09)',
                bgcolor: 'rgba(94, 140, 235, 0.14)',
              },
              '&:active:not(:disabled)': {
                transform: 'scale(0.97)',
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
              fontWeight: 500,
              borderColor: 'rgba(237, 237, 237, 0.09)',
              color: '#ededed',
              bgcolor: 'rgba(76, 195, 138, 0.08)',
              borderRadius: '8px',
              px: 1.5,
              py: 0.6,
              transition: 'background-color 140ms cubic-bezier(0.23, 1, 0.32, 1), border-color 140ms cubic-bezier(0.23, 1, 0.32, 1)',
              '&:hover:not(:disabled)': {
                borderColor: 'rgba(237, 237, 237, 0.09)',
                bgcolor: 'rgba(76, 195, 138, 0.14)',
              },
              '&:active:not(:disabled)': {
                transform: 'scale(0.97)',
              },
            }}
          >
            {loadingAction === 'resume' ? 'Resuming...' : 'Resume AI'}
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
                bgcolor: '#e3a94d',
                color: '#000000',
                fontWeight: 500,
                fontSize: '0.8125rem',
                textTransform: 'none',
                px: 2,
                py: 0.6,
                borderRadius: '8px',
                transition: 'background-color 140ms cubic-bezier(0.23, 1, 0.32, 1)',
                '&:hover:not(:disabled)': {
                  bgcolor: '#c48c32',
                },
                '&:active:not(:disabled)': {
                  transform: 'scale(0.97)',
                },
              }}
            >
              Resolve review
            </Button>
          ) : (
            <Tooltip title="Only operators with ADMIN role can resolve compliance reviews" arrow>
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
                    borderColor: 'rgba(237, 237, 237, 0.09)',
                    color: '#85858b',
                    borderRadius: '8px',
                    px: 1.5,
                    py: 0.6,
                  }}
                >
                  Resolve Review (Admin Only)
                </Button>
              </span>
            </Tooltip>
          )
        )}
      </Stack>

      {/* Success Alert */}
      {successMsg && (
        <Alert severity="success" sx={{ py: 0.5, width: '100%', fontSize: '0.8125rem', bgcolor: 'rgba(76, 195, 138, 0.10)', color: '#4cc38a', border: '1px solid rgba(237, 237, 237, 0.09)', borderRadius: '8px' }}>
          {successMsg}
        </Alert>
      )}

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ py: 0.5, width: '100%', fontSize: '0.8125rem', bgcolor: 'rgba(229, 72, 77, 0.10)', color: '#ee7378', border: '1px solid rgba(237, 237, 237, 0.09)', borderRadius: '8px' }}>
          {error}
        </Alert>
      )}

      {/* Dialog: Resolve Human Review */}
      <Dialog
        open={showResolveModal}
        onClose={() => !loadingAction && setShowResolveModal(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: '#19191b',
            border: '1px solid rgba(237, 237, 237, 0.09)',
            borderRadius: '12px',
            boxShadow: '0 12px 32px -4px rgba(0, 0, 0, 0.7)',
          },
        }}
      >
        <DialogTitle sx={{ pb: 1.5, borderBottom: '1px solid rgba(237, 237, 237, 0.06)' }}>
          <Typography variant="h3" sx={{ color: '#ededed', mb: 0.5, fontSize: '1rem', fontWeight: 500, }}>
            Mark review resolved
          </Typography>
          <Typography variant="body2" sx={{ color: '#a1a1a6', fontSize: '0.8125rem' }}>
            Lead #{leadId.substring(0, 8)} • Mandatory Audit Justification Required
          </Typography>
        </DialogTitle>

        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, py: 3 }}>
          {/* Decision Choice */}
          <FormControl component="fieldset">
            <FormLabel component="legend" sx={{ fontSize: '0.8125rem', color: '#a1a1a6', mb: 1, fontWeight: 500 }}>
              Resolution Clearance Decision:
            </FormLabel>
            <RadioGroup
              row
              value={decision}
              onChange={(e) => setDecision(e.target.value as 'APPROVED' | 'REJECTED')}
            >
              <FormControlLabel
                value="APPROVED"
                control={<Radio sx={{ color: '#4cc38a', '&.Mui-checked': { color: '#4cc38a' } }} size="small" />}
                label={
                  <Typography variant="body2" sx={{ color: '#4cc38a', fontWeight: 500, fontSize: '0.8125rem' }}>
                    APPROVE (Clear & Resume Outreach)
                  </Typography>
                }
              />
              <FormControlLabel
                value="REJECTED"
                control={<Radio sx={{ color: '#ee7378', '&.Mui-checked': { color: '#e5484d' } }} size="small" />}
                label={
                  <Typography variant="body2" sx={{ color: '#ee7378', fontWeight: 500, fontSize: '0.8125rem' }}>
                    REJECT (Uphold Restriction)
                  </Typography>
                }
              />
            </RadioGroup>
          </FormControl>

          {/* Written Justification Field */}
          <Box>
            <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="subtitle2" sx={{ color: '#a1a1a6', fontSize: '0.8125rem', fontWeight: 500 }}>
                Mandatory Written Justification (min 10 chars):
              </Typography>
              <Typography
                variant="caption"
                sx={{
                  color: justification.trim().length >= 10 ? '#4cc38a' : '#e3a94d',
                  fontWeight: 500,
                  fontSize: '0.75rem',
                  fontVariantNumeric: 'tabular-nums',
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
                bgcolor: '#1e1e20',
                borderRadius: '8px',
                '& .MuiOutlinedInput-root': {
                  border: '1px solid rgba(237, 237, 237, 0.09)',
                  color: '#ededed',
                  fontSize: '0.875rem',
                  '&:hover': {
                    borderColor: 'rgba(237, 237, 237, 0.16)',
                  },
                  '&.Mui-focused': {
                    borderColor: '#4f82e6',
                  },
                },
                '& .MuiOutlinedInput-notchedOutline': {
                  border: 'none',
                },
              }}
            />
          </Box>

          {resolveError && (
            <Alert severity="error" sx={{ py: 0.5, fontSize: '0.8125rem', bgcolor: 'rgba(229, 72, 77, 0.10)', color: '#ee7378', border: '1px solid rgba(237, 237, 237, 0.09)', borderRadius: '8px' }}>
              {resolveError}
            </Alert>
          )}
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2, borderTop: '1px solid rgba(237, 237, 237, 0.06)' }}>
          <Button
            onClick={() => setShowResolveModal(false)}
            disabled={loadingAction !== null}
            variant="outlined"
            size="small"
            sx={{
              textTransform: 'none',
              fontSize: '0.8125rem',
              color: '#ededed',
              borderColor: 'rgba(237, 237, 237, 0.09)',
              borderRadius: '8px',
              px: 2,
              '&:hover': {
                bgcolor: 'rgba(237, 237, 237, 0.06)',
                borderColor: 'rgba(237, 237, 237, 0.16)',
              },
            }}
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
              fontWeight: 500,
              fontSize: '0.8125rem',
              borderRadius: '8px',
              px: 2,
              bgcolor: decision === 'APPROVED' ? '#4cc38a' : '#e5484d',
              '&:hover:not(:disabled)': {
                bgcolor: decision === 'APPROVED' ? '#3aa874' : '#d2565b',
              },
              '&:active:not(:disabled)': {
                transform: 'scale(0.97)',
              },
            }}
            startIcon={
              loadingAction === 'resolve' ? <CircularProgress size={13} color="inherit" /> : undefined
            }
          >
            {loadingAction === 'resolve' ? 'Submitting Resolution...' : `Confirm ${decision}`}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}

