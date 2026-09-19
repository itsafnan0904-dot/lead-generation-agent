import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config({ path: path.resolve(process.cwd(), 'apps/api/.env') });

import * as crypto from 'crypto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function encryptToken(plaintext: string): string {
  const rawKey = process.env.GMAIL_TOKEN_ENCRYPTION_KEY || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  const key = Buffer.from(rawKey, 'hex');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let enc = cipher.update(plaintext, 'utf8', 'base64');
  enc += cipher.final('base64');
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}:${tag.toString('base64')}:${enc}`;
}

async function main() {
  const admin = await prisma.user.findFirst({
    where: { role: 'ADMIN', email: 'admin@enterprise.com' },
  });
  if (!admin) throw new Error('admin user not found');

  const baselineTimestamp = new Date('2026-09-09T20:30:00.000Z');

  const existing = await prisma.gmailAccount.findUnique({
    where: { email: 'itsafnan0904@gmail.com' },
  });

  if (existing) {
    const updated = await prisma.gmailAccount.update({
      where: { id: existing.id },
      data: {
        isActive: true,
        connectedByUserId: admin.id,
        createdAt: baselineTimestamp,
        tokenExpiresAt: new Date(Date.now() + 24 * 3600 * 1000), // 24h in future
      },
      include: { connectedByUser: true },
    });
    console.log('Updated existing Gmail account to active baseline:');
    console.log(JSON.stringify(updated, null, 2));
  } else {
    const created = await prisma.gmailAccount.create({
      data: {
        email: 'itsafnan0904@gmail.com',
        accessToken: encryptToken('mock_access_token_itsafnan0904'),
        refreshToken: encryptToken('mock_refresh_token_itsafnan0904'),
        tokenExpiresAt: new Date(Date.now() + 24 * 3600 * 1000),
        scope: 'https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.readonly',
        isActive: true,
        connectedByUserId: admin.id,
        createdAt: baselineTimestamp,
      },
      include: { connectedByUser: true },
    });
    console.log('Created active baseline Gmail account:');
    console.log(JSON.stringify(created, null, 2));
  }

  await prisma.$disconnect();
}

main().catch(console.error);
