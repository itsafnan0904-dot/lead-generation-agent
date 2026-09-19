import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config({ path: path.resolve(process.cwd(), 'apps/api/.env') });

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const accounts = await prisma.gmailAccount.findMany({
    include: { connectedByUser: true },
  });
  console.log(`Found ${accounts.length} Gmail accounts in DB:`);
  console.log(JSON.stringify(accounts, null, 2));

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
});
