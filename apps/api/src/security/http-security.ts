import { INestApplication } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { json, urlencoded } from 'express';

/** Largest JSON body accepted on the CSV prospect import. Everything else is capped far lower. */
export const IMPORT_BODY_LIMIT = '3mb';
export const DEFAULT_BODY_LIMIT = '100kb';

/** Parses TRUST_PROXY: 'true'/'false', a hop count, or a comma list of IPs/subnets/keywords like 'loopback'. */
export function parseTrustProxy(raw: string | undefined): boolean | number | string | string[] {
  const v = (raw ?? 'loopback').trim();
  if (v === 'true') return true;
  if (v === 'false' || v === '') return false;
  if (/^\d+$/.test(v)) return parseInt(v, 10);
  return v.includes(',') ? v.split(',').map((x) => x.trim()).filter(Boolean) : v;
}

/** CORS_ORIGINS is a comma-separated allowlist. Empty means no cross-origin access at all (the default). */
export function parseCorsOrigins(raw: string | undefined): string[] {
  return (raw ?? '')
    .split(',')
    .map((o) => o.trim().replace(/\/$/, ''))
    .filter((o) => o && o !== '*');
}

/**
 * HTTP-level protections for the API:
 * - security headers (helmet), no X-Powered-By
 * - explicit CORS allowlist (browsers are denied unless CORS_ORIGINS lists them; the web app reaches the API server-side)
 * - small default body limit, a larger one only on the CSV import route
 * - Express trust-proxy so rate limits see the real client IP only when it is forwarded by a trusted hop
 */
export function applyHttpSecurity(app: NestExpressApplication): void {
  app.disable('x-powered-by');
  app.set('trust proxy', parseTrustProxy(process.env.TRUST_PROXY));

  app.use(
    helmet({
      // The API only serves JSON, so lock everything down; no HTML is ever rendered from here.
      contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
      crossOriginResourcePolicy: { policy: 'same-site' },
      referrerPolicy: { policy: 'no-referrer' },
      hsts: process.env.NODE_ENV === 'production' ? { maxAge: 15552000, includeSubDomains: true } : false,
    }),
  );

  const origins = parseCorsOrigins(process.env.CORS_ORIGINS);
  app.enableCors({
    origin: origins.length > 0 ? origins : false,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: false,
    maxAge: 600,
  });

  // The route-specific parser must be registered first so the bigger limit wins on that path only.
  app.use('/discovery/import', json({ limit: IMPORT_BODY_LIMIT }));
  app.use(json({ limit: DEFAULT_BODY_LIMIT }));
  app.use(urlencoded({ extended: false, limit: DEFAULT_BODY_LIMIT }));
}
