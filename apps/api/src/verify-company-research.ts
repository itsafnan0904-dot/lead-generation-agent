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
  const adminLogin = await request('http://localhost:4000/auth/login', {
    method: 'POST',
    body: {
      email: 'admin@enterprise.com',
      password: 'Password123!'
    }
  });
  const adminToken = adminLogin.data.accessToken || adminLogin.data.tokens?.accessToken;

  const company = await prisma.company.findFirst({
    where: { name: { contains: 'Clean' } },
    include: { research: true }
  });

  if (!company) {
    console.log('No test company found');
    return;
  }

  console.log('Testing POST /companies/' + company.id + '/research for', company.name);
  console.log('Existing research count:', company.research.length);

  const start = Date.now();
  const res = await request(
    `http://localhost:4000/companies/${company.id}/research`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {}
    }
  );
  const latencyMs = Date.now() - start;

  console.log('Response Status:', res.status);
  console.log('Latency:', latencyMs, 'ms');
  console.log('Research Summary:', res.data?.research?.companySummary);
  console.log('Restriction Check Result:', res.data?.restrictionCheck?.result);

  // Check updated research records count in DB
  const updatedCompany = await prisma.company.findUnique({
    where: { id: company.id },
    include: { research: true }
  });
  console.log('Updated research count in DB:', updatedCompany?.research.length);

  // Check AIAction table
  const latestAi = await prisma.aIAction.findFirst({
    where: { actionType: 'RESEARCH_COMPANY' },
    orderBy: { createdAt: 'desc' }
  });
  console.log('Latest AIAction for RESEARCH_COMPANY:', latestAi);

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
});
