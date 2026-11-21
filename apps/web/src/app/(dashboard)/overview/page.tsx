import React from 'react';
import { redirect } from 'next/navigation';
import Box from '@mui/material/Box';
import { Header } from '@/components/header';
import { serverApiFetch } from '@/lib/server-api-client';
import { PriorityBoard, BoardLead } from './priority-board';
import {
  OverviewMetrics,
  HealthData,
  LeadsData,
  NotificationsData,
} from './overview-metrics';

export default async function OverviewPage() {
  // Send users who haven't finished seller onboarding to the setup wizard first.
  const profileRes = await serverApiFetch<{ onboardingComplete: boolean }>('/seller-profile');
  if (profileRes.status === 404 || (profileRes.data && !profileRes.data.onboardingComplete)) {
    redirect('/onboarding');
  }

  // Fetch real data simultaneously from verified backend endpoints
  const [healthRes, leadsRes, notifsRes, needsYouRes, topLeadsRes] = await Promise.all([
    // Dependency details need a login; the public /health probe only reports an overall status
    serverApiFetch<HealthData>('/health/details'),
    serverApiFetch<LeadsData>('/leads?limit=100'),
    serverApiFetch<NotificationsData>('/notifications?isRead=false&limit=5'),
    serverApiFetch<{ items: BoardLead[] }>('/leads?needsHuman=true&sort=priority&limit=5'),
    serverApiFetch<{ items: BoardLead[] }>('/leads?sort=priority&limit=10'),
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

      <PriorityBoard needsYou={needsYouRes.data?.items ?? []} topLeads={topLeadsRes.data?.items ?? []} />

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
