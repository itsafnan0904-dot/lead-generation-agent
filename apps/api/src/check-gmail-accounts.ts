import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const accounts = await prisma.gmailAccount.findMany();
  console.log('GMAIL_ACCOUNTS:', JSON.stringify(accounts, null, 2));
}

main().finally(async () => {
  await prisma.$disconnect();
});
