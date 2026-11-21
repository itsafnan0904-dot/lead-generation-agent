import { NextResponse } from 'next/server';
import { serverApiFetch } from '@/lib/server-api-client';

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const body = await request.text();
  const result = await serverApiFetch(`/projects/${encodeURIComponent(params.id)}`, { method: 'PATCH', body });
  if (result.error) return NextResponse.json({ error: result.error }, { status: result.status || 500 });
  return NextResponse.json(result.data);
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const result = await serverApiFetch(`/projects/${encodeURIComponent(params.id)}`, { method: 'DELETE' });
  if (result.error) return NextResponse.json({ error: result.error }, { status: result.status || 500 });
  return NextResponse.json(result.data);
}
