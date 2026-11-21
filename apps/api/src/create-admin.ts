/**
 * Creates (or, with --reset, re-passwords) an administrator account from environment variables. There is no
 * default account and no hard-coded password.
 *
 *   ADMIN_EMAIL=you@company.com ADMIN_PASSWORD='a long unique passphrase' npm run create-admin --workspace=apps/api
 *   (add --reset to change the password of an existing account)
 */
import 'reflect-metadata';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as bcrypt from 'bcrypt';
import { PrismaClient, UserRole } from '@ai-sales-agent/database';

for (const p of [path.resolve(process.cwd(), 'apps/api/.env'), path.resolve(process.cwd(), '.env')]) dotenv.config({ path: p });

const PASSWORD_RULE = /(?=.*[a-z])(?=.*[A-Z])(?=.*[\d\W])/;

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME?.trim() || 'Administrator';
  const reset = process.argv.includes('--reset');

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Set ADMIN_EMAIL to a valid email address.');
  if (!password || password.length < 12 || Buffer.byteLength(password) > 72 || !PASSWORD_RULE.test(password)) {
    throw new Error('Set ADMIN_PASSWORD to 12-72 characters with upper case, lower case and a number or symbol.');
  }

  const prisma = new PrismaClient();
  try {
    const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    const passwordHash = await bcrypt.hash(password, 12);

    if (existing && !reset) throw new Error(`An account for ${email} already exists. Re-run with --reset to change its password.`);
    if (existing) {
      await prisma.user.update({ where: { email }, data: { passwordHash, role: UserRole.ADMIN, isActive: true, refreshTokenHash: null } });
      console.log(`Reset the password for administrator ${email} and revoked its sessions.`);
    } else {
      await prisma.user.create({ data: { email, name, passwordHash, role: UserRole.ADMIN, isActive: true } });
      console.log(`Created administrator ${email}.`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
