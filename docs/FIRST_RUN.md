# First-run checklist

Everything below has unit-test coverage, but **none of it has been run end to end against a real database, Gmail
account or OpenAI key yet.** Work through this list in order; each step says what you should see. If a step fails,
stop there and fix it before moving on.

> Safety first: keep `OUTREACH_SAFE_TEST_MODE=true` and set `OUTREACH_TEST_RECIPIENT_EMAIL` to your own address
> until step 9. While it is on, every outgoing email is redirected to that address.

## 1. Prerequisites

- Node 20+, npm, Docker (for Postgres and Redis).
- A Google Cloud OAuth client for Gmail (and one for Google login if you use it).
- An OpenAI API key.

## 2. Environment

```powershell
Copy-Item .env.example apps/api/.env
```

Fill in at least: `DATABASE_URL`, `REDIS_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `JWT_LINK_SECRET`,
`GMAIL_OAUTH_CLIENT_ID`, `GMAIL_OAUTH_CLIENT_SECRET`, `GMAIL_TOKEN_ENCRYPTION_KEY` (64 hex chars, e.g.
`openssl rand -hex 32`), `OPENAI_API_KEY`, `OUTREACH_TEST_RECIPIENT_EMAIL`.
The API refuses to start if a required secret is missing, which is the intended behaviour.

## 3. Start Postgres and Redis

```powershell
docker compose -f infrastructure/docker/docker-compose.yml up -d
```

Expect both containers `healthy` (`docker ps`).

## 4. Install, generate the client, apply migrations

```powershell
npm install
npx prisma generate --schema packages/database/prisma/schema.prisma
npx prisma migrate deploy --schema packages/database/prisma/schema.prisma
```

Expect 9 migrations applied, the last being `add_seller_profile_onboarding`.
This is the first time that migration touches a real database, so read any error closely.

## 5. Create an admin and start the apps

Start the apps:

```powershell
npm run dev:api
npm run dev:web
```

- API: `http://localhost:4000/health` returns `status: ok` with database and redis `up`.
- Web: `http://localhost:3000`.

Create the first user. Either call `POST /auth/register`, or run the seed script
`apps/api/src/seed-admin.ts` (needs `ts-node`, which is not a project dependency, so it is **untested**:
`npx ts-node apps/api/src/seed-admin.ts`). The seed creates `admin@enterprise.com` with a hard-coded default
password in the source file. If you use it, change that password straight away and never use it outside local dev.

## 6. Onboarding (first thing a user sees)

1. Sign in. `/overview` should redirect you to `/onboarding`.
2. Fill in the 7 steps: profile, resume text, at least one service, at least one target country, a restriction
   (try `Gambling`), and a handoff rule (try "Client asks about pricing").
3. Finish setup. You should land on the dashboard. Reloading `/onboarding` should show everything you saved.

## 7. Prospect import

1. Open **Import Prospects**, paste a small CSV (the placeholder shows the format) with: one in-country company, one
   out-of-country company, one in a restricted industry (`Gambling`), and a duplicate.
2. **Preview** first. Expect one `would create` and the rest skipped, each with a reason.
3. **Import**. Expect the company, a contact and a lead; the lead appears on the dashboard.

## 8. Gmail, scoring, drafts

1. Connect Gmail from the **Gmail** page and confirm status shows connected.
2. Open the new lead, run **Score**. Expect a score and a priority/readiness badge.
3. Generate an outreach draft; check it uses your name, company and services and has no `[Your Name]` placeholders.
4. Send it. With safe test mode on it arrives at `OUTREACH_TEST_RECIPIENT_EMAIL`, not the prospect.

## 9. Replies, handoff, auto-reply

Use a second mailbox you control as the "client".

1. Reply to the test email with an ordinary question. Sync the inbox (**Conversations → Sync**).
   With `AUTO_REPLY_MODE=draft` you should get a notification "Reply Draft Ready for Approval" and a `Re:` draft.
2. Reply again including the word **price**. Sync. Expect: the lead's AI turns **PAUSED**, a "Your Turn: AI Handed
   Off a Lead" notification, and the handoff card on the lead page.
3. Resume the AI on the lead, then send "not interested". Expect no reply draft and the lead marked LOST.

Only after all of that, and only if you want it: set `AUTO_REPLY_MODE=auto`, approve a single lead for autonomous
mode, and confirm one auto-reply goes out (still redirected while safe test mode is on).

## 10. Follow-ups (off by default)

Follow-ups only target leads we wrote to at least `FOLLOW_UP_AFTER_DAYS` (minimum 1) days ago. To test without
waiting, set `FOLLOW_UP_AUTOMATION_ENABLED=true`, back-date the `sentAt` of a sent outreach draft by 2 days in the
database, and restart the API. Expect a "Follow-Up Draft Ready for Approval" notification (with
`FOLLOW_UP_MODE=draft`) and a `Re:` draft on the lead.

## 11. Going live

- Turn `OUTREACH_SAFE_TEST_MODE` to `false` only when you are happy with every step above.
- Kill switches: `AUTO_REPLY_MODE=off` stops all AI replies and follow-ups; `FOLLOW_UP_AUTOMATION_ENABLED=false`
  stops the scheduled scan; `GMAIL_SYNC_AUTOMATION_ENABLED=false` stops inbox polling.
- Replace every `change_in_production` secret and the example encryption key.

## Known gaps

- Resume upload accepts text files only (no PDF/Word parsing).
- No built-in lead source; prospects come from CSV import.
- Campaigns and Opportunities screens are placeholders.
- Gmail connection, inbox sync and real sending have not been exercised end to end.

## Automated checks

GitHub Actions (`.github/workflows/ci.yml`) runs typecheck, the API unit tests and the web build, then applies
all migrations to a fresh Postgres and runs `scripts/e2e-smoke.mjs` (onboarding, import, ranking, handoff brief)
against the built API. Run the same smoke test locally against a running API with
`API_BASE=http://localhost:4000 npm run e2e:smoke`. It creates a throwaway user in whatever database the API uses,
so point it at a dev or test database.
