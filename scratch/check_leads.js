const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const leads = await prisma.lead.findMany({
    select: {
      id: true,
      status: true,
      scoreTotal: true,
      company: { select: { name: true } }
    }
  });
  console.log('Total leads:', leads.length);
  const countByStatus = {};
  leads.forEach(l => {
    countByStatus[l.status] = (countByStatus[l.status] || 0) + 1;
  });
  console.log('Count by status:', JSON.stringify(countByStatus, null, 2));
}

main().finally(() => prisma.$disconnect());
