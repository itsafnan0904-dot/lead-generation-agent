import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config({ path: path.resolve(process.cwd(), 'apps/api/.env') });

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const allNotifs = await prisma.notification.findMany({
    orderBy: { createdAt: 'desc' },
  });

  console.log(`Total notifications in DB: ${allNotifs.length}`);
  for (const n of allNotifs) {
    console.log(`- ID: ${n.id} | User: ${n.userId} | Priority: ${n.priority} | isRead: ${n.isRead} | EntityType: ${n.entityType} | EntityId: ${n.entityId} | Title: "${n.title}" | LeadIdMeta: ${n.metadata ? (n.metadata as any).leadId : 'none'}`);
  }

  const users = await prisma.user.findMany();
  console.log('\nUsers:');
  for (const u of users) {
    console.log(`- User: ${u.id} | Email: ${u.email} | Role: ${u.role}`);
  }

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
});
