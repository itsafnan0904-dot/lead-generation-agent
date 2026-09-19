const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('=== STEP 1: SEARCHING FOR INGESTED MESSAGES ===\n');

  // Search by text content
  const messagesByText = await prisma.message.findMany({
    where: {
      OR: [
        { bodyText: { contains: 'OWSJ', mode: 'insensitive' } },
        { bodyText: { contains: 'steel decking', mode: 'insensitive' } },
        { bodyHtml: { contains: 'OWSJ', mode: 'insensitive' } },
        { bodyHtml: { contains: 'steel decking', mode: 'insensitive' } },
        { sender: { contains: '70176613', mode: 'insensitive' } },
        { recipient: { contains: '70176613', mode: 'insensitive' } },
      ],
    },
    include: {
      conversation: {
        include: {
          lead: {
            include: {
              company: true,
              primaryContact: true,
            },
          },
        },
      },
      aiActions: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  console.log(`Found ${messagesByText.length} message(s) matching search criteria:`);
  messagesByText.forEach((msg, idx) => {
    console.log(`\n--- Message #${idx + 1} ---`);
    console.log('ID:', msg.id);
    console.log('Gmail Message ID:', msg.gmailMessageId);
    console.log('Direction:', msg.direction);
    console.log('Sender:', msg.sender);
    console.log('Recipient:', msg.recipient);
    console.log('Subject:', msg.subject);
    console.log('Sent At:', msg.sentAt);
    console.log('Created At:', msg.createdAt);
    console.log('Body Text:\n', msg.bodyText);
    console.log('Conversation ID:', msg.conversationId);
    console.log('Conversation Gmail Thread ID:', msg.conversation?.gmailThreadId);
    console.log('Attached Lead ID:', msg.conversation?.leadId);
    console.log('Attached Lead Status:', msg.conversation?.lead?.status);
    console.log('Attached Lead AI Control State:', msg.conversation?.lead?.aiControlState);
    console.log('AI Actions on Message:', msg.aiActions);
  });

  console.log('\n=== STEP 2: CHECKING ALL RECENT CONVERSATIONS ===');
  const recentConversations = await prisma.conversation.findMany({
    orderBy: { updatedAt: 'desc' },
    take: 5,
    include: {
      lead: {
        include: {
          company: true,
          primaryContact: true,
        },
      },
      messages: true,
    },
  });

  recentConversations.forEach((conv, idx) => {
    console.log(`\n--- Conversation #${idx + 1} ---`);
    console.log('ID:', conv.id);
    console.log('Gmail Thread ID:', conv.gmailThreadId);
    console.log('Subject:', conv.subject);
    console.log('Lead ID:', conv.leadId);
    console.log('Lead Company:', conv.lead?.company?.name);
    console.log('Metadata:', JSON.stringify(conv.metadata, null, 2));
    console.log('Message Count:', conv.messages.length);
    conv.messages.forEach(m => {
      console.log(`  Msg: [${m.direction}] from '${m.sender}' to '${m.recipient}' (ID: ${m.id}, gmailMsgId: ${m.gmailMessageId})`);
    });
  });

  console.log('\n=== STEP 3: CHECKING TEST LEAD d8df87c1-ef0d-4e65-b4ff-4e1cd1641695 ===');
  const testLead = await prisma.lead.findUnique({
    where: { id: 'd8df87c1-ef0d-4e65-b4ff-4e1cd1641695' },
    include: {
      company: true,
      primaryContact: true,
      conversations: {
        include: { messages: true },
      },
      restrictionChecks: true,
      humanReviews: true,
      aiActions: true,
    },
  });

  if (testLead) {
    console.log('Lead ID:', testLead.id);
    console.log('Status:', testLead.status);
    console.log('AI Control State:', testLead.aiControlState);
    console.log('Company:', testLead.company?.name);
    console.log('Primary Contact:', testLead.primaryContact?.email);
    console.log('Conversations attached:', testLead.conversations.length);
    console.log('RestrictionChecks:', testLead.restrictionChecks);
    console.log('HumanReviews:', testLead.humanReviews);
    console.log('AIActions:', testLead.aiActions);
  } else {
    console.log('Lead d8df87c1-ef0d-4e65-b4ff-4e1cd1641695 not found!');
  }

  console.log('\n=== STEP 4: CHECKING ALL RECENT RESTRICTION CHECKS ===');
  const recentChecks = await prisma.restrictionCheck.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5,
  });
  console.log('Recent Restriction Checks:', JSON.stringify(recentChecks, null, 2));

  console.log('\n=== STEP 5: CHECKING ALL RECENT AUDIT EVENTS ===');
  const recentAudits = await prisma.auditEvent.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10,
  });
  recentAudits.forEach(a => {
    console.log(`[${a.createdAt.toISOString()}] Action: ${a.action}, Entity: ${a.entityType} ${a.entityId}, Actor: ${a.actorType} ${a.actorId}`);
    if (a.metadata) console.log('   Metadata:', JSON.stringify(a.metadata));
  });
}

main().finally(() => prisma.$disconnect());
