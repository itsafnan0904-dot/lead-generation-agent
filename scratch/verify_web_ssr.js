const API_BASE_URL = 'http://localhost:4000';
const WEB_BASE_URL = 'http://localhost:3000';

async function main() {
  console.log('=== VERIFYING WEB SSR ROUTES ===\n');

  // 1. Authenticate with seeded user to get tokens
  const loginRes = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@enterprise.com',
      password: 'Password123!',
    }),
  });

  const loginData = await loginRes.json();
  const accessToken = loginData.tokens.accessToken;
  const refreshToken = loginData.tokens.refreshToken;

  const cookieHeader = `auth_access_token=${accessToken}; auth_refresh_token=${refreshToken}`;

  // 2. Fetch /settings
  console.log('Fetching /settings from Web Next.js server...');
  const settingsRes = await fetch(`${WEB_BASE_URL}/settings`, {
    headers: { Cookie: cookieHeader },
  });
  console.log('/settings HTTP status:', settingsRes.status);
  const settingsHtml = await settingsRes.text();
  console.log('Contains "Account & System Configuration":', settingsHtml.includes('Account &amp; System Configuration') || settingsHtml.includes('Account & System Configuration'));
  console.log('Contains "admin@enterprise.com":', settingsHtml.includes('admin@enterprise.com'));
  console.log('Contains "Lead Admin":', settingsHtml.includes('Lead Admin'));
  console.log('Contains "ADMIN":', settingsHtml.includes('ADMIN'));

  // 3. Fetch /leads with Presets
  console.log('\nFetching /leads?preset=opportunities...');
  const oppRes = await fetch(`${WEB_BASE_URL}/leads?preset=opportunities`, {
    headers: { Cookie: cookieHeader },
  });
  console.log('/leads?preset=opportunities HTTP status:', oppRes.status);
  const oppHtml = await oppRes.text();
  console.log('Contains "BioPharma Dynamics":', oppHtml.includes('BioPharma Dynamics'));
  console.log('Contains "Strata Distributed Storage":', oppHtml.includes('Strata Distributed Storage'));
  console.log('Contains "OmniGlobal":', oppHtml.includes('OmniGlobal'));

  console.log('\nFetching /leads?preset=human_review...');
  const hrRes = await fetch(`${WEB_BASE_URL}/leads?preset=human_review`, {
    headers: { Cookie: cookieHeader },
  });
  console.log('/leads?preset=human_review HTTP status:', hrRes.status);
  const hrHtml = await hrRes.text();
  console.log('Contains "Summit Enterprise Holdings":', hrHtml.includes('Summit Enterprise Holdings'));
  console.log('Contains "Apex Industrial Robotics":', hrHtml.includes('Apex Industrial Robotics'));

  console.log('\n=== WEB SSR VERIFICATION COMPLETE ===');
}

main().catch(err => {
  console.error('Web SSR verification failed:', err);
  process.exit(1);
});
