import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../../../apps/api/.env') });

import { PrismaClient, HumanReviewStatus, HumanReviewTriggerSource } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== TESTING HUMAN REVIEW RBAC & JUSTIFICATION VALIDATION ===');

  // 1. Authenticate as Admin & Rep
  const adminLogin = await fetch('http://localhost:4000/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@enterprise.com', password: 'Password123!' }),
  }).then((r) => r.json());

  const repLogin = await fetch('http://localhost:4000/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'rep@enterprise.com', password: 'Password123!' }),
  }).then((r) => r.json());

  const adminToken = adminLogin.tokens.accessToken;
  const repToken = repLogin.tokens.accessToken;

  console.log('Admin Token Available:', !!adminToken, '| Rep Token Available:', !!repToken);

  // 2. Find a lead
  const lead = await prisma.lead.findFirst({
    where: { company: { name: 'Nexis Integrated Cloud Solutions' } },
  });

  if (!lead) {
    console.error('Lead not found');
    return;
  }

  // 3. Create a clean PENDING HumanReview
  const review = await prisma.humanReview.create({
    data: {
      leadId: lead.id,
      triggerSource: HumanReviewTriggerSource.RESTRICTION_CHECK,
      triggerReason: 'Automated compliance test flag: DNC domain check',
      status: HumanReviewStatus.PENDING,
    },
  });

  console.log(`Created PENDING HumanReview ID: ${review.id} for Lead: ${lead.id}`);

  // Test 1: Non-Admin (SALES_REP) Attempt -> 403 Forbidden
  console.log('\n--- Test 1: Sales Rep Attempt (Non-Admin) ---');
  const repResolveRes = await fetch(`http://localhost:4000/human-reviews/${review.id}/resolve`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${repToken}`,
    },
    body: JSON.stringify({
      decision: 'APPROVED',
      justification: 'Attempting resolution without admin privileges',
    }),
  });
  console.log('HTTP Status:', repResolveRes.status, '(Expected: 403 Forbidden)');
  const repErr = await repResolveRes.json();
  console.log('Response:', JSON.stringify(repErr));

  // Test 2: Admin with < 10 chars justification -> 400 Bad Request
  console.log('\n--- Test 2: Admin with Short Justification (<10 chars) ---');
  const shortJustRes = await fetch(`http://localhost:4000/human-reviews/${review.id}/resolve`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      decision: 'APPROVED',
      justification: 'Too short', // 9 chars < 10
    }),
  });
  console.log('HTTP Status:', shortJustRes.status, '(Expected: 400 Bad Request)');
  const shortErr = await shortJustRes.json();
  console.log('Response:', JSON.stringify(shortErr));

  // Test 3: Admin with valid >= 10 chars justification -> 200 OK
  console.log('\n--- Test 3: Admin with Valid Justification (>=10 chars) ---');
  const validResolveRes = await fetch(`http://localhost:4000/human-reviews/${review.id}/resolve`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      decision: 'APPROVED',
      justification: 'Verified valid enterprise authorization. Restriction cleared by compliance admin.',
    }),
  });
  console.log('HTTP Status:', validResolveRes.status, '(Expected: 200 OK)');
  const validData = await validResolveRes.json();
  console.log('Resolved Status in DB:', validData.status);
  console.log('Resolved By User ID:', validData.resolvedByUserId);
  console.log('Justification Recorded in DB:', validData.resolutionJustification);

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
});
