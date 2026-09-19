import { NextResponse } from 'next/server';
import { serverApiFetch } from '@/lib/server-api-client';

export async function GET() {
  const result = await serverApiFetch<{ user: any }>('/auth/me');

  if (!result.data || result.error) {
    return NextResponse.json(
      { error: result.error || 'Unauthorized' },
      { status: result.status || 401 },
    );
  }

  return NextResponse.json({ user: result.data.user });
}
