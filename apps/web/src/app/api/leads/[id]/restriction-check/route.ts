import { NextResponse } from 'next/server';
import { serverApiFetch } from '@/lib/server-api-client';

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  const leadId = params.id;
  const body = await request.json().catch(() => ({}));
  const result = await serverApiFetch(`/leads/${leadId}/restriction-check`, {
    method: 'POST',
    body: JSON.stringify(body),
  });

  if (!result.data || result.error) {
    return NextResponse.json(
      { error: result.error || 'Failed to evaluate lead restrictions' },
      { status: result.status || 500 },
    );
  }

  return NextResponse.json(result.data);
}
