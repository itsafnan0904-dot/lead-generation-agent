const API_BASE_URL = 'http://localhost:4000';

async function main() {
  console.log('=== STARTING LIVE VERIFICATION ===\n');

  // 1. Authenticate with seeded user to get access token
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
    throw new Error(`Login failed with status ${loginRes.status}: ${await loginRes.text()}`);
  }

  const loginData = await loginRes.json();
  const token = loginData.tokens.accessToken;
  console.log('Authentication successful!');
  console.log('Logged in user:', loginData.user);

  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  // 2. Verify GET /auth/me for Settings screen
  console.log('\n2. Verifying GET /auth/me for Settings Screen...');
  const meRes = await fetch(`${API_BASE_URL}/auth/me`, {
    headers: authHeaders,
  });
  const meData = await meRes.json();
  console.log('GET /auth/me response status:', meRes.status);
  console.log('GET /auth/me payload:', JSON.stringify(meData, null, 2));

  // 3. Verify Preset: "All Leads"
  console.log('\n3. Verifying Preset: "All Leads" (/leads)...');
  const allLeadsRes = await fetch(`${API_BASE_URL}/leads?page=1&limit=20`, {
    headers: authHeaders,
  });
  const allLeadsData = await allLeadsRes.json();
  console.log(`All Leads Total Count: ${allLeadsData.total}`);
  console.log('Returned items status distribution:');
  const allDist = {};
  allLeadsData.items.forEach(l => { allDist[l.status] = (allDist[l.status] || 0) + 1; });
  console.log(allDist);

  // 4. Verify Preset: "Opportunities" (QUALIFIED, DEAL_DISCUSSION, WON)
  console.log('\n4. Verifying Preset: "Opportunities" (QUALIFIED, DEAL_DISCUSSION, WON)...');
  const [qualRes, dealRes, wonRes] = await Promise.all([
    fetch(`${API_BASE_URL}/leads?status=QUALIFIED&limit=100`, { headers: authHeaders }),
    fetch(`${API_BASE_URL}/leads?status=DEAL_DISCUSSION&limit=100`, { headers: authHeaders }),
    fetch(`${API_BASE_URL}/leads?status=WON&limit=100`, { headers: authHeaders }),
  ]);

  const qualData = await qualRes.json();
  const dealData = await dealRes.json();
  const wonData = await wonRes.json();

  const oppItems = [
    ...(qualData.items || []),
    ...(dealData.items || []),
    ...(wonData.items || []),
  ];

  console.log(`QUALIFIED count: ${qualData.total} items`);
  console.log(`DEAL_DISCUSSION count: ${dealData.total} items`);
  console.log(`WON count: ${wonData.total} items`);
  console.log(`Total Opportunities Count: ${oppItems.length}`);
  console.log('Opportunity Leads Details:', oppItems.map(l => ({
    id: l.id,
    company: l.company?.name,
    status: l.status,
    score: l.scoreTotal,
  })));

  // 5. Verify Preset: "Human Review" (HUMAN_REVIEW, RESTRICTED)
  console.log('\n5. Verifying Preset: "Human Review" (HUMAN_REVIEW, RESTRICTED)...');
  const [hrRes, restRes] = await Promise.all([
    fetch(`${API_BASE_URL}/leads?status=HUMAN_REVIEW&limit=100`, { headers: authHeaders }),
    fetch(`${API_BASE_URL}/leads?status=RESTRICTED&limit=100`, { headers: authHeaders }),
  ]);

  const hrData = await hrRes.json();
  const restData = await restRes.json();
  const hrItems = [
    ...(hrData.items || []),
    ...(restData.items || []),
  ];

  console.log(`HUMAN_REVIEW count: ${hrData.total} items`);
  console.log(`RESTRICTED count: ${restData.total} items`);
  console.log(`Total Human Review / Restricted Count: ${hrItems.length}`);
  console.log('Human Review Leads Details:', hrItems.map(l => ({
    id: l.id,
    company: l.company?.name,
    status: l.status,
    score: l.scoreTotal,
  })));

  // 6. Verify Preset: "Won"
  console.log('\n6. Verifying Preset: "Won" (WON)...');
  const wonPresetRes = await fetch(`${API_BASE_URL}/leads?status=WON&limit=20`, { headers: authHeaders });
  const wonPresetData = await wonPresetRes.json();
  console.log(`Won Preset Count: ${wonPresetData.total}`);
  console.log('Won Leads Details:', wonPresetData.items.map(l => ({
    id: l.id,
    company: l.company?.name,
    status: l.status,
    score: l.scoreTotal,
  })));

  // 7. Verify Preset: "Lost"
  console.log('\n7. Verifying Preset: "Lost" (LOST)...');
  const lostPresetRes = await fetch(`${API_BASE_URL}/leads?status=LOST&limit=20`, { headers: authHeaders });
  const lostPresetData = await lostPresetRes.json();
  console.log(`Lost Preset Count: ${lostPresetData.total}`);
  console.log('Lost Leads Details:', lostPresetData.items.map(l => ({
    id: l.id,
    company: l.company?.name,
    status: l.status,
  })));

  console.log('\n=== LIVE VERIFICATION COMPLETE ===');
}

main().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});
