import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config({ path: path.resolve(process.cwd(), 'apps/api/.env') });

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const notifs = await prisma.notification.findMany({
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  console.log(`Found ${notifs.length} notifications:`);
  console.log(JSON.stringify(notifs, null, 2));

  const countByPriority = await prisma.notification.groupBy({
    by: ['priority', 'isRead'],
    _count: { id: true },
  });
  console.log('Counts:', countByPriority);

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
});
