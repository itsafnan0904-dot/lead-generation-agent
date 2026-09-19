import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const latestAiActions = await prisma.aIAction.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10
  });

  console.log('=== LATEST AI ACTIONS LOGGED ===');
  for (const action of latestAiActions) {
    console.log({
      id: action.id,
      actionType: action.actionType,
      modelUsed: action.modelUsed,
      tokenUsage: action.tokenUsage,
      latencyMs: action.latencyMs,
      status: action.status,
      createdAt: action.createdAt
    });
  }

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
});
