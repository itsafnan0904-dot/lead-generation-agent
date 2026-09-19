import { PrismaClient } from '@prisma/client';

async function verifySchema() {
  const prisma = new PrismaClient();
  try {
    const columns = await prisma.$queryRawUnsafe(`
      SELECT table_name, column_name, data_type, udt_name 
      FROM information_schema.columns 
      WHERE table_name IN ('Lead', 'HumanReview', 'AuditEvent')
        AND column_name IN (
          'aiControlState', 
          'triggerSource', 
          'resolutionJustification', 
          'resolvedByUserId', 
          'restrictionCheckId',
          'messageId',
          'actorType', 
          'actorId', 
          'metadata'
        )
      ORDER BY table_name, column_name;
    `);
    console.log('--- INFORMATION_SCHEMA QUERY RESULTS ---');
    console.log(JSON.stringify(columns, null, 2));

    const enums = await prisma.$queryRawUnsafe(`
      SELECT typname, enumlabel 
      FROM pg_enum 
      JOIN pg_type ON pg_enum.enumtypid = pg_type.oid 
      WHERE typname IN ('AIControlState', 'HumanReviewTriggerSource')
      ORDER BY typname, enumsortorder;
    `);
    console.log('--- PG_ENUM QUERY RESULTS ---');
    console.log(JSON.stringify(enums, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

verifySchema();
