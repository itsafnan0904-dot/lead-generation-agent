import { NextResponse } from 'next/server';
import { serverApiFetch } from '@/lib/server-api-client';

/**
 * Authenticated pass-through to the API's /seller-profile/* endpoints.
 * Only the seller-profile prefix is reachable; the path is built from validated segments.
 */
async function forward(request: Request, { params }: { params: { path?: string[] } }) {
  const segments = params.path ?? [];
  if (segments.some((s) => !/^[A-Za-z0-9_-]+$/.test(s))) {
    return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
  }
  const endpoint = `/seller-profile${segments.length ? `/${segments.join('/')}` : ''}`;
  const hasBody = request.method !== 'GET' && request.method !== 'DELETE';
  const body = hasBody ? await request.text() : undefined;

  const result = await serverApiFetch(endpoint, {
    method: request.method,
    ...(body ? { body } : {}),
  });

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: result.status || 500 });
  }
  return NextResponse.json(result.data);
}

export { forward as GET, forward as PUT, forward as POST, forward as PATCH, forward as DELETE };
