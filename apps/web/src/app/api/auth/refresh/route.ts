import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export async function POST() {
  const cookieStore = cookies();
  const refreshToken = cookieStore.get('auth_refresh_token')?.value;

  if (!refreshToken) {
    cookieStore.delete('auth_access_token');
    cookieStore.delete('auth_refresh_token');
    return NextResponse.json({ error: 'No refresh token available' }, { status: 401 });
  }

  try {
    const backendRes = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
      cache: 'no-store',
    });

    const data = await backendRes.json();

    if (!backendRes.ok) {
      cookieStore.delete('auth_access_token');
      cookieStore.delete('auth_refresh_token');
      return NextResponse.json(
        { error: data.message || 'Failed to refresh authentication token' },
        { status: 401 },
      );
    }

    cookieStore.set('auth_access_token', data.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 15,
    });

    cookieStore.set('auth_refresh_token', data.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    cookieStore.delete('auth_access_token');
    cookieStore.delete('auth_refresh_token');
    return NextResponse.json(
      { error: err.message || 'Token refresh network error' },
      { status: 500 },
    );
  }
}
