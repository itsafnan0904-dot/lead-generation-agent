import React from 'react';
import { redirect } from 'next/navigation';
import { serverApiFetch } from '@/lib/server-api-client';
import { Shell } from '@/components/shell';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Server-side authentication check
  const { data, status } = await serverApiFetch<{ user: any }>('/auth/me');

  if (status === 401 || !data?.user) {
    redirect('/login');
  }

  return <Shell>{children}</Shell>;
}
