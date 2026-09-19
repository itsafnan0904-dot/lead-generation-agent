const dotenv = require('dotenv');
dotenv.config({ path: './apps/api/.env' });

const { PrismaClient } = require('@ai-sales-agent/database');

async function main() {
  const prisma = new PrismaClient();
  await prisma.$connect();

  console.log('=== COMPLETE AUDIT OF OUTREACH SENDS ===');
  console.log('Current Environment Safety Settings:');
  console.log('  OUTREACH_SAFE_TEST_MODE:', process.env.OUTREACH_SAFE_TEST_MODE);
  console.log('  OUTREACH_TEST_RECIPIENT_EMAIL:', process.env.OUTREACH_TEST_RECIPIENT_EMAIL);

  const drafts = await prisma.outreachDraft.findMany({
    include: {
      lead: {
        include: {
          primaryContact: true,
          company: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  console.log(`\nTotal OutreachDraft records in DB: ${drafts.length}`);
  const sentDrafts = drafts.filter(d => d.status === 'SENT' || d.sentAt || d.gmailMessageId);
  console.log(`Total Sent OutreachDraft records: ${sentDrafts.length}\n`);

  sentDrafts.forEach((d, i) => {
    console.log(`--- [SENT DRAFT #${i + 1}] ---`);
    console.log(`  Draft ID:              ${d.id}`);
    console.log(`  Status:                ${d.status}`);
    console.log(`  Gmail Message ID:      ${d.gmailMessageId}`);
    console.log(`  Gmail Thread ID:       ${d.gmailThreadId}`);
    console.log(`  Sent Timestamp:        ${d.sentAt}`);
    console.log(`  Created Timestamp:     ${d.createdAt}`);
    console.log(`  Lead ID:               ${d.leadId}`);
    console.log(`  Company:               ${d.lead?.company?.name}`);
    console.log(`  Configured Prospect:   ${d.lead?.primaryContact?.firstName} ${d.lead?.primaryContact?.lastName} (${d.lead?.primaryContact?.email})`);
    console.log(`  Subject:               ${d.subject}`);
  });

  const auditEvents = await prisma.auditEvent.findMany({
    where: {
      OR: [
        { action: 'OUTREACH_EMAIL_SENT' },
        { entityType: 'OUTREACH_DRAFT' },
      ],
    },
    orderBy: { createdAt: 'desc' },
  });

  console.log(`\n=== AUDIT EVENTS (${auditEvents.length} records) ===`);
  auditEvents.forEach((a, i) => {
    console.log(`\n--- [AUDIT EVENT #${i + 1}] ---`);
    console.log(`  Event ID:    ${a.id}`);
    console.log(`  Action:      ${a.action}`);
    console.log(`  Entity Type: ${a.entityType}`);
    console.log(`  Entity ID:   ${a.entityId}`);
    console.log(`  Created At:  ${a.createdAt}`);
    console.log(`  New State:   ${JSON.stringify(a.newState, null, 2)}`);
    console.log(`  Metadata:    ${JSON.stringify(a.metadata, null, 2)}`);
  });

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
