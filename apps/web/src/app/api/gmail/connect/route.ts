import { NextResponse } from 'next/server';
import { serverApiFetch } from '@/lib/server-api-client';

export async function GET() {
  const result = await serverApiFetch('/gmail/connect');

  if (!result.data || result.error) {
    return NextResponse.json(
      { error: result.error || 'Failed to initiate Gmail connection' },
      { status: result.status || 500 },
    );
  }

  return NextResponse.json(result.data);
}
