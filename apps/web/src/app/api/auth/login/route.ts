import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { clientIpHeader } from '@/lib/server-api-client';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password } = body ?? {};

    if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }
    if (email.length > 254 || password.length > 200) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 400 });
    }

    const backendRes = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...clientIpHeader() },
      body: JSON.stringify({ email, password }),
      cache: 'no-store',
    });

    const data = await backendRes.json();

    if (!backendRes.ok) {
      return NextResponse.json(
        { error: data.message || data.error || 'Invalid credentials' },
        { status: backendRes.status },
      );
    }

    // Set httpOnly cookies securely
    const cookieStore = cookies();
    cookieStore.set('auth_access_token', data.tokens.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 15, // 15 minutes
    });

    cookieStore.set('auth_refresh_token', data.tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    // Return only the non-sensitive user object to the client
    return NextResponse.json({ user: data.user });
  } catch {
    // Never echo internal error text (it can contain hostnames or stack details) to the browser
    return NextResponse.json({ error: 'Unable to sign in right now. Please try again.' }, { status: 500 });
  }
}
