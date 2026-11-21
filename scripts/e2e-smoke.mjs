#!/usr/bin/env node
/**
 * End-to-end smoke test against a running API (no OpenAI or Gmail needed).
 *
 *   API_BASE=http://localhost:4000 node scripts/e2e-smoke.mjs
 *
 * Registers a unique throwaway user, completes seller onboarding, imports prospects (preview and real),
 * and checks ranking, priority data, the handoff brief, deals and the opportunities board, and campaigns.
 * Safe to re-run against a non-empty database (names are unique per run). Exits non-zero if any check fails.
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

const tag = Date.now(); // unique per run so the script can be re-run against a non-empty database
const email = `smoke+${tag}@example.com`;
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
  `Smoke Retail ${tag},https://www.smoke-retail-${tag}.example,United States,Retail,sam@smoke-retail-${tag}.example,Sam,Lee,Head of Digital`,
  `Euro Shop ${tag},euro-shop-${tag}.example,Germany,Retail,,,,`,
  `Lucky Bets ${tag},luckybets-${tag}.example,USA,Online Gambling,,,,`,
  `Smoke Retail Dup ${tag},smoke-retail-${tag}.example,US,Retail,,,,`,
  ',,US,,,,,',
].join('\n');

r = await call('GET', '/leads');
const leadsBefore = r.json?.total ?? 0;
r = await call('POST', '/discovery/import', { csv, dryRun: true });
check('import preview creates nothing', r.status === 201 && r.json?.dryRun === true && r.json?.counts?.WOULD_CREATE === 1 && r.json?.counts?.CREATED === 0, JSON.stringify(r.json?.counts));
r = await call('GET', '/leads');
check('no leads are created by a preview', r.status === 200 && r.json?.total === leadsBefore, `total ${r.json?.total} vs ${leadsBefore}`);

r = await call('POST', '/discovery/import', { csv });
const c = r.json?.counts ?? {};
check('import creates 1, skips out-of-market, restricted, duplicate and invalid rows',
  c.CREATED === 1 && c.SKIPPED_OUT_OF_MARKET + c.SKIPPED_RESTRICTED === 2 && c.SKIPPED_DUPLICATE === 1 && c.INVALID === 1, JSON.stringify(c));
const leadId = r.json?.results?.find((x) => x.status === 'CREATED')?.leadId;
check('import created a lead', !!leadId);

r = await call('GET', '/leads?sort=priority&limit=100');
const lead = r.json?.items?.find((x) => x.id === leadId);
check('lead list carries a priority block', r.status === 200 && typeof lead?.priority?.priorityScore === 'number' && typeof lead?.priority?.readinessScore === 'number', `status ${r.status}`);
r = await call('GET', '/leads?needsHuman=true&limit=100');
check('needsHuman filter excludes a lead nobody needs to act on', r.status === 200 && !r.json?.items?.some((x) => x.id === leadId), `total ${r.json?.total}`);

r = await call('GET', `/leads/${leadId}/handoff`);
check('handoff brief is available', r.status === 200 && /Smoke Retail/.test(r.json?.headline ?? ''), r.json?.headline);

r = await call('GET', `/leads/${leadId}`);
check('lead detail includes priority', r.status === 200 && r.json?.priority?.nextAction, `status ${r.status}`);

// ---------------------------------------------------------------- opportunities
r = await call('POST', '/seller-profile/intervention-rules', { trigger: 'DEAL_VALUE_ABOVE', threshold: 10000 });
check('add deal-value handoff rule', r.status === 201, `status ${r.status}`);

r = await call('POST', `/leads/${leadId}/projects`, { title: 'Platform rebuild', budget: 25000, currency: 'usd', timeline: '3 months' });
const projectId = r.json?.id;
check('create deal (currency upper-cased)', r.status === 201 && r.json?.currency === 'USD', `status ${r.status}`);
r = await call('POST', `/leads/${leadId}/projects`, { title: '', budget: -5 });
check('invalid deal rejected', r.status === 400, `status ${r.status}`);
r = await call('GET', '/leads?needsHuman=true&limit=100');
const flagged = r.json?.items?.find((x) => x.id === leadId);
check('deal value above the threshold flags the lead as needing a human', /Deal value/.test(flagged?.priority?.humanReasons?.[0] ?? ''), JSON.stringify(r.json?.items?.map((i) => i.priority?.humanReasons)));

await call('PATCH', `/leads/${leadId}`, { status: 'QUALIFIED' });
r = await call('GET', '/opportunities');
const qualified = r.json?.stages?.find((x) => x.status === 'QUALIFIED');
const card = qualified?.items?.find((x) => x.leadId === leadId);
check('opportunities board groups the deal by stage with per-currency value', r.status === 200 && card?.valueByCurrency?.USD === 25000 && qualified?.valueByCurrency?.USD >= 25000, JSON.stringify(card?.valueByCurrency));

r = await call('PATCH', `/projects/${projectId}`, { budget: 8000 });
check('update deal budget', r.status === 200 && Number(r.json?.budget) === 8000, `status ${r.status}`);
r = await call('GET', '/leads?needsHuman=true&limit=100');
check('lowering the budget below the threshold clears the flag', !r.json?.items?.some((x) => x.id === leadId), `total ${r.json?.total}`);

await call('PATCH', `/leads/${leadId}`, { status: 'WON' });
r = await call('GET', '/opportunities');
const won = r.json?.stages?.find((x) => x.status === 'WON');
check('a won deal appears in the won stage with its value', won?.items?.find((x) => x.leadId === leadId)?.valueByCurrency?.USD === 8000 && r.json?.totals?.wonValueByCurrency?.USD >= 8000, JSON.stringify(won?.valueByCurrency));

// ------------------------------------------------------------------ campaigns
r = await call('POST', '/campaigns', { name: 'Smoke campaign', startDate: '2026-12-01', endDate: '2026-10-01' });
check('campaign with end before start rejected', r.status === 400, `status ${r.status}`);
r = await call('POST', '/campaigns', { name: '  Smoke campaign  ' });
const campaignId = r.json?.id;
check('create campaign (draft, name trimmed)', r.status === 201 && r.json?.status === 'DRAFT' && r.json?.name === 'Smoke campaign', `status ${r.status}`);

r = await call('POST', '/discovery/import', { csv: `Company,Country,Email,First Name\nCamp Alpha ${tag},US,a@camp-alpha-${tag}.example,Al\nCamp Beta ${tag},US,b@camp-beta-${tag}.example,Bo`, campaignId });
const campaignLeads = r.json?.results?.map((x) => x.leadId) ?? [];
check('import straight into the campaign', r.json?.counts?.CREATED === 2, JSON.stringify(r.json?.counts));
r = await call('POST', '/discovery/import', { csv: `Company\nNowhere ${tag}`, campaignId: '00000000-0000-4000-8000-000000000000' });
check('import into an unknown campaign rejected', r.status === 400, `status ${r.status}`);

r = await call('GET', `/leads?campaignId=${campaignId}`);
check('leads can be filtered by campaign', r.json?.total === 2, `total ${r.json?.total}`);
r = await call('POST', '/campaigns', { name: 'Other campaign' });
r = await call('POST', `/campaigns/${r.json?.id}/leads`, { leadIds: [campaignLeads[0]] });
check('a lead already in another campaign is skipped, not moved', r.json?.assigned === 0 && r.json?.skipped?.[0]?.reason === 'ALREADY_IN_ANOTHER_CAMPAIGN', JSON.stringify(r.json));

r = await call('PATCH', `/campaigns/${campaignId}`, { status: 'PAUSED' });
check('draft campaign cannot jump to paused', r.status === 400, `status ${r.status}`);
r = await call('PATCH', `/campaigns/${campaignId}`, { status: 'ACTIVE' });
check('launch campaign', r.status === 200 && r.json?.status === 'ACTIVE', `status ${r.status}`);

await call('PATCH', `/leads/${campaignLeads[0]}`, { status: 'CONTACTED' });
await call('PATCH', `/leads/${campaignLeads[1]}`, { status: 'RESPONDED' });
r = await call('GET', `/campaigns/${campaignId}`);
check('campaign stats: contacted, replied and reply rate', r.json?.stats?.totalLeads === 2 && r.json?.stats?.contacted === 2 && r.json?.stats?.replied === 1 && r.json?.stats?.replyRate === 50, JSON.stringify(r.json?.stats));

await call('PATCH', `/campaigns/${campaignId}`, { status: 'PAUSED' });
await call('PATCH', `/campaigns/${campaignId}`, { status: 'COMPLETED' });
r = await call('POST', `/campaigns/${campaignId}/leads`, { leadIds: [leadId] });
check('completed campaign refuses new leads', r.status === 400, `status ${r.status}`);
r = await call('GET', '/campaigns');
check('campaign list is available', r.status === 200 && Array.isArray(r.json) && r.json.length >= 2, `status ${r.status}`);
check('campaigns require auth', (await fetch(`${BASE}/campaigns`)).status === 401);

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) {
  console.log(`Failed: ${failures.join('; ')}`);
  process.exit(1);
}
