const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const lead = await prisma.lead.findUnique({
    where: { id: 'd8df87c1-ef0d-4e65-b4ff-4e1cd1641695' },
    include: {
      company: true,
      primaryContact: true,
      conversations: {
        include: {
          messages: {
            include: { aiActions: true },
            orderBy: { sentAt: 'asc' },
          },
        },
      },
      restrictionChecks: {
        orderBy: { createdAt: 'desc' },
      },
      humanReviews: {
        orderBy: { createdAt: 'desc' },
      },
      aiActions: {
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  console.log('=== LEAD RECORD ===');
  console.log('Lead ID:', lead.id);
  console.log('Current Status:', lead.status);
  console.log('AI Control State:', lead.aiControlState);
  console.log('Company:', lead.company?.name);
  console.log('Primary Contact:', lead.primaryContact?.email);

  console.log('\n=== LEAD CONVERSATIONS ===');
  console.log(`Attached Conversations: ${lead.conversations.length}`);
  lead.conversations.forEach((conv, i) => {
    console.log(`\nConversation #${i + 1}:`);
    console.log('  ID:', conv.id);
    console.log('  gmailThreadId:', conv.gmailThreadId);
    console.log('  Subject:', conv.subject);
    console.log('  Metadata:', JSON.stringify(conv.metadata, null, 2));
    console.log(`  Messages in Conversation (${conv.messages.length}):`);
    conv.messages.forEach((m, j) => {
      console.log(`    Msg [${j + 1}] (${m.id})`);
      console.log(`      Direction: ${m.direction}`);
      console.log(`      Sender: ${m.sender}`);
      console.log(`      Recipient: ${m.recipient}`);
      console.log(`      Subject: ${m.subject}`);
      console.log(`      SentAt: ${m.sentAt.toISOString()}`);
      console.log(`      CreatedAt: ${m.createdAt.toISOString()}`);
      console.log(`      BodyText:\n"${m.bodyText}"`);
      console.log(`      AI Actions (${m.aiActions.length}):`);
      m.aiActions.forEach(a => {
        console.log(`        - ActionType: ${a.actionType}, Status: ${a.status}`);
        console.log(`          Model: ${a.modelUsed}`);
        console.log(`          ParsedPayload:`, JSON.stringify(a.parsedPayload, null, 2));
      });
    });
  });

  console.log('\n=== LEAD RESTRICTION CHECKS ===');
  console.log(`Total Restriction Checks: ${lead.restrictionChecks.length}`);
  lead.restrictionChecks.forEach((rc, i) => {
    console.log(`\nRestriction Check #${i + 1} (${rc.id}):`);
    console.log('  Result:', rc.result);
    console.log('  Created At:', rc.createdAt.toISOString());
    console.log('  Reason:', rc.reason);
    console.log('  Matched Rules:', JSON.stringify(rc.matchedRules, null, 2));
    console.log('  Checked Payload:', JSON.stringify(rc.checkedPayload, null, 2));
  });

  console.log('\n=== LEAD HUMAN REVIEWS ===');
  console.log(`Total Human Reviews: ${lead.humanReviews.length}`);
  lead.humanReviews.forEach((hr, i) => {
    console.log(`\nHuman Review #${i + 1} (${hr.id}):`);
    console.log('  Status:', hr.status);
    console.log('  Trigger Source:', hr.triggerSource);
    console.log('  Trigger Reason:', hr.triggerReason);
    console.log('  Resolution Justification:', hr.resolutionJustification);
    console.log('  Created At:', hr.createdAt.toISOString());
  });
}

main().finally(() => prisma.$disconnect());
