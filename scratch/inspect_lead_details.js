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

  console.log('=== LEAD CURRENT STATUS ===');
  console.log('ID:', lead.id);
  console.log('Status:', lead.status);
  console.log('AI Control State:', lead.aiControlState);
  console.log('Company:', lead.company?.name);

  console.log('\n=== CONVERSATIONS & MESSAGES ===');
  lead.conversations.forEach((conv, i) => {
    console.log(`\nConversation #${i + 1} (ID: ${conv.id}, ThreadID: ${conv.gmailThreadId}):`);
    console.log('Subject:', conv.subject);
    console.log('Metadata:', JSON.stringify(conv.metadata, null, 2));
    console.log(`Messages (${conv.messages.length}):`);
    conv.messages.forEach((m, j) => {
      console.log(`  Msg [${j + 1}] (${m.id}) Direction: ${m.direction}, Sender: ${m.sender}, SentAt: ${m.sentAt.toISOString()}`);
      console.log(`      BodyText: ${m.bodyText}`);
      console.log(`      AI Actions (${m.aiActions.length}):`, m.aiActions.map(a => ({ type: a.actionType, status: a.status, parsed: a.parsedPayload })));
    });
  });

  console.log('\n=== RESTRICTION CHECKS ON LEAD ===');
  lead.restrictionChecks.forEach((rc, i) => {
    console.log(`\nCheck #${i + 1} (${rc.id}):`);
    console.log('Result:', rc.result);
    console.log('Created At:', rc.createdAt.toISOString());
    console.log('Reason:', rc.reason);
    console.log('Matched Rules:', JSON.stringify(rc.matchedRules, null, 2));
  });

  console.log('\n=== HUMAN REVIEWS ON LEAD ===');
  lead.humanReviews.forEach((hr, i) => {
    console.log(`\nHuman Review #${i + 1} (${hr.id}):`);
    console.log('Status:', hr.status);
    console.log('Trigger Reason:', hr.triggerReason);
    console.log('Created At:', hr.createdAt.toISOString());
  });

  console.log('\n=== UNASSIGNED CONVERSATIONS ===');
  const unassignedConvs = await prisma.conversation.findMany({
    where: { leadId: null },
    include: { messages: true },
    orderBy: { createdAt: 'desc' },
  });
  console.log(`Found ${unassignedConvs.length} unassigned conversations`);
  unassignedConvs.forEach((uc, idx) => {
    console.log(`Unassigned #${idx + 1}: ${uc.id} (Thread: ${uc.gmailThreadId}, Subject: ${uc.subject})`);
    uc.messages.forEach(m => console.log(`   Message from: ${m.sender} | Body: ${m.bodyText?.slice(0, 100)}`));
  });
}

main().finally(() => prisma.$disconnect());
