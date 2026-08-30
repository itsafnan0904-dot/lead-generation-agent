import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { google, gmail_v1 } from 'googleapis';
import { PrismaService } from '../prisma/prisma.service';
import { TokenEncryptionService } from './token-encryption.service';


export interface SendEmailOptions {
  to: string;
  subject: string;
  bodyText?: string;
  bodyHtml?: string;
  threadId?: string;
  replyToMessageId?: string;
}

export interface SendEmailResult {
  messageId: string;
  threadId: string;
}

export interface GmailMessageHeader {
  name: string;
  value: string;
}

export interface GmailMessageMetadata {
  id: string;
  threadId: string;
  from?: string;
  to?: string;
  subject?: string;
  date?: string;
  snippet?: string;
  bodyText?: string;
  bodyHtml?: string;
  headers?: GmailMessageHeader[];
}

export interface GmailStatusResponse {
  isConnected: boolean;
  email?: string;
  tokenExpiresAt?: Date;
  isTokenExpired?: boolean;
  connectedByUser?: {
    id: string;
    email: string;
    name: string;
  } | null;
  connectedAt?: Date;
}

@Injectable()
export class GmailService {
  private readonly logger = new Logger(GmailService.name);
  private readonly clientId = process.env.GMAIL_OAUTH_CLIENT_ID || '';
  private readonly clientSecret = process.env.GMAIL_OAUTH_CLIENT_SECRET || '';
  private readonly redirectUri = process.env.GMAIL_OAUTH_CALLBACK_URL || 'http://localhost:4000/gmail/oauth/callback';
  private readonly scopes = [
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/gmail.readonly',
  ];

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryptionService: TokenEncryptionService,
  ) {}

  /**
   * Generates the Google OAuth consent URL for connecting the shared business Gmail account.
   * If userId is provided, generates a signed HMAC state parameter containing the userId and timestamp.
   */
  getConsentUrl(userId?: string): string {
    const oauth2Client = this.createOAuthClient();
    let state: string | undefined = undefined;

    if (userId) {
      const statePayload = {
        userId,
        issuedAt: Date.now(),
      };
      const jsonStr = JSON.stringify(statePayload);
      const encodedPayload = Buffer.from(jsonStr).toString('base64url');
      const signature = crypto
        .createHmac('sha256', this.clientSecret || 'oauth_state_signing_secret')
        .update(encodedPayload)
        .digest('hex');
      state = `${encodedPayload}.${signature}`;
    }

    return oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent', // Forces refresh_token return
      scope: this.scopes,
      state,
    });
  }

  /**
   * Validates the signed OAuth state and ensures the referenced user currently holds the ADMIN role.
   */
  async verifyAdminState(state?: string): Promise<string> {
    if (!state) {
      throw new BadRequestException('Missing OAuth state parameter: Callback must be initiated via /gmail/connect');
    }

    const parts = state.split('.');
    if (parts.length !== 2) {
      throw new BadRequestException('Invalid OAuth state format');
    }

    const [encodedPayload, providedSignature] = parts;
    const expectedSignature = crypto
      .createHmac('sha256', this.clientSecret || 'oauth_state_signing_secret')
      .update(encodedPayload)
      .digest('hex');

    const providedBuf = Buffer.from(providedSignature, 'hex');
    const expectedBuf = Buffer.from(expectedSignature, 'hex');

    if (providedBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(providedBuf, expectedBuf)) {
      throw new BadRequestException('Invalid or tampered OAuth state signature');
    }

    let payload: { userId: string; issuedAt: number };
    try {
      const jsonStr = Buffer.from(encodedPayload, 'base64url').toString('utf8');
      payload = JSON.parse(jsonStr);
    } catch {
      throw new BadRequestException('Malformed OAuth state payload');
    }

    if (!payload.userId || !payload.issuedAt) {
      throw new BadRequestException('Incomplete OAuth state payload');
    }

    // Reject state older than 15 minutes (OAuth flow expiry)
    const maxAgeMs = 15 * 60 * 1000;
    if (Date.now() - payload.issuedAt > maxAgeMs) {
      throw new BadRequestException('OAuth state has expired. Please initiate Gmail connection again.');
    }

    // Verify initiating user exists, is active, and currently has ADMIN role in DB
    const initiatingUser = await this.prisma.client.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, role: true, isActive: true },
    });

    if (!initiatingUser || !initiatingUser.isActive) {
      throw new BadRequestException('Initiating user account not found or deactivated');
    }

    if (initiatingUser.role !== 'ADMIN') {
      throw new BadRequestException('Unauthorized OAuth callback: Gmail connection requires ADMIN role');
    }

    return initiatingUser.id;
  }

  /**
   * Handles OAuth authorization code exchange, token encryption, and enforces the "one active connection" rule.
   * Ensures the OAuth state is verified and was initiated by an active ADMIN user.
   */
  async handleOAuthCallback(code: string, state?: string): Promise<GmailStatusResponse> {
    if (!code) {
      throw new BadRequestException('Missing authorization code from Google OAuth callback');
    }

    // Verify that this callback was initiated by a valid active ADMIN user via signed state
    const verifiedAdminUserId = await this.verifyAdminState(state);

    const oauth2Client = this.createOAuthClient();
    let tokens: any;

    try {
      const response = await oauth2Client.getToken(code);
      tokens = response.tokens;
    } catch (err: any) {
      this.logger.error(`Failed to exchange Gmail authorization code: ${err.message}`);
      throw new BadRequestException('Failed to exchange authorization code with Google OAuth');
    }

    if (!tokens.access_token) {
      throw new BadRequestException('Google did not return an access token');
    }

    oauth2Client.setCredentials(tokens);
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    let profile: any;
    try {
      const profileRes = await gmail.users.getProfile({ userId: 'me' });
      profile = profileRes.data;
    } catch (err: any) {
      this.logger.error(`Failed to fetch connected Gmail profile: ${err.message}`);
      throw new BadRequestException('Failed to retrieve Gmail profile information');
    }

    const connectedEmail = profile.emailAddress?.toLowerCase().trim();
    if (!connectedEmail) {
      throw new BadRequestException('Could not determine connected Gmail address');
    }

    // Encrypt tokens before DB storage
    const encryptedAccessToken = this.encryptionService.encrypt(tokens.access_token);
    
    // Fallback: If refresh_token is not returned on re-auth, try to retain existing encrypted refresh token
    let encryptedRefreshToken = '';
    if (tokens.refresh_token) {
      encryptedRefreshToken = this.encryptionService.encrypt(tokens.refresh_token);
    } else {
      const existingAccount = await this.prisma.client.gmailAccount.findUnique({
        where: { email: connectedEmail },
      });
      if (existingAccount?.refreshToken) {
        encryptedRefreshToken = existingAccount.refreshToken;
      } else {
        throw new BadRequestException('No refresh token received from Google. Please reconnect with full consent prompt.');
      }
    }

    const expiryDate = tokens.expiry_date
      ? new Date(tokens.expiry_date)
      : new Date(Date.now() + 3600 * 1000);

    // Enforce "one active connection": Deactivate all other active connections first
    await this.prisma.client.gmailAccount.updateMany({
      where: { isActive: true },
      data: { isActive: false },
    });

    // Upsert the connected account and mark it as the active connection
    const account = await this.prisma.client.gmailAccount.upsert({
      where: { email: connectedEmail },
      update: {
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        tokenExpiresAt: expiryDate,
        scope: tokens.scope || this.scopes.join(' '),
        isActive: true,
        connectedByUserId: verifiedAdminUserId,
      },
      create: {
        email: connectedEmail,
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        tokenExpiresAt: expiryDate,
        scope: tokens.scope || this.scopes.join(' '),
        isActive: true,
        connectedByUserId: verifiedAdminUserId,
      },
      include: {
        connectedByUser: {
          select: { id: true, email: true, name: true },
        },
      },
    });

    return {
      isConnected: true,
      email: account.email,
      tokenExpiresAt: account.tokenExpiresAt,
      isTokenExpired: account.tokenExpiresAt.getTime() <= Date.now(),
      connectedByUser: account.connectedByUser,
      connectedAt: account.createdAt,
    };
  }

  /**
   * Retrieves the current system connection status.
   */
  async getStatus(): Promise<GmailStatusResponse> {
    const activeAccount = await this.prisma.client.gmailAccount.findFirst({
      where: { isActive: true },
      include: {
        connectedByUser: {
          select: { id: true, email: true, name: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    if (!activeAccount) {
      return { isConnected: false };
    }

    return {
      isConnected: true,
      email: activeAccount.email,
      tokenExpiresAt: activeAccount.tokenExpiresAt,
      isTokenExpired: activeAccount.tokenExpiresAt.getTime() <= Date.now(),
      connectedByUser: activeAccount.connectedByUser,
      connectedAt: activeAccount.createdAt,
    };
  }

  /**
   * Disconnects the active Gmail connection and clears/deactivates the record.
   */
  async disconnect(): Promise<{ success: boolean; message: string }> {
    const activeAccount = await this.prisma.client.gmailAccount.findFirst({
      where: { isActive: true },
    });

    if (!activeAccount) {
      return { success: true, message: 'No active Gmail connection to disconnect' };
    }

    // Attempt token revocation with Google OAuth (best-effort)
    try {
      const refreshToken = this.encryptionService.decrypt(activeAccount.refreshToken);
      const oauth2Client = this.createOAuthClient();
      await oauth2Client.revokeToken(refreshToken);
    } catch (err: any) {
      this.logger.warn(`Could not revoke token with Google during disconnect: ${err.message}`);
    }

    await this.prisma.client.gmailAccount.update({
      where: { id: activeAccount.id },
      data: { isActive: false },
    });

    return { success: true, message: 'Gmail account disconnected successfully' };
  }

  /**
   * Sends an email via Gmail API using the active account's auto-refreshed access token.
   */
  async sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
    const gmail = await this.getAuthenticatedGmailClient();

    const rawMime = this.buildMimeMessage(options);
    const encodedMessage = Buffer.from(rawMime)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    try {
      const response = await gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: encodedMessage,
          threadId: options.threadId || undefined,
        },
      });

      const messageId = response.data.id;
      const threadId = response.data.threadId;

      if (!messageId || !threadId) {
        throw new Error('Gmail API did not return message or thread ID');
      }

      return { messageId, threadId };
    } catch (err: any) {
      this.logger.error(`Error sending email via Gmail API: ${err.message}`);
      throw new InternalServerErrorException(`Failed to send email: ${err.message}`);
    }
  }

  /**
   * Lists/searches messages in the connected Gmail mailbox.
   */
  async listMessages(query?: string, maxResults = 50): Promise<Array<{ id: string; threadId: string }>> {
    const gmail = await this.getAuthenticatedGmailClient();

    try {
      const response = await gmail.users.messages.list({
        userId: 'me',
        q: query,
        maxResults,
      });

      const messages = response.data.messages || [];
      return messages.map((m) => ({
        id: m.id || '',
        threadId: m.threadId || '',
      }));
    } catch (err: any) {
      this.logger.error(`Error listing Gmail messages: ${err.message}`);
      throw new InternalServerErrorException(`Failed to list messages: ${err.message}`);
    }
  }

  /**
   * Retrieves full details and body content of a single Gmail message.
   */
  async getMessage(messageId: string): Promise<GmailMessageMetadata> {
    const gmail = await this.getAuthenticatedGmailClient();

    try {
      const response = await gmail.users.messages.get({
        userId: 'me',
        id: messageId,
        format: 'full',
      });

      return this.parseGmailMessage(response.data);
    } catch (err: any) {
      this.logger.error(`Error fetching message ${messageId}: ${err.message}`);
      throw new NotFoundException(`Message with ID ${messageId} not found`);
    }
  }

  /**
   * Retrieves all messages in a Gmail thread.
   */
  async getThread(threadId: string): Promise<GmailMessageMetadata[]> {
    const gmail = await this.getAuthenticatedGmailClient();

    try {
      const response = await gmail.users.threads.get({
        userId: 'me',
        id: threadId,
        format: 'full',
      });

      const messages = response.data.messages || [];
      return messages.map((m) => this.parseGmailMessage(m));
    } catch (err: any) {
      this.logger.error(`Error fetching thread ${threadId}: ${err.message}`);
      throw new NotFoundException(`Thread with ID ${threadId} not found`);
    }
  }

  /**
   * Retrieves an authenticated google.gmail instance with guaranteed auto-refreshed access tokens.
   */
  private async getAuthenticatedGmailClient(): Promise<gmail_v1.Gmail> {
    const activeAccount = await this.prisma.client.gmailAccount.findFirst({
      where: { isActive: true },
    });

    if (!activeAccount) {
      throw new NotFoundException('No active Gmail account connected');
    }

    const decryptedAccessToken = this.encryptionService.decrypt(activeAccount.accessToken);
    const decryptedRefreshToken = this.encryptionService.decrypt(activeAccount.refreshToken);

    const oauth2Client = this.createOAuthClient();
    oauth2Client.setCredentials({
      access_token: decryptedAccessToken,
      refresh_token: decryptedRefreshToken,
      expiry_date: activeAccount.tokenExpiresAt.getTime(),
    });

    // Check if token is expired or expiring within 2 minutes
    const now = Date.now();
    const isNearExpiry = activeAccount.tokenExpiresAt.getTime() - now < 2 * 60 * 1000;

    if (isNearExpiry) {
      this.logger.log(`Refreshing expired/near-expiry access token for ${activeAccount.email}`);
      try {
        const refreshRes = await oauth2Client.refreshAccessToken();
        const newTokens = refreshRes.credentials;

        const newAccessToken = newTokens.access_token;
        if (newAccessToken) {
          const encryptedNewAccessToken = this.encryptionService.encrypt(newAccessToken);
          const newExpiryDate = newTokens.expiry_date
            ? new Date(newTokens.expiry_date)
            : new Date(Date.now() + 3600 * 1000);

          await this.prisma.client.gmailAccount.update({
            where: { id: activeAccount.id },
            data: {
              accessToken: encryptedNewAccessToken,
              tokenExpiresAt: newExpiryDate,
            },
          });
        }
      } catch (err: any) {
        this.logger.error(`Failed to automatically refresh Gmail access token: ${err.message}`);
        throw new InternalServerErrorException('Failed to refresh Gmail authorization token');
      }
    }

    return google.gmail({ version: 'v1', auth: oauth2Client });
  }

  private createOAuthClient() {
    return new google.auth.OAuth2(this.clientId, this.clientSecret, this.redirectUri);
  }

  private buildMimeMessage(options: SendEmailOptions): string {
    const lines: string[] = [
      `To: ${options.to}`,
      `Subject: ${options.subject}`,
      'MIME-Version: 1.0',
    ];

    if (options.replyToMessageId) {
      lines.push(`In-Reply-To: ${options.replyToMessageId}`);
      lines.push(`References: ${options.replyToMessageId}`);
    }

    if (options.bodyHtml) {
      lines.push('Content-Type: text/html; charset=utf-8');
      lines.push('');
      lines.push(options.bodyHtml);
    } else {
      lines.push('Content-Type: text/plain; charset=utf-8');
      lines.push('');
      lines.push(options.bodyText || '');
    }

    return lines.join('\r\n');
  }

  private parseGmailMessage(message: gmail_v1.Schema$Message): GmailMessageMetadata {
    const headers = message.payload?.headers || [];
    const getHeader = (name: string) =>
      headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value;

    let bodyText: string | undefined;
    let bodyHtml: string | undefined;

    const extractBody = (part: gmail_v1.Schema$MessagePart) => {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        bodyText = Buffer.from(part.body.data, 'base64').toString('utf8');
      } else if (part.mimeType === 'text/html' && part.body?.data) {
        bodyHtml = Buffer.from(part.body.data, 'base64').toString('utf8');
      }

      if (part.parts) {
        for (const subPart of part.parts) {
          extractBody(subPart);
        }
      }
    };

    if (message.payload) {
      extractBody(message.payload);
    }

    return {
      id: message.id || '',
      threadId: message.threadId || '',
      from: getHeader('From'),
      to: getHeader('To'),
      subject: getHeader('Subject'),
      date: getHeader('Date'),
      snippet: message.snippet || undefined,
      bodyText,
      bodyHtml,
      headers: headers.map((h) => ({ name: h.name || '', value: h.value || '' })),
    };
  }
}
