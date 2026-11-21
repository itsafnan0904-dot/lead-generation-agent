import { NextResponse } from 'next/server';
import { serverApiFetch } from '@/lib/server-api-client';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const body = await request.text();
  const result = await serverApiFetch(`/leads/${encodeURIComponent(params.id)}/projects`, { method: 'POST', body });
  if (result.error) return NextResponse.json({ error: result.error }, { status: result.status || 500 });
  return NextResponse.json(result.data);
}
