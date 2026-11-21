import React from 'react';
import { redirect } from 'next/navigation';
import { Header } from '@/components/header';
import { serverApiFetch } from '@/lib/server-api-client';
import { Dashboard, DashboardData } from './dashboard';

export default async function OverviewPage() {
  // Send users who haven't finished seller onboarding to the setup wizard first.
  const profileRes = await serverApiFetch<{ onboardingComplete: boolean }>('/seller-profile');
  if (profileRes.status === 404 || (profileRes.data && !profileRes.data.onboardingComplete)) {
    redirect('/onboarding');
  }

  const [health, leads, notifs, needsYou, top, pipeline, campaigns] = await Promise.all([
    // Dependency details need a login; the public /health probe only reports an overall status
    serverApiFetch<DashboardData['health']>('/health/details'),
    serverApiFetch<{ items: { status: string }[]; total: number }>('/leads?limit=100'),
    serverApiFetch<{ unreadCount: number }>('/notifications?isRead=false&limit=1'),
    serverApiFetch<{ items: DashboardData['needsYou']; total: number }>('/leads?needsHuman=true&sort=priority&limit=5'),
    serverApiFetch<{ items: DashboardData['top'] }>('/leads?sort=priority&limit=8'),
    serverApiFetch<DashboardData['pipeline']>('/opportunities'),
    serverApiFetch<{ status: string }[]>('/campaigns'),
  ]);

  const byStatus: Record<string, number> = {};
  for (const l of leads.data?.items ?? []) byStatus[l.status] = (byStatus[l.status] ?? 0) + 1;

  return (
    <>
      <Header title="Overview" />
      <Dashboard
        data={{
          health: health.data,
          totalLeads: leads.data?.total ?? 0,
          byStatus,
          unread: notifs.data?.unreadCount ?? 0,
          needsYou: needsYou.data?.items ?? [],
          needsYouTotal: needsYou.data?.total ?? 0,
          top: top.data?.items ?? [],
          pipeline: pipeline.data,
          activeCampaigns: (campaigns.data ?? []).filter((c) => c.status === 'ACTIVE').length,
        }}
      />
    </>
  );
}
