import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config({ path: path.resolve(process.cwd(), 'apps/api/.env') });

import { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';
import { google } from 'googleapis';

const prisma = new PrismaClient();

function decryptToken(encryptedString: string): string {
  const rawKey = process.env.GMAIL_TOKEN_ENCRYPTION_KEY || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  const key = Buffer.from(rawKey, 'hex');
  const [ivB64, tagB64, dataB64] = encryptedString.split(':');
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  let dec = decipher.update(dataB64, 'base64', 'utf8');
  dec += decipher.final('utf8');
  return dec;
}

async function main() {
  console.log('=== STEP 1: CURRENT STORED CREDENTIALS IN DATABASE ===');
  const activeAccount = await prisma.gmailAccount.findFirst({
    where: { isActive: true },
    include: { connectedByUser: true },
  });

  if (!activeAccount) {
    console.log('No active account found in DB!');
    return;
  }

  console.log('Active Account:', {
    id: activeAccount.id,
    email: activeAccount.email,
    isActive: activeAccount.isActive,
    connectedAt: activeAccount.createdAt,
    updatedAt: activeAccount.updatedAt,
    tokenExpiresAt: activeAccount.tokenExpiresAt,
  });

  const decryptedAccess = decryptToken(activeAccount.accessToken);
  const decryptedRefresh = decryptToken(activeAccount.refreshToken);

  console.log('Decrypted Access Token:', decryptedAccess);
  console.log('Decrypted Refresh Token:', decryptedRefresh);

  console.log('\n=== STEP 2: TEST REAL GMAIL API / REFRESH TOKEN CALL ===');
  const clientId = process.env.GMAIL_OAUTH_CLIENT_ID || '';
  const clientSecret = process.env.GMAIL_OAUTH_CLIENT_SECRET || '';
  const redirectUri = process.env.GMAIL_OAUTH_CALLBACK_URL || 'http://localhost:4000/gmail/oauth/callback';

  console.log('OAuth Client ID:', clientId ? `${clientId.substring(0, 15)}...` : '(empty)');
  console.log('OAuth Client Secret configured:', !!clientSecret);

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  oauth2Client.setCredentials({
    access_token: decryptedAccess,
    refresh_token: decryptedRefresh,
    expiry_date: activeAccount.tokenExpiresAt.getTime(),
  });

  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  try {
    console.log('\nAttempting real Google Gmail API call: gmail.users.getProfile({ userId: "me" })...');
    const profileRes = await gmail.users.getProfile({ userId: 'me' });
    console.log('Profile Result:', profileRes.data);
  } catch (err: any) {
    console.log('Profile call error:');
    console.log('Error Message:', err.message);
    if (err.response) {
      console.log('Status Code:', err.response.status);
      console.log('Response Data:', err.response.data);
    }
  }

  try {
    console.log('\nAttempting real Google Gmail API call: gmail.users.messages.list({ userId: "me", maxResults: 5 })...');
    const listRes = await gmail.users.messages.list({ userId: 'me', maxResults: 5 });
    console.log('Messages List Result:', {
      resultSizeEstimate: listRes.data.resultSizeEstimate,
      messagesCount: listRes.data.messages?.length || 0,
      nextPageToken: listRes.data.nextPageToken,
    });
  } catch (err: any) {
    console.log('Messages list error:');
    console.log('Error Message:', err.message);
    if (err.response) {
      console.log('Status Code:', err.response.status);
      console.log('Response Data:', err.response.data);
    }
  }

  try {
    console.log('\nAttempting real Token Refresh: oauth2Client.refreshAccessToken()...');
    const refreshRes = await oauth2Client.refreshAccessToken();
    console.log('Token Refresh Success:', {
      hasAccessToken: !!refreshRes.credentials.access_token,
      expiryDate: refreshRes.credentials.expiry_date,
    });
  } catch (err: any) {
    console.log('Token Refresh error:');
    console.log('Error Message:', err.message);
    if (err.response) {
      console.log('Status Code:', err.response.status);
      console.log('Response Data:', err.response.data);
    }
  }

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error('Test execution error:', e);
  await prisma.$disconnect();
});
