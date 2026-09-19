import { redirect } from 'next/navigation';
import { serverApiFetch } from '@/lib/server-api-client';

export default async function RootPage() {
  const { data } = await serverApiFetch<{ user: any }>('/auth/me');

  if (data?.user) {
    redirect('/overview');
  } else {
    redirect('/login');
  }
}
