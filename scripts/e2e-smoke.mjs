#!/usr/bin/env node
/**
 * End-to-end smoke test against a running API (no OpenAI or Gmail needed).
 *
 *   API_BASE=http://localhost:4000 node scripts/e2e-smoke.mjs
 *
 * Registers a unique throwaway user, completes seller onboarding, imports prospects (preview and real),
 * and checks ranking, priority data and the handoff brief. Exits non-zero if any check fails.
 */
const BASE = (process.env.API_BASE || 'http://localhost:4000').replace(/\/$/, '');
let token = '';
let passed = 0;
const failures = [];

async function call(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, json: await res.json().catch(() => null) };
}

function check(name, cond, detail = '') {
  if (cond) {
    passed++;
    console.log(`PASS  ${name}`);
  } else {
    failures.push(name);
    console.log(`FAIL  ${name}${detail ? `  -> ${detail}` : ''}`);
  }
}

async function waitForHealth() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`${BASE}/health`);
      if (r.ok) return true;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 2000));
  }
  return false;
}

if (!(await waitForHealth())) {
  console.error(`API at ${BASE} did not become healthy`);
  process.exit(2);
}

const email = `smoke+${Date.now()}@example.com`;
const password = 'SmokeTest#2026';
let r;

r = await call('POST', '/auth/register', { email, name: 'Smoke Test', password });
check('register', r.status === 201, `status ${r.status}`);
r = await call('POST', '/auth/login', { email, password });
token = r.json?.tokens?.accessToken;
check('login returns an access token', !!token, `status ${r.status}`);

r = await call('GET', '/seller-profile');
check('no seller profile before onboarding (404)', r.status === 404, `status ${r.status}`);
r = await call('GET', '/leads');
check('API requires auth for leads (401 without token)', (await fetch(`${BASE}/leads`)).status === 401);

r = await call('PUT', '/seller-profile', { displayName: 'Smoke Seller', companyName: 'Smoke Co', title: 'Founder', skills: ['React'], tone: 'warm' });
check('save seller profile', r.status === 200 && r.json?.displayName === 'Smoke Seller', `status ${r.status}`);

r = await call('PUT', '/seller-profile/resume', { resumeText: 'Skills: TypeScript, PostgreSQL\n9 years of professional experience', applyToProfile: true });
check('resume parsed and merged into profile', r.status === 200 && r.json?.profile?.skills?.includes('PostgreSQL') && r.json?.parsed?.yearsExperience === 9, `status ${r.status}`);

r = await call('POST', '/seller-profile/services', { name: 'Website development', priceMin: 2000, priceMax: 8000, currency: 'usd' });
check('add service (currency normalised)', r.status === 201 && r.json?.currency === 'USD', `status ${r.status}`);
r = await call('POST', '/seller-profile/services', { name: 'Bad range', priceMin: 10, priceMax: 5 });
check('service with min price above max is rejected', r.status === 400, `status ${r.status}`);

r = await call('POST', '/seller-profile/complete-onboarding');
check('onboarding blocked without a target country', r.status === 400, `status ${r.status}`);

r = await call('POST', '/seller-profile/target-markets', { countryCode: 'us', industries: ['Retail'] });
check('add target country (code upper-cased)', r.status === 201 && r.json?.countryCode === 'US', `status ${r.status}`);
r = await call('POST', '/seller-profile/target-markets', { countryCode: 'US' });
check('duplicate target country rejected', r.status === 409, `status ${r.status}`);
r = await call('POST', '/seller-profile/restriction-rules', { type: 'INDUSTRY', value: 'Gambling' });
check('add restriction rule', r.status === 201, `status ${r.status}`);
r = await call('POST', '/seller-profile/intervention-rules', { trigger: 'PRICING_DISCUSSION' });
check('add handoff rule', r.status === 201, `status ${r.status}`);
r = await call('POST', '/seller-profile/intervention-rules', { trigger: 'READINESS_ABOVE' });
check('threshold handoff rule without a threshold is rejected', r.status === 400, `status ${r.status}`);

r = await call('POST', '/seller-profile/complete-onboarding');
check('complete onboarding', r.status === 201 && r.json?.onboardingComplete === true, `status ${r.status}`);

const csv = [
  'Company,Website,Country,Industry,Email,First Name,Last Name,Job Title',
  'Smoke Retail,https://www.smoke-retail.example,United States,Retail,sam@smoke-retail.example,Sam,Lee,Head of Digital',
  'Euro Shop,euro-shop.example,Germany,Retail,,,,',
  'Lucky Bets,luckybets.example,USA,Online Gambling,,,,',
  'Smoke Retail Dup,smoke-retail.example,US,Retail,,,,',
  ',,US,,,,,',
].join('\n');

r = await call('POST', '/discovery/import', { csv, dryRun: true });
check('import preview creates nothing', r.status === 201 && r.json?.dryRun === true && r.json?.counts?.WOULD_CREATE === 1 && r.json?.counts?.CREATED === 0, JSON.stringify(r.json?.counts));
r = await call('GET', '/leads');
check('no leads exist after a preview', r.status === 200 && r.json?.total === 0, `total ${r.json?.total}`);

r = await call('POST', '/discovery/import', { csv });
const c = r.json?.counts ?? {};
check('import creates 1, skips out-of-market, restricted, duplicate and invalid rows',
  c.CREATED === 1 && c.SKIPPED_OUT_OF_MARKET + c.SKIPPED_RESTRICTED === 2 && c.SKIPPED_DUPLICATE === 1 && c.INVALID === 1, JSON.stringify(c));
const leadId = r.json?.results?.find((x) => x.status === 'CREATED')?.leadId;
check('import created a lead', !!leadId);

r = await call('GET', '/leads?sort=priority&limit=10');
const lead = r.json?.items?.[0];
check('lead list carries a priority block', r.status === 200 && r.json?.total === 1 && typeof lead?.priority?.priorityScore === 'number' && typeof lead?.priority?.readinessScore === 'number', `status ${r.status}`);
r = await call('GET', '/leads?needsHuman=true');
check('needsHuman filter excludes a lead nobody needs to act on', r.status === 200 && r.json?.total === 0, `total ${r.json?.total}`);

r = await call('GET', `/leads/${leadId}/handoff`);
check('handoff brief is available', r.status === 200 && /Smoke Retail/.test(r.json?.headline ?? ''), r.json?.headline);

r = await call('GET', `/leads/${leadId}`);
check('lead detail includes priority', r.status === 200 && r.json?.priority?.nextAction, `status ${r.status}`);

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) {
  console.log(`Failed: ${failures.join('; ')}`);
  process.exit(1);
}
