import { NextResponse } from 'next/server';
import { serverApiFetch } from '@/lib/server-api-client';

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  const companyId = params.id;
  const body = await request.json().catch(() => ({}));

  const result = await serverApiFetch(`/companies/${companyId}/research`, {
    method: 'POST',
    body: JSON.stringify(body),
  });

  if (!result.data || result.error) {
    return NextResponse.json(
      { error: result.error || 'Failed to trigger company research' },
      { status: result.status || 500 },
    );
  }

  return NextResponse.json(result.data);
}
