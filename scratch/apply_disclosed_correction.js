const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('=== APPLYING DISCLOSED CORRECTION TO LIVE RECORD ===\n');

  // Find latest GMAIL_ACCOUNT_CONNECTED audit event
  const latestConnectEvent = await prisma.auditEvent.findFirst({
    where: {
      entityType: 'GMAIL_ACCOUNT',
      action: 'GMAIL_ACCOUNT_CONNECTED',
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!latestConnectEvent) {
    throw new Error('No GMAIL_ACCOUNT_CONNECTED audit event found.');
  }

  const realConnectionTime = latestConnectEvent.createdAt;
  console.log(`Found genuine reconnection audit event from: ${realConnectionTime.toISOString()}`);

  const activeAccount = await prisma.gmailAccount.findFirst({
    where: { isActive: true },
  });

  if (!activeAccount) {
    throw new Error('No active Gmail account found.');
  }

  console.log(`Current active account: ${activeAccount.email}`);
  console.log(`Previous createdAt: ${activeAccount.createdAt.toISOString()}`);

  const updated = await prisma.gmailAccount.update({
    where: { id: activeAccount.id },
    data: {
      createdAt: realConnectionTime,
    },
  });

  console.log(`Corrected createdAt (connectedAt): ${updated.createdAt.toISOString()}`);
  console.log('\n=== DISCLOSED CORRECTION APPLIED ===');
}

main().finally(() => prisma.$disconnect());
