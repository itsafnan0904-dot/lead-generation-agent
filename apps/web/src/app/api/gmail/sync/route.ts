import { NextResponse } from 'next/server';
import { serverApiFetch } from '@/lib/server-api-client';

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('query') || undefined;
  const maxResults = searchParams.get('maxResults') || undefined;

  const queryParams = new URLSearchParams();
  if (query) queryParams.set('query', query);
  if (maxResults) queryParams.set('maxResults', maxResults);

  const endpoint = `/gmail/sync${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
  console.log(`[Next.js API Proxy] Calling backend POST ${endpoint}...`);

  const result = await serverApiFetch(endpoint, {
    method: 'POST',
  });

  console.log(`[Next.js API Proxy] Result from backend:`, {
    status: result.status,
    hasData: !!result.data,
    error: result.error,
  });

  if (!result.data || result.error) {
    return NextResponse.json(
      { error: result.error || 'Failed to sync Gmail inbox' },
      { status: result.status || 500 },
    );
  }

  return NextResponse.json(result.data);
}
