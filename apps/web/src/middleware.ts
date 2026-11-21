import { NextRequest, NextResponse } from 'next/server';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * CSRF defence for the cookie-authenticated API proxy routes. Any request that changes state must come from this
 * site itself: its Origin (or, failing that, Sec-Fetch-Site) has to say so. SameSite=Lax cookies already block most
 * cross-site posts; this closes the remaining gaps (same-site subdomains, older browsers, odd request shapes).
 */
export function middleware(request: NextRequest) {
  if (SAFE_METHODS.has(request.method)) return NextResponse.next();

  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  const origin = request.headers.get('origin');
  const fetchSite = request.headers.get('sec-fetch-site');

  let sameOrigin = false;
  if (origin) {
    try {
      sameOrigin = !!host && new URL(origin).host === host;
    } catch {
      sameOrigin = false;
    }
  } else if (fetchSite) {
    sameOrigin = fetchSite === 'same-origin' || fetchSite === 'none';
  }

  if (!sameOrigin) {
    return NextResponse.json({ error: 'Cross-site request blocked' }, { status: 403 });
  }
  return NextResponse.next();
}

export const config = { matcher: '/api/:path*' };
