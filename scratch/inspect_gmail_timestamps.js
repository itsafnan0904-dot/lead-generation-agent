const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const accounts = await prisma.gmailAccount.findMany({
    include: { connectedByUser: true },
  });

  console.log('=== LIVE GMAIL_ACCOUNT RECORDS ===');
  accounts.forEach((acc, i) => {
    console.log(`\nAccount #${i + 1}:`);
    console.log(`  ID: ${acc.id}`);
    console.log(`  Email: ${acc.email}`);
    console.log(`  isActive: ${acc.isActive}`);
    console.log(`  createdAt: ${acc.createdAt.toISOString()}`);
    console.log(`  updatedAt: ${acc.updatedAt.toISOString()}`);
    console.log(`  connectedByUserId: ${acc.connectedByUserId} (${acc.connectedByUser?.name})`);
  });

  const audits = await prisma.auditEvent.findMany({
    where: { entityType: 'GMAIL_ACCOUNT' },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });

  console.log('\n=== RECENT GMAIL AUDIT EVENTS ===');
  audits.forEach(a => {
    console.log(`[${a.createdAt.toISOString()}] ${a.action} (Actor: ${a.actorType} ${a.actorId})`);
  });
}

main().finally(() => prisma.$disconnect());
