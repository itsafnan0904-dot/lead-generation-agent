import { NextResponse } from 'next/server';
import { serverApiFetch } from '@/lib/server-api-client';

/** Authenticated pass-through to /campaigns/*. Path segments are restricted to simple ids and words. */
async function forward(request: Request, { params }: { params: { path?: string[] } }) {
  const segments = params.path ?? [];
  if (segments.some((s) => !/^[A-Za-z0-9_-]+$/.test(s))) {
    return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
  }
  const endpoint = `/campaigns${segments.length ? `/${segments.join('/')}` : ''}`;
  const hasBody = request.method !== 'GET' && request.method !== 'DELETE';
  const body = hasBody ? await request.text() : undefined;

  const result = await serverApiFetch(endpoint, { method: request.method, ...(body ? { body } : {}) });
  if (result.error) return NextResponse.json({ error: result.error }, { status: result.status || 500 });
  return NextResponse.json(result.data);
}

export { forward as GET, forward as POST, forward as PATCH, forward as DELETE };
