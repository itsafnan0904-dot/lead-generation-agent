import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config({ path: path.resolve(process.cwd(), 'apps/api/.env') });

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const rows: any = await prisma.$queryRawUnsafe(`SELECT * FROM "GmailAccount"`);
  console.log('Raw query from "GmailAccount":', rows);

  const tables: any = await prisma.$queryRawUnsafe(`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`);
  console.log('Public tables:', tables.map((t: any) => t.tablename));

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
});
