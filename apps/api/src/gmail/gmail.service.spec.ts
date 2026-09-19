import { Test, TestingModule } from '@nestjs/testing';
import { GmailService } from './gmail.service';
import { TokenEncryptionService } from './token-encryption.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { google } from 'googleapis';

jest.mock('googleapis');

describe('GmailService', () => {
  let gmailService: GmailService;
  let encryptionService: TokenEncryptionService;
  let prismaService: any;
  let auditService: any;

  const mockActiveAccount = {
    id: 'gmail-acc-uuid-111',
    email: 'sales@example.com',
    accessToken: '', // populated in beforeEach
    refreshToken: '', // populated in beforeEach
    tokenExpiresAt: new Date(Date.now() + 3600 * 1000), // 1 hr future
    scope: 'https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.readonly',
    isActive: true,
    connectedByUserId: 'user-123',
    createdAt: new Date(),
    updatedAt: new Date(),
    connectedByUser: {
      id: 'user-123',
      email: 'admin@example.com',
      name: 'Admin User',
    },
  };

  const mockOAuthClient: any = {
    generateAuthUrl: jest.fn(),
    getToken: jest.fn(),
    setCredentials: jest.fn(),
    refreshAccessToken: jest.fn(),
    revokeToken: jest.fn(),
  };

  const mockGmailClient: any = {
    users: {
      getProfile: jest.fn(),
      messages: {
        send: jest.fn(),
        list: jest.fn(),
        get: jest.fn(),
      },
      threads: {
        get: jest.fn(),
      },
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    encryptionService = new TokenEncryptionService();
    mockActiveAccount.accessToken = encryptionService.encrypt('mock_raw_access_token');
    mockActiveAccount.refreshToken = encryptionService.encrypt('mock_raw_refresh_token');

    prismaService = {
      client: {
        gmailAccount: {
          findFirst: jest.fn(),
          findUnique: jest.fn(),
          updateMany: jest.fn(),
          upsert: jest.fn(),
          update: jest.fn(),
        },
      },
    };

    auditService = {
      log: jest.fn().mockResolvedValue({ id: 'audit-gmail-1' }),
    };

    (google.auth.OAuth2 as unknown as jest.Mock).mockImplementation(() => mockOAuthClient);
    (google.gmail as unknown as jest.Mock).mockReturnValue(mockGmailClient);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GmailService,
        { provide: TokenEncryptionService, useValue: encryptionService },
        { provide: PrismaService, useValue: prismaService },
        { provide: AuditService, useValue: auditService },
      ],
    }).compile();

    gmailService = module.get<GmailService>(GmailService);
  });

  describe('OAuth Flow & One Active Connection Enforcement', () => {
    it('generates consent URL with offline access, prompt consent, and signed state', () => {
      mockOAuthClient.generateAuthUrl.mockReturnValue('https://accounts.google.com/o/oauth2/v2/auth?mock=url');

      const url = gmailService.getConsentUrl('user-admin-123');
      expect(url).toBe('https://accounts.google.com/o/oauth2/v2/auth?mock=url');
      expect(mockOAuthClient.generateAuthUrl).toHaveBeenCalledWith(
        expect.objectContaining({
          access_type: 'offline',
          prompt: 'consent',
          scope: [
            'https://www.googleapis.com/auth/gmail.send',
            'https://www.googleapis.com/auth/gmail.readonly',
          ],
          state: expect.stringMatching(/^[A-Za-z0-9_-]+\.[a-f0-9]+$/),
        }),
      );
    });

    it('handles OAuth callback with valid ADMIN state, exchanges code, encrypts tokens, deactivates prior active accounts, and upserts new active account', async () => {
      const statePayload = { userId: 'user-admin-uuid', issuedAt: Date.now() };
      const encodedPayload = Buffer.from(JSON.stringify(statePayload)).toString('base64url');
      const crypto = require('crypto');
      const signature = crypto
        .createHmac('sha256', process.env.GMAIL_OAUTH_CLIENT_SECRET || 'oauth_state_signing_secret')
        .update(encodedPayload)
        .digest('hex');
      const validAdminState = `${encodedPayload}.${signature}`;

      prismaService.client.user = {
        findUnique: jest.fn().mockResolvedValue({
          id: 'user-admin-uuid',
          role: 'ADMIN',
          isActive: true,
        }),
      };

      mockOAuthClient.getToken.mockResolvedValue({
        tokens: {
          access_token: 'new_google_access_token',
          refresh_token: 'new_google_refresh_token',
          expiry_date: Date.now() + 3600 * 1000,
          scope: 'https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.readonly',
        },
      });

      mockGmailClient.users.getProfile.mockResolvedValue({
        data: { emailAddress: 'shared-sales@company.com' },
      });

      prismaService.client.gmailAccount.updateMany.mockResolvedValue({ count: 1 });
      prismaService.client.gmailAccount.upsert.mockResolvedValue({
        ...mockActiveAccount,
        email: 'shared-sales@company.com',
        isActive: true,
      });

      const result = await gmailService.handleOAuthCallback('valid_oauth_code_123', validAdminState);

      expect(prismaService.client.gmailAccount.updateMany).toHaveBeenCalledWith({
        where: { isActive: true },
        data: { isActive: false },
      });
      expect(prismaService.client.gmailAccount.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { email: 'shared-sales@company.com' },
          update: expect.objectContaining({
            createdAt: expect.any(Date),
            isActive: true,
          }),
          create: expect.objectContaining({
            email: 'shared-sales@company.com',
            isActive: true,
            connectedByUserId: 'user-admin-uuid',
            createdAt: expect.any(Date),
          }),
        }),
      );
      expect(result.isConnected).toBe(true);
      expect(result.email).toBe('shared-sales@company.com');
      expect(result.healthStatus).toBe('HEALTHY');
      expect(result).not.toHaveProperty('accessToken');
      expect(result).not.toHaveProperty('refreshToken');
    });

    it('rejects OAuth callback if state is missing or tampered', async () => {
      await expect(
        gmailService.handleOAuthCallback('code_123', undefined),
      ).rejects.toThrow('Missing OAuth state parameter');

      await expect(
        gmailService.handleOAuthCallback('code_123', 'tampered.state'),
      ).rejects.toThrow();
    });

    it('rejects OAuth callback if initiating user is not an ADMIN', async () => {
      const statePayload = { userId: 'user-rep-uuid', issuedAt: Date.now() };
      const encodedPayload = Buffer.from(JSON.stringify(statePayload)).toString('base64url');
      const crypto = require('crypto');
      const signature = crypto
        .createHmac('sha256', process.env.GMAIL_OAUTH_CLIENT_SECRET || 'oauth_state_signing_secret')
        .update(encodedPayload)
        .digest('hex');
      const repState = `${encodedPayload}.${signature}`;

      prismaService.client.user = {
        findUnique: jest.fn().mockResolvedValue({
          id: 'user-rep-uuid',
          role: 'SALES_REP',
          isActive: true,
        }),
      };

      await expect(
        gmailService.handleOAuthCallback('code_123', repState),
      ).rejects.toThrow('Unauthorized OAuth callback: Gmail connection requires ADMIN role');
    });

    it('disconnect deactivates account and revokes token with Google', async () => {
      prismaService.client.gmailAccount.findFirst.mockResolvedValue(mockActiveAccount);
      prismaService.client.gmailAccount.update.mockResolvedValue({
        ...mockActiveAccount,
        isActive: false,
      });

      const result = await gmailService.disconnect();
      expect(result.success).toBe(true);
      expect(mockOAuthClient.revokeToken).toHaveBeenCalled();
      expect(prismaService.client.gmailAccount.update).toHaveBeenCalledWith({
        where: { id: mockActiveAccount.id },
        data: { isActive: false },
      });
    });
  });

  describe('Active Connection Health Verification (Systemic Safeguard)', () => {
    it('verifies a genuinely valid connection as HEALTHY by calling Google API profile endpoint', async () => {
      prismaService.client.gmailAccount.findFirst.mockResolvedValue(mockActiveAccount);
      mockGmailClient.users.getProfile.mockResolvedValue({
        data: { emailAddress: 'sales@example.com', messagesTotal: 120 },
      });

      const health = await gmailService.verifyConnectionHealth();

      expect(health.isConnected).toBe(true);
      expect(health.healthStatus).toBe('HEALTHY');
      expect(health.email).toBe('sales@example.com');
      expect(health.lastVerifiedAt).toBeInstanceOf(Date);
      expect(mockGmailClient.users.getProfile).toHaveBeenCalledWith({ userId: 'me' });
      expect(prismaService.client.gmailAccount.update).not.toHaveBeenCalled();
    });

    it('detects revoked refresh token (invalid_grant), deactivates account in database, logs audit event, and returns NEEDS_REAUTHENTICATION', async () => {
      prismaService.client.gmailAccount.findFirst.mockResolvedValue(mockActiveAccount);
      prismaService.client.gmailAccount.update.mockResolvedValue({
        ...mockActiveAccount,
        isActive: false,
      });

      const invalidGrantError = new Error('invalid_grant: Token has been expired or revoked.');
      (invalidGrantError as any).response = { data: { error: 'invalid_grant' } };
      mockGmailClient.users.getProfile.mockRejectedValue(invalidGrantError);

      const health = await gmailService.verifyConnectionHealth();

      expect(health.isConnected).toBe(false);
      expect(health.healthStatus).toBe('NEEDS_REAUTHENTICATION');
      expect(health.message).toContain('OAuth credentials revoked or expired');

      // Crucial requirement: Account must be deactivated in DB so false positive isActive:true is cleared
      expect(prismaService.client.gmailAccount.update).toHaveBeenCalledWith({
        where: { id: mockActiveAccount.id },
        data: { isActive: false },
      });

      // Audit event must be logged
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'GMAIL_ACCOUNT_DEACTIVATED_AUTH_FAILURE',
          entityId: mockActiveAccount.id,
          newState: expect.objectContaining({ isActive: false, reason: 'TOKEN_REVOKED_OR_EXPIRED' }),
        }),
      );
    });

    it('gracefully handles temporary Google API network timeout or error without deactivating database record', async () => {
      prismaService.client.gmailAccount.findFirst.mockResolvedValue(mockActiveAccount);

      const networkError = new Error('ETIMEDOUT: Connection to googleapis.com timed out');
      mockGmailClient.users.getProfile.mockRejectedValue(networkError);

      const health = await gmailService.verifyConnectionHealth();

      expect(health.isConnected).toBe(true);
      expect(health.healthStatus).toBe('UNREACHABLE');
      expect(health.message).toContain('Temporary network/API failure communicating with Google');

      // Must NOT deactivate account on transient network error
      expect(prismaService.client.gmailAccount.update).not.toHaveBeenCalled();
    });

    it('getStatus leverages cached health status within TTL window to avoid redundant Google API hits', async () => {
      prismaService.client.gmailAccount.findFirst.mockResolvedValue(mockActiveAccount);
      mockGmailClient.users.getProfile.mockResolvedValue({
        data: { emailAddress: 'sales@example.com' },
      });

      // First call runs live health check
      const status1 = await gmailService.getStatus();
      expect(status1.healthStatus).toBe('HEALTHY');
      expect(mockGmailClient.users.getProfile).toHaveBeenCalledTimes(1);

      // Second call within 3 minutes should use cache
      const status2 = await gmailService.getStatus();
      expect(status2.healthStatus).toBe('HEALTHY');
      expect(mockGmailClient.users.getProfile).toHaveBeenCalledTimes(1); // Not called again!

      // Force verify bypasses cache
      const status3 = await gmailService.getStatus({ forceVerify: true });
      expect(status3.healthStatus).toBe('HEALTHY');
      expect(mockGmailClient.users.getProfile).toHaveBeenCalledTimes(2); // Called again
    });

    it('getStatus returns disconnected status if no active account is in database', async () => {
      prismaService.client.gmailAccount.findFirst.mockResolvedValue(null);

      const status = await gmailService.getStatus();
      expect(status.isConnected).toBe(false);
      expect(status.healthStatus).toBe('DISCONNECTED');
    });
  });

  describe('Automatic Access Token Refresh Logic', () => {
    it('transparently triggers token refresh when access token is near expiry', async () => {
      const nearExpiryAccount = {
        ...mockActiveAccount,
        tokenExpiresAt: new Date(Date.now() + 30 * 1000),
      };
      prismaService.client.gmailAccount.findFirst.mockResolvedValue(nearExpiryAccount);

      mockOAuthClient.refreshAccessToken.mockResolvedValue({
        credentials: {
          access_token: 'brand_new_refreshed_access_token',
          expiry_date: Date.now() + 3600 * 1000,
        },
      });

      mockGmailClient.users.messages.send.mockResolvedValue({
        data: { id: 'msg-001', threadId: 'th-001' },
      });

      const res = await gmailService.sendEmail({
        to: 'lead@target.com',
        subject: 'Hello from AI Sales',
        bodyText: 'We help you scale sales.',
      });

      expect(mockOAuthClient.refreshAccessToken).toHaveBeenCalled();
      expect(prismaService.client.gmailAccount.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: nearExpiryAccount.id },
          data: expect.objectContaining({
            tokenExpiresAt: expect.any(Date),
          }),
        }),
      );
      expect(res.messageId).toBe('msg-001');
      expect(res.threadId).toBe('th-001');
    });

    it('auto-deactivates account if refreshAccessToken fails with invalid_grant during send', async () => {
      const nearExpiryAccount = {
        ...mockActiveAccount,
        tokenExpiresAt: new Date(Date.now() + 30 * 1000),
      };
      prismaService.client.gmailAccount.findFirst.mockResolvedValue(nearExpiryAccount);

      const refreshRevokedErr = new Error('invalid_grant: Bad Request');
      mockOAuthClient.refreshAccessToken.mockRejectedValue(refreshRevokedErr);

      await expect(
        gmailService.sendEmail({
          to: 'lead@target.com',
          subject: 'Hello',
          bodyText: 'Test',
        }),
      ).rejects.toThrow('Gmail authorization token is revoked or expired. Please reconnect the account in Settings.');

      expect(prismaService.client.gmailAccount.update).toHaveBeenCalledWith({
        where: { id: nearExpiryAccount.id },
        data: { isActive: false },
      });
    });
  });

  describe('GmailService API Methods', () => {
    beforeEach(() => {
      prismaService.client.gmailAccount.findFirst.mockResolvedValue(mockActiveAccount);
    });

    it('sendEmail sends base64url encoded MIME email and returns messageId & threadId', async () => {
      mockGmailClient.users.messages.send.mockResolvedValue({
        data: { id: 'sent-msg-999', threadId: 'sent-th-999' },
      });

      const result = await gmailService.sendEmail({
        to: 'customer@example.com',
        subject: 'Proposal',
        bodyHtml: '<p>Custom HTML proposal</p>',
      });

      expect(mockGmailClient.users.messages.send).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'me',
          requestBody: expect.objectContaining({
            raw: expect.any(String),
          }),
        }),
      );
      expect(result).toEqual({ messageId: 'sent-msg-999', threadId: 'sent-th-999' });
    });

    it('listMessages searches/lists messages matching a query', async () => {
      mockGmailClient.users.messages.list.mockResolvedValue({
        data: {
          messages: [
            { id: 'msg-1', threadId: 'th-1' },
            { id: 'msg-2', threadId: 'th-2' },
          ],
        },
      });

      const messages = await gmailService.listMessages('from:lead@example.com');
      expect(mockGmailClient.users.messages.list).toHaveBeenCalledWith({
        userId: 'me',
        q: 'from:lead@example.com',
        maxResults: 50,
      });
      expect(messages.length).toBe(2);
      expect(messages[0].id).toBe('msg-1');
    });

    it('getMessage retrieves and parses message headers, subject, and text body', async () => {
      mockGmailClient.users.messages.get.mockResolvedValue({
        data: {
          id: 'msg-101',
          threadId: 'th-101',
          payload: {
            headers: [
              { name: 'From', value: 'client@domain.com' },
              { name: 'To', value: 'sales@example.com' },
              { name: 'Subject', value: 'Inquiry response' },
              { name: 'Date', value: 'Sun, 30 Aug 2026 12:00:00 GMT' },
            ],
            mimeType: 'text/plain',
            body: {
              data: Buffer.from('Here are our project requirements.').toString('base64'),
            },
          },
          snippet: 'Here are our project requirements.',
        },
      });

      const msg = await gmailService.getMessage('msg-101');
      expect(msg.id).toBe('msg-101');
      expect(msg.from).toBe('client@domain.com');
      expect(msg.subject).toBe('Inquiry response');
      expect(msg.bodyText).toBe('Here are our project requirements.');
    });

    it('getThread retrieves all messages in a thread', async () => {
      mockGmailClient.users.threads.get.mockResolvedValue({
        data: {
          id: 'th-202',
          messages: [
            {
              id: 'msg-201',
              threadId: 'th-202',
              payload: {
                headers: [{ name: 'Subject', value: 'Thread intro' }],
              },
            },
          ],
        },
      });

      const thread = await gmailService.getThread('th-202');
      expect(thread.length).toBe(1);
      expect(thread[0].id).toBe('msg-201');
      expect(thread[0].subject).toBe('Thread intro');
    });
  });
});
