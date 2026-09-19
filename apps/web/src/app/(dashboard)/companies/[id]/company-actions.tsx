'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

interface CompanyActionButtonsProps {
  companyId: string;
  companyName: string;
}

export function CompanyActionButtons({
  companyId,
  companyName,
}: CompanyActionButtonsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [restrictionAlert, setRestrictionAlert] = useState<string | null>(null);

  const handleRunResearch = async () => {
    setLoading(true);
    setError(null);
    setSuccessMsg(null);
    setRestrictionAlert(null);

    try {
      const startTime = performance.now();
      const res = await fetch(`/api/companies/${companyId}/research`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const data = await res.json();
      const durationMs = Math.round(performance.now() - startTime);

      if (!res.ok) {
        setError(data.error || 'Failed to trigger AI research analysis');
      } else {
        const restrResult = data.restrictionCheck?.result || 'CLEAR';
        const tokenCost =
          data.research?.rawResearchData?.metadata?.usage?.totalTokens ||
          data.research?.rawResearchData?.metadata?.tokensUsed?.totalTokens;
        
        let msg = `AI Market & Company Intelligence generated in ${durationMs}ms for ${companyName}!`;
        if (tokenCost) {
          msg += ` (${tokenCost} tokens consumed)`;
        }
        setSuccessMsg(msg);

        if (restrResult === 'RESTRICTED') {
          setRestrictionAlert(
            `Policy Notice: Evaluation flagged restriction '${restrResult}'. Outbound is blocked by compliance.`
          );
        } else if (restrResult === 'HUMAN_REVIEW') {
          setRestrictionAlert(
            `Policy Notice: Evaluation requires human manager clearance before outbound.`
          );
        }
        router.refresh();
      }
    } catch (err: any) {
      setError(err.message || 'Network communication failure while executing AI research');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Stack spacing={1.5} sx={{ alignItems: 'flex-end', width: { xs: '100%', sm: 'auto' } }}>
      <Button
        onClick={handleRunResearch}
        disabled={loading}
        variant="contained"
        size="small"
        sx={{
          bgcolor: 'var(--accent-info)',
          color: '#ffffff',
          fontWeight: 600,
          fontSize: '0.8125rem',
          px: 2,
          py: 0.9,
          borderRadius: 'var(--radius-sm)',
          border: '1px solid rgba(56, 189, 248, 0.4)',
          boxShadow: '0 2px 8px rgba(14, 165, 233, 0.25)',
          textTransform: 'none',
          letterSpacing: '0.01em',
          transition: 'var(--transition-default)',
          '&:hover': {
            bgcolor: '#0284c7',
            borderColor: 'rgba(56, 189, 248, 0.7)',
            boxShadow: '0 4px 14px rgba(14, 165, 233, 0.4)',
          },
          '&:disabled': {
            bgcolor: 'var(--bg-surface-subtle)',
            color: 'var(--text-muted)',
            borderColor: 'var(--border-subtle)',
          },
        }}
        startIcon={
          loading ? (
            <CircularProgress size={14} sx={{ color: 'inherit' }} />
          ) : (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
            </svg>
          )
        }
      >
        {loading ? 'Executing AI Market Analysis...' : 'Run AI Research'}
      </Button>

      {/* Real Success Alert */}
      {successMsg && (
        <Alert
          severity="success"
          sx={{
            py: 0.75,
            px: 1.5,
            width: '100%',
            maxWidth: 480,
            bgcolor: 'var(--accent-success-muted)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            color: '#34d399',
            fontSize: '0.8125rem',
            '& .MuiAlert-icon': { color: '#34d399' },
          }}
        >
          {successMsg}
        </Alert>
      )}

      {/* Real Restriction Alert */}
      {restrictionAlert && (
        <Alert
          severity={restrictionAlert.includes('RESTRICTED') ? 'error' : 'warning'}
          sx={{
            py: 0.75,
            px: 1.5,
            width: '100%',
            maxWidth: 480,
            bgcolor: restrictionAlert.includes('RESTRICTED') ? 'var(--accent-danger-muted)' : 'var(--accent-warning-muted)',
            border: restrictionAlert.includes('RESTRICTED') ? '1px solid rgba(244, 63, 94, 0.3)' : '1px solid rgba(245, 158, 11, 0.3)',
            color: restrictionAlert.includes('RESTRICTED') ? '#fb7185' : '#fbbf24',
            fontSize: '0.8125rem',
          }}
        >
          {restrictionAlert}
        </Alert>
      )}

      {/* Real Error Alert */}
      {error && (
        <Alert
          severity="error"
          sx={{
            py: 0.75,
            px: 1.5,
            width: '100%',
            maxWidth: 480,
            bgcolor: 'var(--accent-danger-muted)',
            border: '1px solid rgba(244, 63, 94, 0.3)',
            color: '#fb7185',
            fontSize: '0.8125rem',
            '& .MuiAlert-icon': { color: '#fb7185' },
          }}
        >
          {error}
        </Alert>
      )}
    </Stack>
  );
}

