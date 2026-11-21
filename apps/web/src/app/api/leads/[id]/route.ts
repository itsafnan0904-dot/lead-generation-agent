import { NextResponse } from 'next/server';
import { serverApiFetch } from '@/lib/server-api-client';

/** Only lifecycle status changes are exposed here (used to mark a deal won or lost). */
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const payload = await request.json().catch(() => null);
  const status = payload?.status;
  if (status !== 'WON' && status !== 'LOST') {
    return NextResponse.json({ error: 'Only WON or LOST can be set here' }, { status: 400 });
  }
  const result = await serverApiFetch(`/leads/${encodeURIComponent(params.id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
  if (result.error) return NextResponse.json({ error: result.error }, { status: result.status || 500 });
  return NextResponse.json(result.data);
}
