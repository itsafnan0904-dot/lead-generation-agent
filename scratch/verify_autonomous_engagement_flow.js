const dotenv = require('dotenv');
dotenv.config({ path: './apps/api/.env' });

const { PrismaClient } = require('@ai-sales-agent/database');

const API_BASE_URL = 'http://localhost:4000';

async function runLiveVerification() {
  const prisma = new PrismaClient();
  await prisma.$connect();

  console.log('================================================================');
  console.log(' STEP 1: VERIFY ENVIRONMENT & OUTREACH SAFE TEST MODE SETTINGS ');
  console.log('================================================================');
  console.log('OUTREACH_SAFE_TEST_MODE:', process.env.OUTREACH_SAFE_TEST_MODE);
  console.log('OUTREACH_TEST_RECIPIENT_EMAIL:', process.env.OUTREACH_TEST_RECIPIENT_EMAIL);

  if (process.env.OUTREACH_SAFE_TEST_MODE !== 'true') {
    throw new Error('CRITICAL SAFETY CHECK FAILED: OUTREACH_SAFE_TEST_MODE must be true');
  }
  if (!process.env.OUTREACH_TEST_RECIPIENT_EMAIL?.includes('@')) {
    throw new Error('CRITICAL SAFETY CHECK FAILED: OUTREACH_TEST_RECIPIENT_EMAIL must be a valid consented email');
  }

  // Login as Admin
  console.log('\n--- Authenticating as Admin ---');
  const loginRes = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@enterprise.com',
      password: 'Password123!',
    }),
  });

  if (!loginRes.ok) {
    throw new Error(`Admin login failed: ${await loginRes.text()}`);
  }

  const loginData = await loginRes.json();
  const token = loginData.tokens.accessToken;
  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
  console.log('Admin authenticated successfully. Role:', loginData.user.role);

  console.log('\n================================================================');
  console.log(' STEP 2: SETUP REAL TEST LEADS (APPROVAL & REJECTION CANDIDATES)');
  console.log('================================================================');

  // Test Lead A (Approval Candidate)
  const companyA = await prisma.company.upsert({
    where: { domain: 'vanguard-robotics-autonomous.com' },
    update: {},
    create: {
      name: 'Vanguard Autonomous Robotics',
      domain: 'vanguard-robotics-autonomous.com',
      industry: 'Industrial Automation & Robotics',
      size: '500-1000',
      location: 'Detroit, MI',
    },
  });

  const contactA = await prisma.contact.upsert({
    where: { email: 'elena.rostova@vanguard-robotics-autonomous.com' },
    update: {},
    create: {
      companyId: companyA.id,
      firstName: 'Elena',
      lastName: 'Rostova',
      email: 'elena.rostova@vanguard-robotics-autonomous.com',
      title: 'Chief Technology Officer',
    },
  });

  const leadA = await prisma.lead.create({
    data: {
      companyId: companyA.id,
      primaryContactId: contactA.id,
      status: 'COLD_LEAD',
      scoreTotal: 88,
      scoreServiceMatch: 38,
      scoreCompanyRelevance: 19,
      scoreContactQuality: 14,
      scoreProjectPotential: 12,
      scoreLocationMatch: 5,
      scoreBreakdownReason: { analysis: 'Strong fit for enterprise automation outreach' },
      metadata: { autonomousConversationMode: false },
    },
  });

  await prisma.research.create({
    data: {
      companyId: companyA.id,
      leadId: leadA.id,
      companySummary: 'Vanguard Robotics manufactures automated guided vehicles and robotic material handling cells.',
      keyInsights: ['Expanding automated warehouse operations in Q4', 'Migrating to unified MES integration'],
      painPoints: ['Legacy system interoperability challenges'],
      techStack: ['ROS2', 'Siemens PLC', 'Azure IoT'],
      completedAt: new Date(),
    },
  });

  console.log(`Created Test Lead A for Approval: ID '${leadA.id}', Company '${companyA.name}'`);

  // Test Lead B (Rejection Candidate)
  const companyB = await prisma.company.upsert({
    where: { domain: 'titan-logistics-autonomous.com' },
    update: {},
    create: {
      name: 'Titan Logistics Freight Corp',
      domain: 'titan-logistics-autonomous.com',
      industry: 'Freight Logistics',
      size: '1000-5000',
      location: 'Dallas, TX',
    },
  });

  const contactB = await prisma.contact.upsert({
    where: { email: 'marcus.brooks@titan-logistics-autonomous.com' },
    update: {},
    create: {
      companyId: companyB.id,
      firstName: 'Marcus',
      lastName: 'Brooks',
      email: 'marcus.brooks@titan-logistics-autonomous.com',
      title: 'Director of Logistics',
    },
  });

  const leadB = await prisma.lead.create({
    data: {
      companyId: companyB.id,
      primaryContactId: contactB.id,
      status: 'COLD_LEAD',
      scoreTotal: 72,
      scoreServiceMatch: 30,
      scoreCompanyRelevance: 15,
      scoreContactQuality: 12,
      scoreProjectPotential: 10,
      scoreLocationMatch: 5,
      metadata: { autonomousConversationMode: false },
    },
  });

  await prisma.research.create({
    data: {
      companyId: companyB.id,
      leadId: leadB.id,
      companySummary: 'Titan Logistics operates interstate dry-van and refrigerated carrier networks.',
      keyInsights: ['Seeking dispatch automation and fuel efficiency tooling'],
      painPoints: ['Route optimization delays'],
      techStack: ['McLeod Software', 'Samsara'],
      completedAt: new Date(),
    },
  });

  console.log(`Created Test Lead B for Rejection: ID '${leadB.id}', Company '${companyB.name}'`);

  console.log('\n================================================================');
  console.log(' STEP 3: PREVIEW ENDPOINT (GET /leads/:id/autonomous-engagement-preview)');
  console.log('================================================================');
  const previewRes = await fetch(`${API_BASE_URL}/leads/${leadA.id}/autonomous-engagement-preview`, {
    headers: authHeaders,
  });

  if (!previewRes.ok) {
    throw new Error(`Preview failed: ${await previewRes.text()}`);
  }

  const previewData = await previewRes.json();
  console.log('--- PREVIEW RESPONSE DATA ---');
  console.log('Lead ID:', previewData.lead.id);
  console.log('Company:', previewData.lead.company.name, `(${previewData.lead.company.industry})`);
  console.log('Primary Contact:', `${previewData.lead.primaryContact.firstName} ${previewData.lead.primaryContact.lastName} <${previewData.lead.primaryContact.email}>`);
  console.log('Research Summary:', previewData.researchSummary.companySummary);
  console.log('Key Insights:', previewData.researchSummary.keyInsights);
  console.log('Scoring Summary Total Score:', previewData.scoringSummary.scoreTotal);
  console.log('Proposed Pitch Subject:', previewData.proposedPitch.subject);
  console.log('Proposed Pitch Body snippet:', previewData.proposedPitch.bodyText.substring(0, 150) + '...');
  console.log('Proposed Pitch Call to Action:', previewData.proposedPitch.callToAction);
  console.log('AI Usage Metadata (Token Cost):', previewData.proposedPitch.aiUsageMetadata);
  console.log('Autonomous Mode Status:', previewData.autonomousStatus);

  const previewDraftId = previewData.proposedPitch.draftId;

  // Confirm preview had zero side effects
  const leadACheckBefore = await prisma.lead.findUnique({ where: { id: leadA.id } });
  console.log('Lead A autonomousConversationMode before approval:', (leadACheckBefore.metadata || {}).autonomousConversationMode);
  if ((leadACheckBefore.metadata || {}).autonomousConversationMode === true) {
    throw new Error('FAILURE: Preview endpoint improperly set autonomousConversationMode = true!');
  }

  console.log('\n================================================================');
  console.log(' STEP 4: APPROVE ENDPOINT (POST /leads/:id/approve-autonomous-engagement)');
  console.log('================================================================');
  const approveRes = await fetch(`${API_BASE_URL}/leads/${leadA.id}/approve-autonomous-engagement`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ draftId: previewDraftId }),
  });

  if (!approveRes.ok) {
    throw new Error(`Approval failed: ${await approveRes.text()}`);
  }

  const approveData = await approveRes.json();
  console.log('--- APPROVAL RESPONSE ---');
  console.log('Success:', approveData.success);
  console.log('AutonomousConversationMode:', approveData.autonomousConversationMode);
  console.log('Send Result Draft ID:', approveData.sendResult.draftId);
  console.log('Send Result Status:', approveData.sendResult.status);
  console.log('Send Result Gmail Message ID:', approveData.sendResult.gmailMessageId);
  console.log('Send Result Original Recipient:', approveData.sendResult.originalRecipient);
  console.log('Send Result Actual Recipient Used (Safe Test Target):', approveData.sendResult.actualRecipientUsed);
  console.log('Safe Test Mode Active:', approveData.sendResult.safeTestModeActive);

  // Direct database inspection
  const leadAPostApproval = await prisma.lead.findUnique({ where: { id: leadA.id } });
  const draftAPostApproval = await prisma.outreachDraft.findUnique({ where: { id: previewDraftId } });
  const auditEventApproval = await prisma.auditEvent.findFirst({
    where: { entityId: leadA.id, action: 'AUTONOMOUS_ENGAGEMENT_APPROVED' },
    orderBy: { createdAt: 'desc' },
  });

  console.log('\n--- Direct Database Inspection (Lead A) ---');
  console.log('DB lead.metadata.autonomousConversationMode:', leadAPostApproval.metadata?.autonomousConversationMode);
  console.log('DB lead.status:', leadAPostApproval.status);
  console.log('DB draft.status:', draftAPostApproval.status);
  console.log('DB draft.gmailMessageId:', draftAPostApproval.gmailMessageId);
  console.log('DB AuditEvent Action:', auditEventApproval?.action, '| ActorType:', auditEventApproval?.actorType, '| UserID:', auditEventApproval?.userId);

  if (leadAPostApproval.metadata?.autonomousConversationMode !== true) {
    throw new Error('FAILURE: Lead A metadata does not reflect autonomousConversationMode = true');
  }
  if (draftAPostApproval.status !== 'SENT') {
    throw new Error('FAILURE: Draft A was not marked SENT');
  }

  console.log('\n================================================================');
  console.log(' STEP 5: REJECT ENDPOINT (POST /leads/:id/reject-autonomous-engagement)');
  console.log('================================================================');
  // First preview for Lead B
  const previewBRes = await fetch(`${API_BASE_URL}/leads/${leadB.id}/autonomous-engagement-preview`, {
    headers: authHeaders,
  });
  const previewBData = await previewBRes.json();
  const previewDraftIdB = previewBData.proposedPitch.draftId;

  const rejectRes = await fetch(`${API_BASE_URL}/leads/${leadB.id}/reject-autonomous-engagement`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      draftId: previewDraftIdB,
      reason: 'Budget cycle not aligned for autonomous outreach in current quarter',
    }),
  });

  if (!rejectRes.ok) {
    throw new Error(`Rejection failed: ${await rejectRes.text()}`);
  }

  const rejectData = await rejectRes.json();
  console.log('--- REJECTION RESPONSE ---');
  console.log('Success:', rejectData.success);
  console.log('AutonomousConversationMode:', rejectData.autonomousConversationMode);
  console.log('Status:', rejectData.status);
  console.log('Reason:', rejectData.reason);

  // Direct database inspection
  const leadBPostReject = await prisma.lead.findUnique({ where: { id: leadB.id } });
  const draftBPostReject = await prisma.outreachDraft.findUnique({ where: { id: previewDraftIdB } });
  const auditEventReject = await prisma.auditEvent.findFirst({
    where: { entityId: leadB.id, action: 'AUTONOMOUS_ENGAGEMENT_REJECTED' },
    orderBy: { createdAt: 'desc' },
  });

  console.log('\n--- Direct Database Inspection (Lead B) ---');
  console.log('DB lead.metadata.autonomousConversationMode:', leadBPostReject.metadata?.autonomousConversationMode);
  console.log('DB lead.status:', leadBPostReject.status);
  console.log('DB draft.status:', draftBPostReject.status, '(Remains un-sent DRAFT)');
  console.log('DB AuditEvent Action:', auditEventReject?.action, '| ActorType:', auditEventReject?.actorType, '| UserID:', auditEventReject?.userId);

  if (leadBPostReject.metadata?.autonomousConversationMode === true) {
    throw new Error('FAILURE: Lead B metadata improperly has autonomousConversationMode = true');
  }
  if (draftBPostReject.status === 'SENT') {
    throw new Error('FAILURE: Draft B was erroneously sent on rejection');
  }

  console.log('\n================================================================');
  console.log(' STEP 6: SAFEGUARD TESTS (RBAC, PATCH LOCK, MISMATCHED DRAFTS)');
  console.log('================================================================');

  // Test A: Attempt to enable autonomousConversationMode via generic PATCH /leads/:id
  const patchRes = await fetch(`${API_BASE_URL}/leads/${leadB.id}`, {
    method: 'PATCH',
    headers: authHeaders,
    body: JSON.stringify({
      metadata: { autonomousConversationMode: true, testExploit: 'attempt_bypass' },
    }),
  });
  const patchData = await patchRes.json();
  console.log('Generic PATCH response metadata.autonomousConversationMode:', patchData.metadata?.autonomousConversationMode);
  if (patchData.metadata?.autonomousConversationMode === true) {
    throw new Error('FAILURE: Generic PATCH was able to enable autonomousConversationMode!');
  }
  console.log('PASSED: Generic PATCH cannot enable autonomousConversationMode.');

  // Test B: Attempt approval with a mismatched draftId (Draft A belonging to Lead A passed to Lead B)
  const mismatchRes = await fetch(`${API_BASE_URL}/leads/${leadB.id}/approve-autonomous-engagement`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ draftId: previewDraftId }), // draft belongs to lead A
  });
  console.log('Mismatched draft approval HTTP status:', mismatchRes.status, `(Expected 400 or 404)`);
  if (mismatchRes.ok) {
    throw new Error('FAILURE: Mismatched draft approval was accepted!');
  }
  console.log('PASSED: Mismatched draft approval strictly rejected.');

  // Test C: Non-Admin RBAC test
  // Login as Sales Rep
  const repLoginRes = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'rep@enterprise.com',
      password: 'Password123!',
    }),
  });
  if (repLoginRes.ok) {
    const repLogin = await repLoginRes.json();
    const repHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${repLogin.tokens.accessToken}`,
    };

    const repPreviewRes = await fetch(`${API_BASE_URL}/leads/${leadA.id}/autonomous-engagement-preview`, {
      headers: repHeaders,
    });
    console.log('Sales Rep preview HTTP status:', repPreviewRes.status, '(Expected 403 Forbidden)');
    if (repPreviewRes.status !== 403) {
      throw new Error(`FAILURE: RolesGuard did not enforce 403 for Sales Rep on preview (got ${repPreviewRes.status})`);
    }

    const repApproveRes = await fetch(`${API_BASE_URL}/leads/${leadA.id}/approve-autonomous-engagement`, {
      method: 'POST',
      headers: repHeaders,
      body: JSON.stringify({ draftId: previewDraftId }),
    });
    console.log('Sales Rep approve HTTP status:', repApproveRes.status, '(Expected 403 Forbidden)');
    if (repApproveRes.status !== 403) {
      throw new Error(`FAILURE: RolesGuard did not enforce 403 for Sales Rep on approve (got ${repApproveRes.status})`);
    }
    console.log('PASSED: RBAC RolesGuard(ADMIN) enforced for non-admin users.');
  }

  console.log('\n================================================================');
  console.log(' ALL VERIFICATION STEPS PASSED SUCCESSFULLY! ');
  console.log('================================================================');

  await prisma.$disconnect();
}

runLiveVerification().catch((err) => {
  console.error('VERIFICATION ERROR:', err);
  process.exit(1);
});
