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
  const accessToken = loginData.tokens.accessToken;
  const refreshToken = loginData.tokens.refreshToken;

  const cookieHeader = `auth_access_token=${accessToken}; auth_refresh_token=${refreshToken}`;

  const res = await fetch(`${WEB_BASE_URL}/settings`, {
    headers: { Cookie: cookieHeader },
  });
  console.log('Status:', res.status);
  const text = await res.text();
  console.log('Body:', text.slice(0, 1000));
}

main();
