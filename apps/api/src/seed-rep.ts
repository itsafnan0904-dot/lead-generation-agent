import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  if (!process.env.TEST_ADMIN_PASSWORD) throw new Error('Set TEST_ADMIN_PASSWORD (a throwaway password for this local test account).');
  const hash = await bcrypt.hash(process.env.TEST_ADMIN_PASSWORD, 12);
  const user = await prisma.user.upsert({
    where: { email: 'rep@enterprise.com' },
    update: { passwordHash: hash, isActive: true, role: 'SALES_REP' },
    create: { email: 'rep@enterprise.com', passwordHash: hash, name: 'Sales Representative', role: 'SALES_REP', isActive: true }
  });
  console.log('SALES_REP user ensured:', user.email, user.role);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
});
