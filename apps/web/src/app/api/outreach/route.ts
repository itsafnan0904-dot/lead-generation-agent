import { NextResponse } from 'next/server';
import { serverApiFetch } from '@/lib/server-api-client';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const leadId = searchParams.get('leadId');
  const status = searchParams.get('status');
  const page = searchParams.get('page') || '1';
  const limit = searchParams.get('limit') || '20';

  const params = new URLSearchParams();
  if (leadId) params.set('leadId', leadId);
  if (status) params.set('status', status);
  params.set('page', page);
  params.set('limit', limit);

  const result = await serverApiFetch(`/outreach?${params.toString()}`);

  if (!result.data || result.error) {
    return NextResponse.json(
      { error: result.error || 'Failed to fetch outreach drafts' },
      { status: result.status || 500 },
    );
  }

  return NextResponse.json(result.data);
}
