import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { Header } from '@/components/header';
import { serverApiFetch } from '@/lib/server-api-client';
import { NotificationsList, NotificationItem } from './notifications-list';

interface NotificationsResponse {
  items: NotificationItem[];
  total: number;
  unreadCount: number;
  page: number;
  limit: number;
  totalPages: number;
}

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: { priority?: string; isRead?: string; page?: string };
}) {
  const priority = searchParams.priority;
  const isRead = searchParams.isRead;
  const page = searchParams.page || '1';
  const limit = '20';

  const query = new URLSearchParams();
  if (priority && priority !== 'ALL') query.set('priority', priority);
  if (isRead) query.set('isRead', isRead);
  query.set('page', page);
  query.set('limit', limit);

  const res = await serverApiFetch<NotificationsResponse>(`/notifications?${query.toString()}`);
  const data = res.data || {
    items: [],
    total: 0,
    unreadCount: 0,
    page: 1,
    limit: 20,
    totalPages: 0,
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      <Header title="Notifications & System Alerts" />

      <Box
        component="main"
        sx={{
          p: { xs: 2, sm: 3, md: 4 },
          maxWidth: 1200,
          width: '100%',
          mx: 'auto',
        }}
      >
        <Box sx={{ mb: 3.5 }}>
          <Typography
            variant="h1"
            sx={{
              fontSize: '1.5rem',
              fontWeight: 700,
              lineHeight: 1.2,
              letterSpacing: '-0.025em',
              color: 'var(--text-primary)',
            }}
          >
            Notifications & System Alerts
          </Typography>
          <Typography
            variant="body2"
            sx={{
              mt: 0.75,
              fontSize: '0.875rem',
              lineHeight: 1.5,
              color: 'var(--text-secondary)',
            }}
          >
            Live autonomous agent feed, human review escalations, policy compliance alerts, and outreach transmissions.
          </Typography>
        </Box>

        <NotificationsList
          initialNotifications={data.items}
          initialTotal={data.total}
          initialUnreadCount={data.unreadCount}
          initialPage={data.page}
          initialLimit={data.limit}
          initialPriority={priority || 'ALL'}
          initialUnreadOnly={isRead === 'false'}
        />
      </Box>
    </Box>
  );
}
