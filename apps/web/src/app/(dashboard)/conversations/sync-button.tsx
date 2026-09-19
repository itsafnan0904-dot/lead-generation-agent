'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';

export function SyncInboxButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<{
    messagesFound: number;
    newMessagesIngested: number;
    skippedDuplicates: number;
  } | null>(null);

  const handleSync = async () => {
    setLoading(true);
    setError(null);
    setSyncResult(null);

    try {
      const res = await fetch('/api/gmail/sync', { method: 'POST' });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to synchronize Gmail inbox');
      } else {
        setSyncResult({
          messagesFound: data.messagesFound ?? 0,
          newMessagesIngested: data.newMessagesIngested ?? 0,
          skippedDuplicates: data.skippedDuplicates ?? 0,
        });
        router.refresh();
      }
    } catch (err: any) {
      setError(err.message || 'Network communication error during inbox sync');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Stack spacing={1.5} sx={{ alignItems: { xs: 'flex-start', sm: 'flex-end' }, width: { xs: '100%', sm: 'auto' } }}>
      <Button
        onClick={handleSync}
        disabled={loading}
        variant="contained"
        size="small"
        sx={{
          bgcolor: 'var(--accent-info)',
          color: '#ffffff',
          fontWeight: 600,
          fontSize: '0.8125rem',
          px: 2,
          py: 0.8,
          borderRadius: 'var(--radius-sm)',
          border: '1px solid rgba(56, 189, 248, 0.4)',
          boxShadow: '0 2px 8px rgba(14, 165, 233, 0.2)',
          textTransform: 'none',
          letterSpacing: '0.01em',
          transition: 'var(--transition-default)',
          '&:hover': {
            bgcolor: '#0284c7',
            borderColor: 'rgba(56, 189, 248, 0.7)',
            boxShadow: '0 4px 12px rgba(14, 165, 233, 0.35)',
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
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
            </svg>
          )
        }
      >
        {loading ? 'Synchronizing Gmail Inbox...' : 'Sync Inbox Now'}
      </Button>

      {/* Sync Real Result Feedback */}
      {syncResult && (
        <Alert
          severity="success"
          sx={{
            py: 0.5,
            px: 1.5,
            fontSize: '0.75rem',
            bgcolor: 'var(--accent-success-muted)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            color: '#34d399',
            maxWidth: 440,
            '& .MuiAlert-icon': { color: '#34d399' },
          }}
        >
          Inbox Sync Complete: <strong>{syncResult.newMessagesIngested}</strong> new message{syncResult.newMessagesIngested === 1 ? '' : 's'} ingested (
          {syncResult.messagesFound} found in Gmail, {syncResult.skippedDuplicates} duplicates skipped).
        </Alert>
      )}

      {/* Real Error Feedback */}
      {error && (
        <Alert
          severity="error"
          sx={{
            py: 0.5,
            px: 1.5,
            fontSize: '0.75rem',
            bgcolor: 'var(--accent-danger-muted)',
            border: '1px solid rgba(244, 63, 94, 0.3)',
            color: '#fb7185',
            maxWidth: 440,
            '& .MuiAlert-icon': { color: '#fb7185' },
          }}
        >
          {error}
        </Alert>
      )}
    </Stack>
  );
}

