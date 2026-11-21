# Security

What is protected, how it is configured, and what is still your job. No software is "unhackable": this lists the
protections that exist, how each was verified, and the known gaps.

## Secrets

- Real secrets live only in `apps/api/.env` (gitignored). `.env.example` has no secret values.
- Generate every secret: `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`
  (the Gmail token key: `...randomBytes(32).toString('hex')`).
- With `NODE_ENV=production` the API **refuses to start** if a JWT secret is under 32 characters, looks like a
  placeholder, is reused for another purpose, or if the Gmail encryption key is the public example key.
  In development it prints a warning instead.
- Only `NEXT_PUBLIC_API_URL` is exposed to the browser. Gmail tokens are stored encrypted (AES-256-GCM); back up
  `GMAIL_TOKEN_ENCRYPTION_KEY`, because losing it makes stored tokens unreadable.
- A scan of the repository and its full git history found **no committed API keys, tokens or private keys**
  (the only match is a mock value in a unit test). Rotate anything you may have pasted elsewhere.

## Accounts and access

| Area | Rule |
| --- | --- |
| Sign-up | Closed by default (`ALLOW_PUBLIC_REGISTRATION=false`). First admin: `npm run create-admin`. |
| Google sign-in | Can only create accounts for domains in `GOOGLE_ALLOWED_DOMAINS`; existing users can still link. |
| Passwords | bcrypt (cost 12), 10 to 72 characters with mixed case and a digit or symbol. |
| Login protection | 10 failures lock an account for 15 minutes, 30 failures block an IP; unknown emails take the same time as real ones. |
| Rate limits | 300 requests/min/IP overall (`RATE_LIMIT_PER_MINUTE`); 20 logins/min, 5 sign-ups/hour, 60 refreshes/min per IP. |
| ADMIN | User management, audit log, Gmail connect/disconnect, human-review resolution, autonomous-engagement approvals, AI diagnostics. |
| MANAGER / SALES_REP | Work with leads, companies, conversations, outreach, campaigns, deals. Cannot do any ADMIN action. |
| VIEWER | Read-only everywhere (every request that changes data is refused). |
| Sessions | 15-minute access tokens in httpOnly cookies, refresh tokens stored hashed and revoked on logout, deactivation, role change or password reset. A deactivated user's token stops working immediately. |

Admins manage accounts through `POST /users`, `GET /users`, `PATCH /users/:id` and `POST /users/:id/reset-password`.
An admin cannot deactivate or demote themselves, and the last active admin cannot be removed. All changes are audited.

## Network and HTTP

- **API**: helmet headers, no `X-Powered-By`, CORS denies every browser origin unless listed in `CORS_ORIGINS`
  (the web app reaches the API server-side, so this normally stays empty), 100 kb body limit (3 MB only on the CSV
  import), generic error responses, production log levels, validation that never echoes input values.
- **Web**: Content-Security-Policy, HSTS (production), X-Frame-Options DENY, nosniff, referrer and permissions
  policies, cross-origin isolation headers; image optimizer disabled; CSRF check (same-origin only) on every
  `/api/*` proxy route; the real client IP is forwarded so rate limits apply per person, not per web server.
- **Behind a reverse proxy**: set `TRUST_PROXY` (a hop count such as `1`, or the proxy's address). The default
  `loopback` only trusts forwarding from the same machine. Terminate TLS at the proxy and keep the API private.
- **Database and Redis**: docker-compose publishes them on `127.0.0.1` only, and Postgres has no default password
  (`POSTGRES_PASSWORD` is required). If you already have a Postgres volume created with the old default password,
  change it: `ALTER USER postgres PASSWORD '...'` and update `DATABASE_URL`.

## Verification

- 325 unit tests (new: lockout, closed sign-up, Google signup rules, viewer read-only, user management, secret checks).
- `scripts/e2e-smoke.mjs` runs 70 checks against the real built API in production mode with random strong secrets:
  every sensitive route returns 401 without a token, role rules (rep/viewer/admin), closed registration, headers,
  CORS denial, 413 on oversized bodies, generic login errors, lockout, deactivation. CI runs it on every pull request.
- The production web build was loaded in a browser with the CSP active: no violations.

## Known gaps (not fixed, and why)

1. **Dependencies**: `npm audit --omit=dev` still reports 6 findings (down from 16, 2 critical). They need major
   upgrades: Next.js 14 to 16 (one critical image-optimizer DoS, mitigated by disabling the optimizer; PostCSS via Next),
   NestJS 10 to 11 (`@nestjs/core`, `platform-express`), plus `glob`/`minimatch` in build tooling. Plan these as
   separate upgrades with testing.
2. **Row-level isolation**: ADMIN/MANAGER/SALES_REP all see the same leads, companies and conversations (it is a shared
   team CRM). If reps must only see their own leads, that needs per-record checks on every endpoint.
3. **CSP uses `'unsafe-inline'`** for scripts and styles because Next.js hydration and MUI inject inline code. A
   nonce-based policy would remove it.
4. **Login lockout and rate limits are in memory**, so they reset on restart and do not span several API instances;
   move them to Redis if you scale out.
5. **No MFA**, password-reset-by-email or email verification yet.
6. **Admin UI**: user management is API-only for now.
7. The `OUTREACH_SAFE_TEST_MODE` default (redirect all email to a test address) is a safety net, not a security
   control; turn it off deliberately.
8. Dev scripts under `apps/api/src/live-*.ts`, `verify-*.ts` and `scratch/` are compiled/committed and call real services.
   They no longer contain passwords, but consider moving them out of the production image.

## Before going live checklist

- [ ] New random secrets in the production environment (never reuse local ones); `NODE_ENV=production`
- [ ] Change the Postgres password if the volume predates the new compose file
- [ ] Create your admin with `create-admin`; delete any old `admin@enterprise.com` test account
      (the old seed script created it with a known password: if it ever ran against a real database, remove it)
- [ ] `ALLOW_PUBLIC_REGISTRATION=false`, `GOOGLE_ALLOWED_DOMAINS` set or empty, `CORS_ORIGINS` empty
- [ ] HTTPS in front of both apps, `TRUST_PROXY` set to match, API not publicly reachable except through the web app
- [ ] Turn `OUTREACH_SAFE_TEST_MODE` off only after a supervised Gmail test
- [ ] Regular backups of the database and of `GMAIL_TOKEN_ENCRYPTION_KEY`
- [ ] The GitHub repository is **public**: the old default test password (`Password123!`) and a few personal email
      addresses (in unit tests and `scratch/`) remain in git history. Change any account that ever used that password,
      and either make the repository private or accept that history is world-readable. Rewriting history is possible
      but disruptive and does not undo copies already made.
