const API_BASE_URL = 'http://localhost:4000';

async function main() {
  console.log('=== LIVE GMAIL CONNECTION HEALTH VERIFICATION ===\n');

  // 1. Authenticate as Admin
  console.log('1. Authenticating as admin@enterprise.com...');
  const loginRes = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@enterprise.com',
      password: 'Password123!',
    }),
  });

  if (!loginRes.ok) {
    throw new Error(`Login failed: ${await loginRes.text()}`);
  }

  const loginData = await loginRes.json();
  const token = loginData.tokens.accessToken;
  console.log('Logged in as:', loginData.user.email);

  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  // 2. Query GET /gmail/status (Standard Cached Poll)
  console.log('\n2. Calling GET /gmail/status (Standard Health Check)...');
  const t0 = Date.now();
  const statusRes = await fetch(`${API_BASE_URL}/gmail/status`, { headers: authHeaders });
  const d0 = Date.now() - t0;
  const statusData = await statusRes.json();
  console.log(`HTTP Status: ${statusRes.status} (Response time: ${d0}ms)`);
  console.log('Payload:', JSON.stringify(statusData, null, 2));

  // 3. Query GET /gmail/status (Immediate subsequent call to demonstrate cache acceleration)
  console.log('\n3. Calling GET /gmail/status again immediately (Testing cache TTL)...');
  const t1 = Date.now();
  const cachedRes = await fetch(`${API_BASE_URL}/gmail/status`, { headers: authHeaders });
  const d1 = Date.now() - t1;
  const cachedData = await cachedRes.json();
  console.log(`HTTP Status: ${cachedRes.status} (Response time: ${d1}ms)`);
  console.log('Health status:', cachedData.healthStatus);
  console.log('Last verified at:', cachedData.lastVerifiedAt);

  // 4. Query GET /gmail/status?force=true (Force Fresh Active Google Verification)
  console.log('\n4. Calling GET /gmail/status?force=true (Testing on-demand Google re-verification)...');
  const t2 = Date.now();
  const forcedRes = await fetch(`${API_BASE_URL}/gmail/status?force=true`, { headers: authHeaders });
  const d2 = Date.now() - t2;
  const forcedData = await forcedRes.json();
  console.log(`HTTP Status: ${forcedRes.status} (Response time: ${d2}ms)`);
  console.log('Payload:', JSON.stringify(forcedData, null, 2));

  console.log('\n=== LIVE VERIFICATION COMPLETE ===');
}

main().catch(err => {
  console.error('Live Gmail Health check verification failed:', err);
  process.exit(1);
});
