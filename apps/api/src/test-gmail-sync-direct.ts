import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function request(url: string, options: { method?: string; headers?: Record<string, string>; body?: any } = {}) {
  const res = await fetch(url, {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok, data };
}

async function main() {
  console.log('=== 1. CHECK GMAIL ACCOUNT IN DB ===');
  const gmailAccount = await prisma.gmailAccount.findFirst({
    where: { isActive: true },
  });
  console.log('Active Gmail account in DB:', gmailAccount ? {
    id: gmailAccount.id,
    email: gmailAccount.email,
    isActive: gmailAccount.isActive,
    tokenExpiresAt: gmailAccount.tokenExpiresAt,
    isExpired: gmailAccount.tokenExpiresAt.getTime() <= Date.now()
  } : 'NO ACTIVE GMAIL ACCOUNT');

  console.log('\n=== 2. ADMIN LOGIN & TOKEN ===');
  const adminLogin = await request('http://localhost:4000/auth/login', {
    method: 'POST',
    body: {
      email: 'admin@enterprise.com',
      password: 'Password123!'
    }
  });
  const adminToken = adminLogin.data?.accessToken || adminLogin.data?.tokens?.accessToken;
  console.log('Admin login status:', adminLogin.status, 'token exists:', !!adminToken);

  console.log('\n=== 3. CALL POST /gmail/sync DIRECTLY ON BACKEND ===');
  const syncRes = await request('http://localhost:4000/gmail/sync', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  console.log('Direct Backend POST /gmail/sync response:');
  console.log('HTTP Status:', syncRes.status);
  console.log('Response Body:', JSON.stringify(syncRes.data, null, 2));

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
});
