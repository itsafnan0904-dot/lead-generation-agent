import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole } from '@ai-sales-agent/database';

describe('AuthService', () => {
  let authService: AuthService;
  let prismaService: any;
  let jwtService: any;

  const mockUser = {
    id: 'test-user-uuid-1234',
    email: 'alex@example.com',
    name: 'Alex Mercer',
    googleId: null as string | null,
    role: UserRole.SALES_REP,
    isActive: true,
    passwordHash: '$2b$12$eX4mP1eH4sH3dPa55w0rdH4shValue1234567890abcdef',
    refreshTokenHash: '$2b$10$eX4mP1eR3fr3shH4shValue1234567890abcdef',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    prismaService = {
      client: {
        user: {
          findUnique: jest.fn(),
          create: jest.fn(),
          update: jest.fn(),
        },
      },
    };

    jwtService = {
      signAsync: jest.fn(),
      verify: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prismaService },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
  });

  describe('Registration Flow', () => {
    it('successfully registers a new user with hashed password and returns tokens', async () => {
      prismaService.client.user.findUnique.mockResolvedValue(null);
      prismaService.client.user.create.mockResolvedValue({
        id: mockUser.id,
        email: mockUser.email,
        name: mockUser.name,
        role: mockUser.role,
      });
      prismaService.client.user.update.mockResolvedValue(mockUser);

      jwtService.signAsync
        .mockResolvedValueOnce('mock_access_token_123')
        .mockResolvedValueOnce('mock_refresh_token_456');

      const result = await authService.register({
        email: 'alex@example.com',
        name: 'Alex Mercer',
        password: 'Password123!',
      });

      expect(prismaService.client.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'alex@example.com' },
        select: { id: true },
      });
      expect(prismaService.client.user.create).toHaveBeenCalled();
      expect(result.user.email).toBe('alex@example.com');
      expect(result.tokens.accessToken).toBe('mock_access_token_123');
      expect(result.tokens.refreshToken).toBe('mock_refresh_token_456');
    });

    it('rejects registration with a ConflictException if email already exists', async () => {
      prismaService.client.user.findUnique.mockResolvedValue({ id: 'existing-id' });

      await expect(
        authService.register({
          email: 'alex@example.com',
          name: 'Alex Mercer',
          password: 'Password123!',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('Login Flow', () => {
    it('successfully logs in with correct credentials', async () => {
      const plainPassword = 'Password123!';
      const realHash = await bcrypt.hash(plainPassword, 10);

      prismaService.client.user.findUnique.mockResolvedValue({
        ...mockUser,
        passwordHash: realHash,
      });
      prismaService.client.user.update.mockResolvedValue(mockUser);

      jwtService.signAsync
        .mockResolvedValueOnce('mock_access_token_123')
        .mockResolvedValueOnce('mock_refresh_token_456');

      const result = await authService.login({
        email: 'alex@example.com',
        password: plainPassword,
      });

      expect(result.user.email).toBe('alex@example.com');
      expect(result.tokens.accessToken).toBe('mock_access_token_123');
      expect(result.tokens.refreshToken).toBe('mock_refresh_token_456');
    });

    it('fails login with an UnauthorizedException when password is incorrect', async () => {
      const realHash = await bcrypt.hash('CorrectPassword123!', 10);

      prismaService.client.user.findUnique.mockResolvedValue({
        ...mockUser,
        passwordHash: realHash,
      });

      await expect(
        authService.login({
          email: 'alex@example.com',
          password: 'WrongPassword456!',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('fails login if user does not exist', async () => {
      prismaService.client.user.findUnique.mockResolvedValue(null);

      await expect(
        authService.login({
          email: 'nonexistent@example.com',
          password: 'Password123!',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('Google OAuth Flow', () => {
    const googleProfile = {
      googleId: 'google-sub-1092837465',
      email: 'claire@google.com',
      name: 'Claire Redfield',
    };

    it('Case A (New User): creates a user with googleId, no passwordHash, and returns normal tokens', async () => {
      // 1. By googleId -> null
      // 2. By email -> null
      prismaService.client.user.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      prismaService.client.user.create.mockResolvedValue({
        id: 'new-google-user-uuid',
        email: googleProfile.email,
        name: googleProfile.name,
        role: UserRole.SALES_REP,
      });
      prismaService.client.user.update.mockResolvedValue(mockUser);

      jwtService.signAsync
        .mockResolvedValueOnce('google_access_token_111')
        .mockResolvedValueOnce('google_refresh_token_222');

      const result = await authService.handleGoogleLogin(googleProfile);

      expect(prismaService.client.user.create).toHaveBeenCalledWith({
        data: {
          email: googleProfile.email,
          name: googleProfile.name,
          googleId: googleProfile.googleId,
          passwordHash: null,
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
        },
      });

      expect('tokens' in result).toBe(true);
      if ('tokens' in result) {
        expect(result.user.email).toBe(googleProfile.email);
        expect(result.tokens.accessToken).toBe('google_access_token_111');
        expect(result.tokens.refreshToken).toBe('google_refresh_token_222');
      }
    });

    it('Case B (Existing Google-linked User): logs in directly without creating a duplicate User', async () => {
      // By googleId -> exists
      prismaService.client.user.findUnique.mockResolvedValueOnce({
        id: 'existing-google-user-uuid',
        email: googleProfile.email,
        name: googleProfile.name,
        role: UserRole.SALES_REP,
        isActive: true,
      });
      prismaService.client.user.update.mockResolvedValue(mockUser);

      jwtService.signAsync
        .mockResolvedValueOnce('relogin_access_token_333')
        .mockResolvedValueOnce('relogin_refresh_token_444');

      const result = await authService.handleGoogleLogin(googleProfile);

      expect(prismaService.client.user.create).not.toHaveBeenCalled();
      expect('tokens' in result).toBe(true);
      if ('tokens' in result) {
        expect(result.user.id).toBe('existing-google-user-uuid');
        expect(result.tokens.accessToken).toBe('relogin_access_token_333');
      }
    });

    it('Case C (Collision): returns pending-link response with link token and NO access/refresh tokens', async () => {
      // 1. By googleId -> null
      // 2. By email -> exists with passwordHash and no googleId
      prismaService.client.user.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: 'existing-password-user-uuid',
          email: googleProfile.email,
          name: 'Existing Password User',
          role: UserRole.SALES_REP,
          passwordHash: '$2b$12$someValidHashedPassword',
          googleId: null,
          isActive: true,
        });

      jwtService.signAsync.mockResolvedValueOnce('signed_link_token_payload_xyz');

      const result = await authService.handleGoogleLogin(googleProfile);

      expect(prismaService.client.user.create).not.toHaveBeenCalled();
      expect('status' in result).toBe(true);
      if ('status' in result) {
        expect(result.status).toBe('PENDING_LINK_CONFIRMATION');
        expect(result.email).toBe(googleProfile.email);
        expect(result.linkToken).toBe('signed_link_token_payload_xyz');
        expect(result).not.toHaveProperty('tokens');
      }
    });
  });

  describe('Confirm Google Link Flow', () => {
    const rawPassword = 'Password123!';
    let hashedPassword: string;

    beforeEach(async () => {
      hashedPassword = await bcrypt.hash(rawPassword, 10);
    });

    it('POST /auth/google/confirm-link with correct password successfully links googleId and issues tokens', async () => {
      const linkPayload = {
        sub: 'user-to-link-uuid',
        email: 'linkme@example.com',
        googleId: 'google-sub-linked-777',
        purpose: 'google_account_linking',
        jti: 'unique_jti_test_1',
      };

      jwtService.verify.mockReturnValue(linkPayload);

      // 1. find user by sub
      // 2. find unique by googleId (check not taken by another user)
      prismaService.client.user.findUnique
        .mockResolvedValueOnce({
          id: 'user-to-link-uuid',
          email: 'linkme@example.com',
          name: 'Link Me',
          role: UserRole.SALES_REP,
          passwordHash: hashedPassword,
          googleId: null,
          isActive: true,
        })
        .mockResolvedValueOnce(null); // googleId not taken

      prismaService.client.user.update
        .mockResolvedValueOnce({
          id: 'user-to-link-uuid',
          email: 'linkme@example.com',
          name: 'Link Me',
          role: UserRole.SALES_REP,
        })
        .mockResolvedValueOnce(mockUser); // refresh token update

      jwtService.signAsync
        .mockResolvedValueOnce('linked_access_token_888')
        .mockResolvedValueOnce('linked_refresh_token_999');

      const result = await authService.confirmGoogleLink({
        linkToken: 'valid_link_token_str',
        password: rawPassword,
      });

      expect(prismaService.client.user.update).toHaveBeenCalledWith({
        where: { id: 'user-to-link-uuid' },
        data: { googleId: 'google-sub-linked-777' },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
        },
      });

      expect(result.tokens.accessToken).toBe('linked_access_token_888');
      expect(result.tokens.refreshToken).toBe('linked_refresh_token_999');
    });

    it('POST /auth/google/confirm-link with incorrect password rejects and does not link account', async () => {
      const linkPayload = {
        sub: 'user-to-link-uuid',
        email: 'linkme@example.com',
        googleId: 'google-sub-linked-777',
        purpose: 'google_account_linking',
        jti: 'unique_jti_test_2',
      };

      jwtService.verify.mockReturnValue(linkPayload);

      prismaService.client.user.findUnique.mockResolvedValueOnce({
        id: 'user-to-link-uuid',
        email: 'linkme@example.com',
        name: 'Link Me',
        role: UserRole.SALES_REP,
        passwordHash: hashedPassword,
        googleId: null,
        isActive: true,
      });

      await expect(
        authService.confirmGoogleLink({
          linkToken: 'valid_link_token_str',
          password: 'IncorrectPassword999!',
        }),
      ).rejects.toThrow(UnauthorizedException);

      expect(prismaService.client.user.update).not.toHaveBeenCalled();
    });

    it('POST /auth/google/confirm-link with an expired/invalid or already-used link token is rejected', async () => {
      // 1. Invalid / expired JWT
      jwtService.verify.mockImplementationOnce(() => {
        throw new Error('jwt expired');
      });

      await expect(
        authService.confirmGoogleLink({
          linkToken: 'expired_link_token',
          password: rawPassword,
        }),
      ).rejects.toThrow(UnauthorizedException);

      // 2. Already used link token (re-consumption test)
      const reusableJti = 'single_use_jti_test_3';
      const linkPayload = {
        sub: 'user-to-link-uuid',
        email: 'linkme@example.com',
        googleId: 'google-sub-linked-777',
        purpose: 'google_account_linking',
        jti: reusableJti,
      };

      jwtService.verify.mockReturnValue(linkPayload);

      prismaService.client.user.findUnique
        .mockResolvedValueOnce({
          id: 'user-to-link-uuid',
          email: 'linkme@example.com',
          name: 'Link Me',
          role: UserRole.SALES_REP,
          passwordHash: hashedPassword,
          googleId: null,
          isActive: true,
        })
        .mockResolvedValueOnce(null);

      prismaService.client.user.update
        .mockResolvedValueOnce({
          id: 'user-to-link-uuid',
          email: 'linkme@example.com',
          name: 'Link Me',
          role: UserRole.SALES_REP,
        })
        .mockResolvedValueOnce(mockUser);

      jwtService.signAsync
        .mockResolvedValueOnce('acc1')
        .mockResolvedValueOnce('ref1');

      // First use succeeds
      await authService.confirmGoogleLink({
        linkToken: 'valid_token_first_try',
        password: rawPassword,
      });

      // Second use with identical JTI must be rejected as already used
      jwtService.verify.mockReturnValue(linkPayload);
      await expect(
        authService.confirmGoogleLink({
          linkToken: 'replayed_token',
          password: rawPassword,
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('allows user to log in via EITHER original password OR Google after linking', async () => {
      // 1. Login with password succeeds
      prismaService.client.user.findUnique.mockResolvedValueOnce({
        ...mockUser,
        passwordHash: hashedPassword,
        googleId: 'google-sub-linked-777',
      });
      prismaService.client.user.update.mockResolvedValue(mockUser);

      jwtService.signAsync
        .mockResolvedValueOnce('pw_access_token')
        .mockResolvedValueOnce('pw_refresh_token');

      const passwordLoginResult = await authService.login({
        email: mockUser.email,
        password: rawPassword,
      });
      expect(passwordLoginResult.tokens.accessToken).toBe('pw_access_token');

      // 2. Login via Google OAuth succeeds
      prismaService.client.user.findUnique.mockResolvedValueOnce({
        id: mockUser.id,
        email: mockUser.email,
        name: mockUser.name,
        role: mockUser.role,
        googleId: 'google-sub-linked-777',
        isActive: true,
      });

      jwtService.signAsync
        .mockResolvedValueOnce('google_access_token')
        .mockResolvedValueOnce('google_refresh_token');

      const googleLoginResult = await authService.handleGoogleLogin({
        googleId: 'google-sub-linked-777',
        email: mockUser.email,
        name: mockUser.name,
      });

      expect('tokens' in googleLoginResult).toBe(true);
      if ('tokens' in googleLoginResult) {
        expect(googleLoginResult.tokens.accessToken).toBe('google_access_token');
      }
    });
  });

  describe('Refresh Token Flow', () => {
    it('successfully exchanges a valid refresh token for new tokens', async () => {
      const plainRefreshToken = 'valid_refresh_token_string';
      const refreshHash = await bcrypt.hash(plainRefreshToken, 10);

      jwtService.verify.mockReturnValue({
        sub: mockUser.id,
        email: mockUser.email,
        role: mockUser.role,
      });

      prismaService.client.user.findUnique.mockResolvedValue({
        id: mockUser.id,
        email: mockUser.email,
        role: mockUser.role,
        refreshTokenHash: refreshHash,
        isActive: true,
      });
      prismaService.client.user.update.mockResolvedValue(mockUser);

      jwtService.signAsync
        .mockResolvedValueOnce('new_access_token_789')
        .mockResolvedValueOnce('new_refresh_token_012');

      const result = await authService.refresh({ refreshToken: plainRefreshToken });

      expect(result.accessToken).toBe('new_access_token_789');
      expect(result.refreshToken).toBe('new_refresh_token_012');
    });

    it('rejects refresh when token is invalid or expired', async () => {
      jwtService.verify.mockImplementation(() => {
        throw new Error('jwt expired');
      });

      await expect(
        authService.refresh({ refreshToken: 'expired_token' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('invalidates stored refresh token and rejects if token hash mismatch is detected', async () => {
      const storedHash = await bcrypt.hash('different_token', 10);

      jwtService.verify.mockReturnValue({
        sub: mockUser.id,
        email: mockUser.email,
        role: mockUser.role,
      });

      prismaService.client.user.findUnique.mockResolvedValue({
        id: mockUser.id,
        email: mockUser.email,
        role: mockUser.role,
        refreshTokenHash: storedHash,
        isActive: true,
      });
      prismaService.client.user.update.mockResolvedValue(mockUser);

      await expect(
        authService.refresh({ refreshToken: 'replayed_compromised_token' }),
      ).rejects.toThrow(UnauthorizedException);

      expect(prismaService.client.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: { refreshTokenHash: null },
      });
    });
  });

  describe('Logout Flow', () => {
    it('successfully clears the refresh token hash on logout', async () => {
      prismaService.client.user.update.mockResolvedValue({
        ...mockUser,
        refreshTokenHash: null,
      });

      const result = await authService.logout(mockUser.id);
      expect(result).toEqual({ success: true });
      expect(prismaService.client.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: { refreshTokenHash: null },
      });
    });
  });
});
