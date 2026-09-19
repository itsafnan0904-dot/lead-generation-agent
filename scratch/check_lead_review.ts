import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config({ path: path.resolve(process.cwd(), 'apps/api/.env') });

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const lead = await prisma.lead.findUnique({
    where: { id: '428c73eb-39f8-4806-8d88-fdff1815069d' },
    include: { company: true, primaryContact: true, humanReviews: true },
  });
  console.log('Lead 428c73eb:', JSON.stringify(lead, null, 2));

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
});
