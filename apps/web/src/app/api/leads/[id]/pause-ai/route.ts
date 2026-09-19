import { NextResponse } from 'next/server';
import { serverApiFetch } from '@/lib/server-api-client';

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  const leadId = params.id;
  const result = await serverApiFetch(`/leads/${leadId}/pause-ai`, {
    method: 'POST',
  });

  if (!result.data || result.error) {
    return NextResponse.json(
      { error: result.error || 'Failed to pause AI' },
      { status: result.status || 500 },
    );
  }

  return NextResponse.json(result.data);
}
