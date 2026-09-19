import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../../../apps/api/.env') });

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== REAL CURRENT DATABASE CONTENTS ===');
  
  const companies = await prisma.company.findMany({
    orderBy: { createdAt: 'desc' }
  });

  const leads = await prisma.lead.findMany({
    include: {
      company: true,
      primaryContact: true
    },
    orderBy: { createdAt: 'desc' }
  });

  console.log(`\n--- ALL COMPANIES (${companies.length} total) ---`);
  console.table(companies.map(c => ({
    id: c.id,
    name: c.name,
    domain: c.domain,
    industry: c.industry,
    createdAt: c.createdAt.toISOString()
  })));

  console.log(`\n--- ALL LEADS (${leads.length} total) ---`);
  console.table(leads.map(l => ({
    id: l.id,
    company: l.company?.name,
    domain: l.company?.domain,
    contact: l.primaryContact?.email,
    status: l.status,
    score: l.scoreTotal,
    createdAt: l.createdAt.toISOString()
  })));

  const statusDistribution: Record<string, number> = {};
  for (const l of leads) {
    statusDistribution[l.status] = (statusDistribution[l.status] || 0) + 1;
  }
  console.log('\n--- STATUS DISTRIBUTION ---');
  console.table(statusDistribution);

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
});
