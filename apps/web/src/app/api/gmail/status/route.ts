import { NextResponse } from 'next/server';
import { serverApiFetch } from '@/lib/server-api-client';

export async function GET() {
  const result = await serverApiFetch('/gmail/status');

  if (!result.data || result.error) {
    return NextResponse.json(
      { error: result.error || 'Failed to fetch Gmail connection status' },
      { status: result.status || 500 },
    );
  }

  return NextResponse.json(result.data);
}
