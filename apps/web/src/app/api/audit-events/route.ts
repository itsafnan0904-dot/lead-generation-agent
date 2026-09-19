import { NextResponse } from 'next/server';
import { serverApiFetch } from '@/lib/server-api-client';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const actorType = searchParams.get('actorType');
  const entityType = searchParams.get('entityType');
  const entityId = searchParams.get('entityId');
  const action = searchParams.get('action');
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  const page = searchParams.get('page') || '1';
  const limit = searchParams.get('limit') || '20';

  const params = new URLSearchParams();
  if (actorType && actorType !== 'ALL') params.set('actorType', actorType);
  if (entityType && entityType !== 'ALL') params.set('entityType', entityType);
  if (entityId) params.set('entityId', entityId);
  if (action && action !== 'ALL') params.set('action', action);
  if (startDate) params.set('startDate', startDate);
  if (endDate) params.set('endDate', endDate);
  params.set('page', page);
  params.set('limit', limit);

  const result = await serverApiFetch(`/audit-events?${params.toString()}`);

  if (!result.data || result.error) {
    return NextResponse.json(
      { error: result.error || 'Failed to fetch audit events' },
      { status: result.status || 500 },
    );
  }

  return NextResponse.json(result.data);
}
