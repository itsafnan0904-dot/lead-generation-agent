import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export async function POST() {
  const cookieStore = cookies();
  const accessToken = cookieStore.get('auth_access_token')?.value;

  if (accessToken) {
    try {
      await fetch(`${API_BASE_URL}/auth/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        cache: 'no-store',
      });
    } catch {
      // Non-blocking logout attempt
    }
  }

  cookieStore.delete('auth_access_token');
  cookieStore.delete('auth_refresh_token');

  return NextResponse.json({ success: true });
}
