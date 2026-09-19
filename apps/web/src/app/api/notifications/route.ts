import { NextResponse } from 'next/server';
import { serverApiFetch } from '@/lib/server-api-client';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const priority = searchParams.get('priority');
  const isRead = searchParams.get('isRead');
  const page = searchParams.get('page') || '1';
  const limit = searchParams.get('limit') || '20';

  const params = new URLSearchParams();
  if (priority && priority !== 'ALL') params.set('priority', priority);
  if (isRead !== null && isRead !== undefined && isRead !== '') params.set('isRead', isRead);
  params.set('page', page);
  params.set('limit', limit);

  const result = await serverApiFetch(`/notifications?${params.toString()}`);

  if (!result.data || result.error) {
    return NextResponse.json(
      { error: result.error || 'Failed to fetch notifications' },
      { status: result.status || 500 },
    );
  }

  return NextResponse.json(result.data);
}
