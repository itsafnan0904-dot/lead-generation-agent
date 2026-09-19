import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const hash = await bcrypt.hash('Password123!', 12);
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
