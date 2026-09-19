import { cookies } from 'next/headers';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface FetchOptions extends RequestInit {
  skipAuth?: boolean;
}

/**
 * Server-side-only fetch wrapper.
 * Reads httpOnly cookies, attaches Authorization: Bearer <accessToken>,
 * and performs transparent single-attempt token refresh on 401.
 */
export async function serverApiFetch<T = any>(
  endpoint: string,
  options: FetchOptions = {},
): Promise<{ data: T | null; status: number; error: string | null }> {
  const cookieStore = cookies();
  let accessToken = cookieStore.get('auth_access_token')?.value;
  const refreshToken = cookieStore.get('auth_refresh_token')?.value;

  const url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };

  if (!options.skipAuth && accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  try {
    let response = await fetch(url, {
      ...options,
      headers,
      cache: 'no-store',
    });

    // If 401 and we have a refreshToken, attempt server-side rotation and retry once
    if (response.status === 401 && !options.skipAuth && refreshToken) {
      try {
        const refreshRes = await fetch(`${API_BASE_URL}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
          cache: 'no-store',
        });

        if (refreshRes.ok) {
          const refreshData = await refreshRes.json();
          // Update cookie store
          cookieStore.set('auth_access_token', refreshData.accessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: 60 * 15, // 15 mins
          });

          cookieStore.set('auth_refresh_token', refreshData.refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: 60 * 60 * 24 * 7, // 7 days
          });

          // Retry original request with fresh accessToken
          headers['Authorization'] = `Bearer ${refreshData.accessToken}`;
          response = await fetch(url, {
            ...options,
            headers,
            cache: 'no-store',
          });
        } else {
          // Clear cookies on refresh failure
          cookieStore.delete('auth_access_token');
          cookieStore.delete('auth_refresh_token');
        }
      } catch {
        cookieStore.delete('auth_access_token');
        cookieStore.delete('auth_refresh_token');
      }
    }

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      return {
        data: null,
        status: response.status,
        error: errBody.message || errBody.error || `Request failed with status ${response.status}`,
      };
    }

    const data = await response.json().catch(() => null);
    return { data, status: response.status, error: null };
  } catch (err: any) {
    return { data: null, status: 500, error: err.message || 'Internal network error' };
  }
}
