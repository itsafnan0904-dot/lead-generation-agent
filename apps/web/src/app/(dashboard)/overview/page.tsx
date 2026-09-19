import React from 'react';
import Box from '@mui/material/Box';
import { Header } from '@/components/header';
import { serverApiFetch } from '@/lib/server-api-client';
import {
  OverviewMetrics,
  HealthData,
  LeadsData,
  NotificationsData,
} from './overview-metrics';

export default async function OverviewPage() {
  // Fetch real data simultaneously from verified backend endpoints
  const [healthRes, leadsRes, notifsRes] = await Promise.all([
    serverApiFetch<HealthData>('/health', { skipAuth: true }),
    serverApiFetch<LeadsData>('/leads?limit=100'),
    serverApiFetch<NotificationsData>('/notifications?isRead=false&limit=5'),
  ]);

  const health = healthRes.data;
  const leads = leadsRes.data;
  const notifs = notifsRes.data;

  // Compute lead lifecycle distribution from returned leads items
  const leadDistribution: Record<string, number> = {};
  if (leads?.items) {
    for (const lead of leads.items) {
      leadDistribution[lead.status] = (leadDistribution[lead.status] || 0) + 1;
    }
  }

  // Group notifications by priority
  const priorityBreakdown = {
    ACTION_REQUIRED: 0,
    IMPORTANT: 0,
    INFO: 0,
  };

  if (notifs?.items) {
    for (const item of notifs.items) {
      if (item.priority in priorityBreakdown) {
        priorityBreakdown[item.priority]++;
      }
    }
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      <Header title="Overview & System Status" />

      <OverviewMetrics
        health={health}
        leads={leads}
        notifs={notifs}
        leadDistribution={leadDistribution}
        priorityBreakdown={priorityBreakdown}
      />
    </Box>
  );
}
