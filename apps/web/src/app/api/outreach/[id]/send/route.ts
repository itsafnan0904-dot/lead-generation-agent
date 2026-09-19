import { NextResponse } from 'next/server';
import { serverApiFetch } from '@/lib/server-api-client';

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  const draftId = params.id;
  const result = await serverApiFetch(`/outreach/${draftId}/send`, {
    method: 'POST',
  });

  if (!result.data || result.error) {
    return NextResponse.json(
      { error: result.error || 'Failed to send outreach email' },
      { status: result.status || 500 },
    );
  }

  return NextResponse.json(result.data, { status: result.status || 200 });
}
