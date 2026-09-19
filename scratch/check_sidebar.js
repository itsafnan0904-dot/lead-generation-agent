const API_BASE_URL = 'http://localhost:4000';
const WEB_BASE_URL = 'http://localhost:3000';

async function main() {
  const loginRes = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@enterprise.com',
      password: 'Password123!',
    }),
  });

  const loginData = await loginRes.json();
  const cookieHeader = `auth_access_token=${loginData.tokens.accessToken}; auth_refresh_token=${loginData.tokens.refreshToken}`;

  const res = await fetch(`${WEB_BASE_URL}/leads`, {
    headers: { Cookie: cookieHeader },
  });

  const html = await res.text();
  console.log('Sidebar has Opportunities link:', html.includes('href="/opportunities"'));
  console.log('Sidebar has Campaigns link:', html.includes('href="/campaigns"'));
  console.log('Sidebar has Leads link:', html.includes('href="/leads"'));
  console.log('Sidebar has Settings link:', html.includes('href="/settings"'));
}

main();
