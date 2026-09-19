const dotenv = require('dotenv');
dotenv.config({ path: './apps/api/.env' });

const { PrismaClient } = require('@ai-sales-agent/database');

const API_BASE_URL = 'http://localhost:4000';

async function main() {
  const prisma = new PrismaClient();
  await prisma.$connect();

  console.log('=== STEP 4: CONCURRENT GMAIL INBOX SYNC TEST ===');

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

  const initialMsgCount = await prisma.message.count();
  const initialConvCount = await prisma.conversation.count();
  console.log(`Initial DB State: ${initialMsgCount} messages, ${initialConvCount} conversations.`);

  console.log('\nFiring 2 concurrent POST /gmail/sync requests via Promise.all...');
  const syncUrl = `${API_BASE_URL}/gmail/sync`;

  const startTime = Date.now();
  const [syncRes1, syncRes2] = await Promise.all([
    fetch(syncUrl, { method: 'POST', headers: authHeaders }).then(r => r.json()),
    fetch(syncUrl, { method: 'POST', headers: authHeaders }).then(r => r.json()),
  ]);
  const durationMs = Date.now() - startTime;

  console.log(`\nConcurrent sync requests finished in ${durationMs}ms:`);
  console.log('Sync 1 Response:', JSON.stringify(syncRes1, null, 2));
  console.log('Sync 2 Response:', JSON.stringify(syncRes2, null, 2));

  const postMsgCount = await prisma.message.count();
  const postConvCount = await prisma.conversation.count();
  console.log(`\nPost-Sync DB State: ${postMsgCount} messages, ${postConvCount} conversations.`);

  // Check for any duplicate gmailMessageId in DB
  const messages = await prisma.message.findMany({ select: { gmailMessageId: true } });
  const ids = messages.map(m => m.gmailMessageId).filter(Boolean);
  const uniqueIds = new Set(ids);
  const hasDuplicateMessages = ids.length !== uniqueIds.size;

  console.log(`Duplicate Message Check: ${ids.length} message IDs, ${uniqueIds.size} unique.`);
  console.log(`Has Duplicate Messages?: ${hasDuplicateMessages ? 'FAIL ❌' : 'PASS ✅ None'}`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
