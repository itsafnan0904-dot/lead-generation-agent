import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import * as request from 'supertest';
import { GmailController } from './gmail.controller';
import { GmailService } from './gmail.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '@ai-sales-agent/database';

describe('GmailController RBAC & OAuth Callback Security (e2e/controller tests)', () => {
  let app: INestApplication;
  let gmailService: any;

  const mockAdminUser = {
    id: 'user-admin-uuid-1',
    email: 'admin@company.com',
    name: 'Admin User',
    role: UserRole.ADMIN,
  };

  const mockSalesRepUser = {
    id: 'user-salesrep-uuid-2',
    email: 'rep@company.com',
    name: 'Sales Rep User',
    role: UserRole.SALES_REP,
  };

  beforeAll(async () => {
    gmailService = {
      getConsentUrl: jest.fn(),
      handleOAuthCallback: jest.fn(),
      getStatus: jest.fn(),
      disconnect: jest.fn(),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [GmailController],
      providers: [
        {
          provide: GmailService,
          useValue: gmailService,
        },
        Reflector,
        RolesGuard,
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: any) => {
          const req = context.switchToHttp().getRequest();
          const authHeader = req.headers['authorization'];
          if (authHeader === 'Bearer admin.access.jwt') {
            req.user = mockAdminUser;
            return true;
          }
          if (authHeader === 'Bearer salesrep.access.jwt') {
            req.user = mockSalesRepUser;
            return true;
          }
          // Unauthenticated requests throw 401 UnauthorizedException as JwtAuthGuard does
          throw new UnauthorizedException('Unauthorized access: Valid bearer token required');
        },
      })
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /gmail/connect (ADMIN only)', () => {
    it('allows an ADMIN user to successfully initiate connect and returns consent authUrl JSON', async () => {
      gmailService.getConsentUrl.mockReturnValue(
        'https://accounts.google.com/o/oauth2/v2/auth?client_id=test&state=signed_state_token',
      );

      const res = await request(app.getHttpServer())
        .get('/gmail/connect')
        .set('Authorization', 'Bearer admin.access.jwt')
        .expect(200);

      expect(res.body.authUrl).toBe(
        'https://accounts.google.com/o/oauth2/v2/auth?client_id=test&state=signed_state_token',
      );
      expect(gmailService.getConsentUrl).toHaveBeenCalledWith(mockAdminUser.id);
    });

    it('rejects a non-ADMIN (SALES_REP) authenticated user with 403 Forbidden', async () => {
      const res = await request(app.getHttpServer())
        .get('/gmail/connect')
        .set('Authorization', 'Bearer salesrep.access.jwt')
        .expect(403);

      expect(res.body.message).toContain("Requires one of [ADMIN], current role is 'SALES_REP'");
    });

    it('rejects an unauthenticated request with 401 Unauthorized (proving JwtAuthGuard runs before RolesGuard)', async () => {
      const res = await request(app.getHttpServer())
        .get('/gmail/connect')
        .expect(401);

      expect(res.body.message).toContain('Unauthorized access: Valid bearer token required');
    });
  });

  describe('POST /gmail/disconnect (ADMIN only)', () => {
    it('allows an ADMIN user to successfully disconnect the Gmail account', async () => {
      gmailService.disconnect.mockResolvedValue({
        success: true,
        message: 'Gmail account disconnected successfully',
      });

      const res = await request(app.getHttpServer())
        .post('/gmail/disconnect')
        .set('Authorization', 'Bearer admin.access.jwt')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(gmailService.disconnect).toHaveBeenCalled();
    });

    it('rejects a non-ADMIN (SALES_REP) authenticated user with 403 Forbidden', async () => {
      const res = await request(app.getHttpServer())
        .post('/gmail/disconnect')
        .set('Authorization', 'Bearer salesrep.access.jwt')
        .expect(403);

      expect(res.body.message).toContain("Requires one of [ADMIN], current role is 'SALES_REP'");
    });

    it('rejects an unauthenticated request with 401 Unauthorized (proving JwtAuthGuard runs before RolesGuard)', async () => {
      const res = await request(app.getHttpServer())
        .post('/gmail/disconnect')
        .expect(401);

      expect(res.body.message).toContain('Unauthorized access: Valid bearer token required');
    });
  });

  describe('GET /gmail/status (All Authenticated Users)', () => {
    it('allows an ADMIN user to retrieve status', async () => {
      gmailService.getStatus.mockResolvedValue({
        isConnected: true,
        email: 'shared@company.com',
        healthStatus: 'HEALTHY',
        isTokenExpired: false,
      });

      const res = await request(app.getHttpServer())
        .get('/gmail/status')
        .set('Authorization', 'Bearer admin.access.jwt')
        .expect(200);

      expect(res.body.isConnected).toBe(true);
      expect(res.body.email).toBe('shared@company.com');
      expect(gmailService.getStatus).toHaveBeenCalledWith({ forceVerify: false });
    });

    it('passes forceVerify: true to service when ?force=true query parameter is supplied', async () => {
      gmailService.getStatus.mockResolvedValue({
        isConnected: true,
        email: 'shared@company.com',
        healthStatus: 'HEALTHY',
        isTokenExpired: false,
      });

      const res = await request(app.getHttpServer())
        .get('/gmail/status?force=true')
        .set('Authorization', 'Bearer admin.access.jwt')
        .expect(200);

      expect(res.body.isConnected).toBe(true);
      expect(gmailService.getStatus).toHaveBeenCalledWith({ forceVerify: true });
    });

    it('allows a non-ADMIN (SALES_REP) authenticated user to retrieve status (no role restriction)', async () => {
      gmailService.getStatus.mockResolvedValue({
        isConnected: true,
        email: 'shared@company.com',
        healthStatus: 'HEALTHY',
        isTokenExpired: false,
      });

      const res = await request(app.getHttpServer())
        .get('/gmail/status')
        .set('Authorization', 'Bearer salesrep.access.jwt')
        .expect(200);

      expect(res.body.isConnected).toBe(true);
      expect(res.body.email).toBe('shared@company.com');
    });

    it('rejects unauthenticated request to /gmail/status with 401 Unauthorized', async () => {
      const res = await request(app.getHttpServer())
        .get('/gmail/status')
        .expect(401);

      expect(res.body.message).toContain('Unauthorized access: Valid bearer token required');
    });
  });

  describe('GET /gmail/oauth/callback (Google Redirect & Signed State Validation)', () => {
    it('successfully processes callback when state traces back to valid ADMIN-initiated connect flow and redirects with connected=true', async () => {
      gmailService.handleOAuthCallback.mockResolvedValue({
        isConnected: true,
        email: 'shared-sales@company.com',
        tokenExpiresAt: new Date(),
        isTokenExpired: false,
      });

      const res = await request(app.getHttpServer())
        .get('/gmail/oauth/callback?code=valid_auth_code&state=valid_signed_admin_state')
        .expect(302);

      expect(res.header.location).toBe('http://localhost:3000/gmail?connected=true');
      expect(gmailService.handleOAuthCallback).toHaveBeenCalledWith(
        'valid_auth_code',
        'valid_signed_admin_state',
      );
    });

    it('redirects with safe error reason when handleOAuthCallback rejects non-ADMIN or invalid state', async () => {
      gmailService.handleOAuthCallback.mockRejectedValue(
        new ForbiddenException('Unauthorized OAuth callback: Gmail connection requires ADMIN role'),
      );

      const res = await request(app.getHttpServer())
        .get('/gmail/oauth/callback?code=valid_auth_code&state=forged_or_rep_state')
        .expect(302);

      expect(res.header.location).toBe('http://localhost:3000/gmail?error=admin_required');
    });
  });
});
