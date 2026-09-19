import { NextResponse } from 'next/server';
import { serverApiFetch } from '@/lib/server-api-client';

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  const notifId = params.id;
  const result = await serverApiFetch(`/notifications/${notifId}/read`, {
    method: 'PATCH',
  });

  if (!result.data || result.error) {
    return NextResponse.json(
      { error: result.error || 'Failed to mark notification as read' },
      { status: result.status || 500 },
    );
  }

  return NextResponse.json(result.data);
}
