import { NextResponse } from 'next/server';
import { serverApiFetch } from '@/lib/server-api-client';

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  const leadId = params.id;
  let body = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const result = await serverApiFetch(`/leads/${leadId}/outreach/draft`, {
    method: 'POST',
    body: JSON.stringify(body),
  });

  if (!result.data || result.error) {
    return NextResponse.json(
      { error: result.error || 'Failed to generate outreach draft' },
      { status: result.status || 500 },
    );
  }

  return NextResponse.json(result.data, { status: result.status || 201 });
}
