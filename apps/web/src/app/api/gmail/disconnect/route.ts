import { NextResponse } from 'next/server';
import { serverApiFetch } from '@/lib/server-api-client';

export async function POST() {
  const result = await serverApiFetch('/gmail/disconnect', {
    method: 'POST',
  });

  if (!result.data || result.error) {
    return NextResponse.json(
      { error: result.error || 'Failed to disconnect Gmail account' },
      { status: result.status || 500 },
    );
  }

  return NextResponse.json(result.data);
}
