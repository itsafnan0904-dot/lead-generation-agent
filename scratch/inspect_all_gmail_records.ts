import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config({ path: path.resolve(process.cwd(), 'apps/api/.env') });

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const allAccounts = await prisma.gmailAccount.findMany({
    include: { connectedByUser: true },
  });
  console.log(`Total Gmail accounts in DB: ${allAccounts.length}`);
  for (const a of allAccounts) {
    console.log({
      id: a.id,
      email: a.email,
      isActive: a.isActive,
      connectedAt: a.createdAt,
      updatedAt: a.updatedAt,
      tokenExpiresAt: a.tokenExpiresAt,
      connectedByUser: a.connectedByUser ? { id: a.connectedByUser.id, email: a.connectedByUser.email } : null,
    });
  }

  // Also check AuditEvent for any GMAIL events
  const auditEvents = await prisma.auditEvent.findMany({
    where: { entityType: 'GMAIL_ACCOUNT' },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });
  console.log(`\nAudit events for GMAIL_ACCOUNT (${auditEvents.length}):`);
  for (const e of auditEvents) {
    console.log({
      id: e.id,
      action: e.action,
      createdAt: e.createdAt,
      metadata: e.metadata,
      oldState: e.oldState,
      newState: e.newState,
    });
  }

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
});
