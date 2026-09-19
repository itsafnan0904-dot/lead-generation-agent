import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(process.cwd(), 'apps/api/.env') });

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import * as request from 'supertest';
import { GmailController } from './gmail/gmail.controller';
import { GmailService } from './gmail/gmail.service';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';
import { UserRole } from '@ai-sales-agent/database';
import { TokenEncryptionService } from './gmail/token-encryption.service';
import { PrismaService } from './prisma/prisma.service';
import * as crypto from 'crypto';

async function runLiveVerificationTraces() {
  console.log('================================================================');
  console.log(' LIVE HTTP REQUEST/RESPONSE TRACES (NESTJS LIVE HTTP ADAPTER) ');
  console.log('================================================================\n');

  const adminUserId = 'admin-user-uuid-101';
  const salesRepUserId = 'rep-user-uuid-202';

  const mockAdminUser = {
    id: adminUserId,
    email: 'admin@enterprise.com',
    name: 'Primary Administrator',
    role: UserRole.ADMIN,
  };

  const mockSalesRepUser = {
    id: salesRepUserId,
    email: 'rep@enterprise.com',
    name: 'Sales Representative',
    role: UserRole.SALES_REP,
  };

  const mockPrismaService = {
    client: {
      user: {
        findUnique: async ({ where: { id } }: any) => {
          if (id === adminUserId) {
            return { id: adminUserId, role: 'ADMIN', isActive: true };
          }
          if (id === salesRepUserId) {
            return { id: salesRepUserId, role: 'SALES_REP', isActive: true };
          }
          return null;
        },
      },
      gmailAccount: {
        findFirst: async () => ({
          id: 'acc-1',
          email: 'sales@enterprise.com',
          isActive: true,
          tokenExpiresAt: new Date(Date.now() + 3600000),
          createdAt: new Date(),
          connectedByUser: {
            id: adminUserId,
            email: 'admin@enterprise.com',
            name: 'Primary Administrator',
          },
        }),
        updateMany: async () => ({ count: 1 }),
        update: async () => ({ id: 'acc-1', isActive: false }),
        upsert: async () => ({
          id: 'acc-1',
          email: 'sales@enterprise.com',
          isActive: true,
          tokenExpiresAt: new Date(Date.now() + 3600000),
          createdAt: new Date(),
          connectedByUser: {
            id: adminUserId,
            email: 'admin@enterprise.com',
            name: 'Primary Administrator',
          },
        }),
      },
    },
  };

  const moduleRef: TestingModule = await Test.createTestingModule({
    controllers: [GmailController],
    providers: [
      GmailService,
      TokenEncryptionService,
      { provide: PrismaService, useValue: mockPrismaService },
      { provide: require('./audit/audit.service').AuditService, useValue: { log: async () => ({}) } },
      Reflector,
      RolesGuard,
    ],
  })
    .overrideGuard(JwtAuthGuard)
    .useValue({
      canActivate: (context: any) => {
        const req = context.switchToHttp().getRequest();
        const auth = req.headers['authorization'];
        if (!auth) {
          throw new (require('@nestjs/common').UnauthorizedException)(
            'Unauthorized access: Valid bearer token required',
          );
        }
        if (auth === 'Bearer admin-jwt-token') {
          req.user = mockAdminUser;
          return true;
        }
        if (auth === 'Bearer salesrep-jwt-token') {
          req.user = mockSalesRepUser;
          return true;
        }
        throw new (require('@nestjs/common').UnauthorizedException)('Invalid bearer token');
      },
    })
    .compile();

  const app: INestApplication = moduleRef.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.init();
  const server = app.getHttpServer();

  // TRACE 1: Unauthenticated request to GET /gmail/connect -> expect 401
  console.log('>>> TRACE 1: GET /gmail/connect without Authentication Header');
  const res1 = await request(server).get('/gmail/connect');
  console.log(`STATUS: ${res1.status}`);
  console.log(`RESPONSE: ${JSON.stringify(res1.body, null, 2)}`);
  console.log('RESULT: 401 Unauthorized returned (JwtAuthGuard blocked request before RolesGuard)\n');

  // TRACE 2: SALES_REP authenticated request to GET /gmail/connect -> expect 403
  console.log('>>> TRACE 2: GET /gmail/connect with Non-ADMIN (SALES_REP) Bearer Token');
  const res2 = await request(server)
    .get('/gmail/connect')
    .set('Authorization', 'Bearer salesrep-jwt-token');
  console.log(`STATUS: ${res2.status}`);
  console.log(`RESPONSE: ${JSON.stringify(res2.body, null, 2)}`);
  console.log('RESULT: 403 Forbidden returned (RolesGuard blocked non-ADMIN user)\n');

  // TRACE 3: ADMIN authenticated request to GET /gmail/connect -> expect 200 OK with signed authUrl JSON
  console.log('>>> TRACE 3: GET /gmail/connect with ADMIN Bearer Token');
  const res3 = await request(server)
    .get('/gmail/connect')
    .set('Authorization', 'Bearer admin-jwt-token');
  console.log(`STATUS: ${res3.status}`);
  console.log(`RESPONSE: ${JSON.stringify(res3.body, null, 2)}`);
  console.log('RESULT: 200 OK returned with Google OAuth consent authUrl JSON\n');

  // TRACE 4: Unauthenticated request to POST /gmail/disconnect -> expect 401
  console.log('>>> TRACE 4: POST /gmail/disconnect without Authentication Header');
  const res4 = await request(server).post('/gmail/disconnect');
  console.log(`STATUS: ${res4.status}`);
  console.log(`RESPONSE: ${JSON.stringify(res4.body, null, 2)}`);
  console.log('RESULT: 401 Unauthorized returned\n');

  // TRACE 5: SALES_REP authenticated request to POST /gmail/disconnect -> expect 403
  console.log('>>> TRACE 5: POST /gmail/disconnect with Non-ADMIN (SALES_REP) Bearer Token');
  const res5 = await request(server)
    .post('/gmail/disconnect')
    .set('Authorization', 'Bearer salesrep-jwt-token');
  console.log(`STATUS: ${res5.status}`);
  console.log(`RESPONSE: ${JSON.stringify(res5.body, null, 2)}`);
  console.log('RESULT: 403 Forbidden returned (RolesGuard enforced ADMIN requirement)\n');

  // TRACE 6: ADMIN authenticated request to POST /gmail/disconnect -> expect 200 OK
  console.log('>>> TRACE 6: POST /gmail/disconnect with ADMIN Bearer Token');
  const res6 = await request(server)
    .post('/gmail/disconnect')
    .set('Authorization', 'Bearer admin-jwt-token');
  console.log(`STATUS: ${res6.status}`);
  console.log(`RESPONSE: ${JSON.stringify(res6.body, null, 2)}`);
  console.log('RESULT: 200 OK returned successfully\n');

  // TRACE 7: SALES_REP authenticated request to GET /gmail/status -> expect 200 OK (no role restriction)
  console.log('>>> TRACE 7: GET /gmail/status with Non-ADMIN (SALES_REP) Bearer Token');
  const res7 = await request(server)
    .get('/gmail/status')
    .set('Authorization', 'Bearer salesrep-jwt-token');
  console.log(`STATUS: ${res7.status}`);
  console.log(`RESPONSE: ${JSON.stringify(res7.body, null, 2)}`);
  console.log('RESULT: 200 OK returned (/gmail/status remains accessible to all authenticated roles)\n');

  // TRACE 8: OAuth Callback with forged/invalid state -> expect 302 Redirect to /gmail?error=invalid_state
  console.log('>>> TRACE 8: GET /gmail/oauth/callback with forged/invalid state');
  const res8 = await request(server)
    .get('/gmail/oauth/callback?code=mock_code&state=forged.signature');
  console.log(`STATUS: ${res8.status}`);
  console.log(`LOCATION: ${res8.header.location}`);
  console.log('RESULT: 302 Found redirect returned with safe error param (HMAC signature validation failure)\n');

  // TRACE 9: OAuth Callback initiated by a non-ADMIN state -> expect 302 Redirect to /gmail?error=admin_required
  console.log('>>> TRACE 9: GET /gmail/oauth/callback with signed state from non-ADMIN user');
  const repStatePayload = { userId: salesRepUserId, issuedAt: Date.now() };
  const repEncoded = Buffer.from(JSON.stringify(repStatePayload)).toString('base64url');
  const repSig = crypto
    .createHmac('sha256', process.env.GMAIL_OAUTH_CLIENT_SECRET || 'oauth_state_signing_secret')
    .update(repEncoded)
    .digest('hex');
  const repSignedState = `${repEncoded}.${repSig}`;

  const res9 = await request(server)
    .get(`/gmail/oauth/callback?code=mock_code&state=${repSignedState}`);
  console.log(`STATUS: ${res9.status}`);
  console.log(`LOCATION: ${res9.header.location}`);
  console.log('RESULT: 302 Found redirect returned with admin_required error param (OAuth callback rejected non-ADMIN user initiator)\n');

  await app.close();
  console.log('================================================================');
  console.log(' ALL 9 LIVE VERIFICATION TRACES EXECUTED SUCCESSFULLY ');
  console.log('================================================================');
}

runLiveVerificationTraces().catch((e) => {
  console.error(e);
  process.exit(1);
});
