import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const actions = await prisma.aIAction.findMany({
    where: { actionType: 'ANALYZE_REPLY' },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });
  console.log(JSON.stringify(actions, null, 2));
}

main().finally(async () => {
  await prisma.$disconnect();
});
