import { NextResponse } from 'next/server';
import { serverApiFetch } from '@/lib/server-api-client';

export async function POST(request: Request) {
  const body = await request.text();
  const result = await serverApiFetch('/discovery/import', { method: 'POST', body });

  if (result.error || !result.data) {
    return NextResponse.json({ error: result.error || 'Import failed' }, { status: result.status || 500 });
  }
  return NextResponse.json(result.data);
}
