const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const lead = await prisma.lead.findUnique({
    where: { id: 'd8df87c1-ef0d-4e65-b4ff-4e1cd1641695' },
    select: { id: true, status: true, aiControlState: true, scoreTotal: true, metadata: true, updatedAt: true }
  });
  console.log('LEAD RECORD:', JSON.stringify(lead, null, 2));
}

main().finally(() => prisma.$disconnect());
