const dotenv = require('dotenv');
dotenv.config({ path: './apps/api/.env' });

const { PrismaClient } = require('@ai-sales-agent/database');

const API_BASE_URL = 'http://localhost:4000';

async function main() {
  const prisma = new PrismaClient();
  await prisma.$connect();

  console.log('=== STEP 1: SAFETY CONFIRMATION ===');
  console.log('OUTREACH_SAFE_TEST_MODE:', process.env.OUTREACH_SAFE_TEST_MODE);
  console.log('OUTREACH_TEST_RECIPIENT_EMAIL:', process.env.OUTREACH_TEST_RECIPIENT_EMAIL);

  if (process.env.OUTREACH_SAFE_TEST_MODE !== 'true') {
    throw new Error('ABORT: OUTREACH_SAFE_TEST_MODE must be true');
  }

  // Authenticate as Admin
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
  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  // Create clean test company & contact & lead & draft
  const company = await prisma.company.upsert({
    where: { domain: 'concurrent-race-test.com' },
    update: {},
    create: {
      name: 'Concurrent Race Test Corp',
      domain: 'concurrent-race-test.com',
      industry: 'Aerospace Engineering',
    },
  });

  const contact = await prisma.contact.upsert({
    where: { email: 'concurrency.lead@concurrent-race-test.com' },
    update: {},
    create: {
      companyId: company.id,
      firstName: 'Alex',
      lastName: 'Vance',
      email: 'concurrency.lead@concurrent-race-test.com',
      title: 'VP Engineering',
    },
  });

  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN', isActive: true } });

  const lead = await prisma.lead.create({
    data: {
      companyId: company.id,
      primaryContactId: contact.id,
      assignedUserId: admin?.id,
      status: 'COLD_LEAD',
    },
  });

  const draft = await prisma.outreachDraft.create({
    data: {
      leadId: lead.id,
      subject: 'Exploring High-Precision Engineering Solutions',
      bodyText: 'Hi Alex,\n\nI hope this finds you well. Exploring engineering collaborations.\n\nBest regards,\nAfnan Jawad\nSales Director',
      status: 'DRAFT',
    },
  });

  console.log(`\nCreated test draft '${draft.id}' with status '${draft.status}' for Lead '${lead.id}'.`);

  console.log('\n=== STEP 2: FIRING CONCURRENT SEND REQUESTS VIA PROMISE.ALL ===');
  const sendUrl = `${API_BASE_URL}/outreach/${draft.id}/send`;

  const startTime = Date.now();
  const sendRequests = [1, 2, 3].map(async (reqIndex) => {
    try {
      const res = await fetch(sendUrl, {
        method: 'POST',
        headers: authHeaders,
      });
      const data = await res.json();
      return {
        requestIndex: reqIndex,
        status: res.status,
        ok: res.ok,
        data,
      };
    } catch (err) {
      return {
        requestIndex: reqIndex,
        error: err.message,
      };
    }
  });

  const results = await Promise.all(sendRequests);
  const durationMs = Date.now() - startTime;

  console.log(`\nConcurrent requests resolved in ${durationMs}ms:`);
  results.forEach((r) => {
    console.log(`Request #${r.requestIndex}: HTTP ${r.status} - ${JSON.stringify(r.data || r.error)}`);
  });

  const successCount = results.filter((r) => r.ok).length;
  const conflictCount = results.filter((r) => r.status === 409).length;

  console.log(`\n=== CONCURRENT TEST SUMMARY ===`);
  console.log(`Successful sends: ${successCount}`);
  console.log(`Rejected with 409 Conflict: ${conflictCount}`);

  // Inspect database state
  const finalDraft = await prisma.outreachDraft.findUnique({ where: { id: draft.id } });
  console.log(`Final Database Draft Status: ${finalDraft.status}`);
  console.log(`Gmail Message ID: ${finalDraft.gmailMessageId}`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
