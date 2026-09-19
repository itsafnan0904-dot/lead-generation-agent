import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

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
  console.log('=== 1. ADMIN LOGIN & TOKEN ===');
  const adminLogin = await request('http://localhost:4000/auth/login', {
    method: 'POST',
    body: {
      email: 'admin@enterprise.com',
      password: 'Password123!'
    }
  });
  console.log('Admin login status:', adminLogin.status, 'token exists:', !!adminLogin.data?.tokens?.accessToken || !!adminLogin.data?.accessToken);
  const adminToken = adminLogin.data.accessToken || adminLogin.data.tokens?.accessToken;

  console.log('\n=== 2. SALES_REP LOGIN & TOKEN ===');
  const repLogin = await request('http://localhost:4000/auth/login', {
    method: 'POST',
    body: {
      email: 'rep@enterprise.com',
      password: 'Password123!'
    }
  });
  console.log('Rep login status:', repLogin.status, 'token exists:', !!repLogin.data?.tokens?.accessToken || !!repLogin.data?.accessToken);
  const repToken = repLogin.data.accessToken || repLogin.data.tokens?.accessToken;

  // Find a pending human review
  let pendingReview = await prisma.humanReview.findFirst({
    where: { status: 'PENDING' }
  });

  if (!pendingReview) {
    const lead = await prisma.lead.findFirst({ where: { status: 'RESTRICTED' } });
    if (lead) {
      pendingReview = await prisma.humanReview.create({
        data: {
          leadId: lead.id,
          triggerReason: 'MANUAL_RESTRICTION_TRIGGER',
          status: 'PENDING',
          triggerSource: 'RESTRICTION_CHECK'
        }
      });
    }
  }

  console.log('\n=== 3. REAL BACKEND VALIDATION: SUB-10-CHAR JUSTIFICATION ===');
  if (pendingReview) {
    const shortRes = await request(
      `http://localhost:4000/human-reviews/${pendingReview.id}/resolve`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` },
        body: { decision: 'APPROVED', justification: 'short' }
      }
    );
    console.log('Submitting justification: "short" (5 chars)');
    console.log('Backend HTTP Status:', shortRes.status);
    console.log('Backend Response Body:', JSON.stringify(shortRes.data, null, 2));
  }

  console.log('\n=== 4. REAL BACKEND ROLE GATING: SALES_REP ATTEMPT ===');
  if (pendingReview) {
    const repRes = await request(
      `http://localhost:4000/human-reviews/${pendingReview.id}/resolve`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${repToken}` },
        body: { decision: 'APPROVED', justification: 'Valid length justification for testing' }
      }
    );
    console.log('SALES_REP resolve attempt HTTP Status:', repRes.status);
    console.log('SALES_REP resolve attempt Response Body:', JSON.stringify(repRes.data, null, 2));
  }

  console.log('\n=== 5. RESTRICTION CHECK AI METRICS ===');
  const leadToTest = await prisma.lead.findFirst({
    where: { company: { name: { contains: 'Joist' } } }
  }) || await prisma.lead.findFirst();

  if (leadToTest) {
    console.log('Executing restriction-check on lead:', leadToTest.id);
    const start = Date.now();
    const res = await request(
      `http://localhost:4000/leads/${leadToTest.id}/restriction-check`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` }
      }
    );
    const latencyMs = Date.now() - start;
    console.log('Restriction Check Response Status:', res.status);
    console.log('Lead Status after check:', res.data?.status);
    console.log('Restriction Check Latency:', latencyMs, 'ms');
  }

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
});
