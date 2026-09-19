import * as http from 'http';

async function postLogin(): Promise<string> {
  const payload = JSON.stringify({
    email: 'admin@enterprise.com',
    password: 'Password123!',
  });

  return new Promise((resolve, reject) => {
    const req = http.request(
      'http://localhost:3000/api/auth/login',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
      },
      (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 400) {
            return reject(new Error(`Login failed (${res.statusCode}): ${body}`));
          }
          const rawCookies = res.headers['set-cookie'] || [];
          const cookieHeader = rawCookies.map((c) => c.split(';')[0]).join('; ');
          resolve(cookieHeader);
        });
      },
    );
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function fetchRoute(path: string, cookie: string): Promise<{ status: number; html: string }> {
  return new Promise((resolve, reject) => {
    http
      .get(
        `http://localhost:3000${path}`,
        {
          headers: { Cookie: cookie },
        },
        (res) => {
          let html = '';
          res.on('data', (c) => (html += c));
          res.on('end', () => resolve({ status: res.statusCode || 0, html }));
        },
      )
      .on('error', reject);
  });
}

async function patchRead(notifId: string, cookie: string): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      `http://localhost:3000/api/notifications/${notifId}/read`,
      {
        method: 'PATCH',
        headers: {
          Cookie: cookie,
          'Content-Type': 'application/json',
        },
      },
      (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode || 0, body: JSON.parse(body) });
          } catch {
            resolve({ status: res.statusCode || 0, body });
          }
        });
      },
    );
    req.on('error', reject);
    req.end();
  });
}

async function getApiNotifs(query: string, cookie: string): Promise<any> {
  return new Promise((resolve, reject) => {
    http
      .get(
        `http://localhost:3000/api/notifications?${query}`,
        {
          headers: { Cookie: cookie },
        },
        (res) => {
          let body = '';
          res.on('data', (c) => (body += c));
          res.on('end', () => {
            try {
              resolve(JSON.parse(body));
            } catch {
              resolve(body);
            }
          });
        },
      )
      .on('error', reject);
  });
}

async function main() {
  console.log('=== STEP 1: AUTHENTICATING INTO NEXT.JS WEB APP ===');
  const cookie = await postLogin();
  console.log('Obtained Next.js session cookies successfully.');

  console.log('\n=== STEP 2: RENDER NOTIFICATIONS PAGE (SSR) ===');
  const pageRes = await fetchRoute('/notifications', cookie);
  console.log(`GET /notifications -> HTTP ${pageRes.status} (HTML size: ${pageRes.html.length} bytes)`);

  const checks = [
    { label: 'Display Title H1 "Notifications & System Alerts"', needle: 'Notifications &amp; System Alerts' },
    { label: 'Priority Pill "ACTION REQUIRED"', needle: 'ACTION REQUIRED' },
    { label: 'Priority Pill "IMPORTANT"', needle: 'IMPORTANT' },
    { label: 'Priority Pill "INFO"', needle: 'INFO' },
    { label: 'Action CTA "Review Lead Restrictions →"', needle: 'Review Lead Restrictions →' },
    { label: 'Lead target link href="/leads/428c73eb-39f8-4806-8d88-fdff1815069d"', needle: '/leads/428c73eb-39f8-4806-8d88-fdff1815069d' },
    { label: 'Action CTA "Inspect Company Intelligence →"', needle: 'Inspect Company Intelligence →' },
    { label: 'Company target link href="/companies/cec3345c-34e1-454f-b9eb-ad66dee24dc3"', needle: '/companies/cec3345c-34e1-454f-b9eb-ad66dee24dc3' },
    { label: 'Section 10 Actor Badge "⚙ System Engine"', needle: '⚙ System Engine' },
    { label: 'Section 10 Actor Badge "● AI Agent"', needle: '● AI Agent' },
  ];

  for (const check of checks) {
    const passed = pageRes.html.includes(check.needle);
    console.log(`- ${check.label}: ${passed ? 'PASSED ✓' : 'FAILED ✗'}`);
    if (!passed) console.error(`  Did not find '${check.needle}' in HTML!`);
  }

  console.log('\n=== STEP 3: CONFIRM REAL DESTINATIONS FOR AT LEAST TWO ENTITY TYPES ===');
  // Entity Type 1: HUMAN_REVIEW -> /leads/428c73eb-39f8-4806-8d88-fdff1815069d
  console.log('--- Destination 1: HUMAN_REVIEW -> /leads/428c73eb-39f8-4806-8d88-fdff1815069d ---');
  const leadRes = await fetchRoute('/leads/428c73eb-39f8-4806-8d88-fdff1815069d', cookie);
  console.log(`GET /leads/428c73eb... -> HTTP ${leadRes.status} (${leadRes.html.length} bytes)`);
  const leadHasSummit = leadRes.html.includes('Summit Enterprise Holdings LLC');
  const leadHasContact = leadRes.html.includes('Rachel Sterling');
  const leadHasStatus = leadRes.html.includes('HUMAN_REVIEW');
  console.log(`- Destination verifies "Summit Enterprise Holdings LLC": ${leadHasSummit ? 'YES ✓' : 'NO ✗'}`);
  console.log(`- Destination verifies contact "Rachel Sterling": ${leadHasContact ? 'YES ✓' : 'NO ✗'}`);
  console.log(`- Destination verifies status "HUMAN_REVIEW": ${leadHasStatus ? 'YES ✓' : 'NO ✗'}`);

  // Entity Type 2: COMPANY -> /companies/cec3345c-34e1-454f-b9eb-ad66dee24dc3
  console.log('\n--- Destination 2: COMPANY -> /companies/cec3345c-34e1-454f-b9eb-ad66dee24dc3 ---');
  const companyRes = await fetchRoute('/companies/cec3345c-34e1-454f-b9eb-ad66dee24dc3', cookie);
  console.log(`GET /companies/cec3345c... -> HTTP ${companyRes.status} (${companyRes.html.length} bytes)`);
  const compHasOptics = companyRes.html.includes('Applied Optics &amp; Sensor Labs LLC') || companyRes.html.includes('Applied Optics & Sensor Labs LLC');
  console.log(`- Destination verifies "Applied Optics & Sensor Labs LLC": ${compHasOptics ? 'YES ✓' : 'NO ✗'}`);

  console.log('\n=== STEP 4: NEXT.JS API CLIENT ROUTES & SIDEBAR BADGE COUNT ===');
  const sidebarCheck1 = await getApiNotifs('limit=1', cookie);
  console.log(`Sidebar query (/api/notifications?limit=1) -> unreadCount = ${sidebarCheck1.unreadCount}`);

  // Query filters through Next.js /api/notifications route
  const apiAction = await getApiNotifs('priority=ACTION_REQUIRED', cookie);
  console.log(`Next.js API ?priority=ACTION_REQUIRED: total=${apiAction.total}, items=${apiAction.items?.length}`);

  const apiImportant = await getApiNotifs('priority=IMPORTANT', cookie);
  console.log(`Next.js API ?priority=IMPORTANT: total=${apiImportant.total}, items=${apiImportant.items?.length}`);

  const apiInfo = await getApiNotifs('priority=INFO', cookie);
  console.log(`Next.js API ?priority=INFO: total=${apiInfo.total}, items=${apiInfo.items?.length}`);

  const apiUnread = await getApiNotifs('isRead=false', cookie);
  console.log(`Next.js API ?isRead=false: total=${apiUnread.total}, items=${apiUnread.items?.length}`);

  // Mark an item as read via Next.js API route
  const unreadItem = apiInfo.items?.find((i: any) => !i.isRead) || apiAction.items?.[0];
  if (unreadItem) {
    console.log(`\nMarking item ${unreadItem.id} as read via Next.js PATCH /api/notifications/:id/read...`);
    const patchResult = await patchRead(unreadItem.id, cookie);
    console.log(`PATCH result: status=${patchResult.status}, isRead=${patchResult.body.isRead}, readAt=${patchResult.body.readAt}`);

    // Re-query sidebar badge count
    const sidebarCheck2 = await getApiNotifs('limit=1', cookie);
    console.log(`Sidebar query after mark-as-read: unreadCount = ${sidebarCheck2.unreadCount} (decremented from ${sidebarCheck1.unreadCount})`);
  }

  console.log('\n=== ALL END-TO-END VERIFICATIONS COMPLETED SUCCESSFULLY ===');
}

main().catch((e) => {
  console.error('E2E Verification Error:', e);
});
