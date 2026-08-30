import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ConfirmGoogleLinkDto } from './dto/confirm-google-link.dto';
import { AuthenticatedUser } from './decorators/current-user.decorator';
import { GoogleProfilePayload } from './strategies/google.strategy';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
}

export interface AuthResponse {
  user: AuthenticatedUser;
  tokens: AuthTokens;
}

export interface PendingGoogleLinkResponse {
  status: 'PENDING_LINK_CONFIRMATION';
  message: string;
  email: string;
  linkToken: string;
  expiresIn: string;
}

export type GoogleLoginResult = AuthResponse | PendingGoogleLinkResponse;

export interface GoogleLinkTokenPayload {
  sub: string; // existing userId
  email: string;
  googleId: string;
  purpose: 'google_account_linking';
  jti: string; // unique single-use token identifier
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly saltRounds = 12;
  private readonly accessSecret = process.env.JWT_ACCESS_SECRET || 'dev_jwt_access_secret_ai_sales_agent_2026';
  private readonly refreshSecret = process.env.JWT_REFRESH_SECRET || 'dev_jwt_refresh_secret_ai_sales_agent_2026';
  private readonly linkSecret = process.env.JWT_LINK_SECRET || process.env.JWT_ACCESS_SECRET || 'dev_jwt_link_secret_ai_sales_agent_2026';
  private readonly accessExpiresIn = process.env.JWT_ACCESS_EXPIRES_IN || '15m';
  private readonly refreshExpiresIn = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
  private readonly linkTokenExpiresIn = process.env.JWT_LINK_EXPIRES_IN || '10m';

  // Set of consumed link token JTIs for single-use enforcement
  private readonly usedLinkTokens = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponse> {
    const existing = await this.prisma.client.user.findUnique({
      where: { email: dto.email.toLowerCase().trim() },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException('An account with this email address already exists.');
    }

    const passwordHash = await bcrypt.hash(dto.password, this.saltRounds);

    const user = await this.prisma.client.user.create({
      data: {
        email: dto.email.toLowerCase().trim(),
        name: dto.name.trim(),
        passwordHash,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
      },
    });

    return this.issueAuthResponse(user);
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const user = await this.prisma.client.user.findUnique({
      where: { email: dto.email.toLowerCase().trim() },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        passwordHash: true,
        isActive: true,
      },
    });

    if (!user || !user.passwordHash || !user.isActive) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    const isMatch = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    return this.issueAuthResponse({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });
  }

  async handleGoogleLogin(profile: GoogleProfilePayload): Promise<GoogleLoginResult> {
    const email = profile.email.toLowerCase().trim();

    // CASE B: User with this exact googleId already exists
    const userByGoogleId = await this.prisma.client.user.findUnique({
      where: { googleId: profile.googleId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
      },
    });

    if (userByGoogleId) {
      if (!userByGoogleId.isActive) {
        throw new UnauthorizedException('User account has been deactivated.');
      }
      return this.issueAuthResponse({
        id: userByGoogleId.id,
        email: userByGoogleId.email,
        name: userByGoogleId.name,
        role: userByGoogleId.role,
      });
    }

    // Check if an existing account exists with this email
    const userByEmail = await this.prisma.client.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        passwordHash: true,
        googleId: true,
        isActive: true,
      },
    });

    // CASE C: Collision — account exists with password, but googleId is not attached
    if (userByEmail) {
      if (!userByEmail.isActive) {
        throw new UnauthorizedException('User account has been deactivated.');
      }

      // If already linked to another googleId (edge case), throw conflict
      if (userByEmail.googleId && userByEmail.googleId !== profile.googleId) {
        throw new ConflictException('This email is already linked to a different Google account.');
      }

      const jti = `${userByEmail.id}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const linkPayload: GoogleLinkTokenPayload = {
        sub: userByEmail.id,
        email: userByEmail.email,
        googleId: profile.googleId,
        purpose: 'google_account_linking',
        jti,
      };

      const linkToken = await this.jwtService.signAsync(linkPayload, {
        secret: this.linkSecret,
        expiresIn: this.linkTokenExpiresIn,
      });

      return {
        status: 'PENDING_LINK_CONFIRMATION',
        message: 'An existing password-protected account was found for this email address. Please confirm account linking by providing your password.',
        email: userByEmail.email,
        linkToken,
        expiresIn: this.linkTokenExpiresIn,
      };
    }

    // CASE A: Brand new user via Google OAuth
    const newUser = await this.prisma.client.user.create({
      data: {
        email,
        name: profile.name,
        googleId: profile.googleId,
        passwordHash: null,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
      },
    });

    return this.issueAuthResponse(newUser);
  }

  async confirmGoogleLink(dto: ConfirmGoogleLinkDto): Promise<AuthResponse> {
    let payload: GoogleLinkTokenPayload;
    try {
      payload = this.jwtService.verify(dto.linkToken, {
        secret: this.linkSecret,
      }) as GoogleLinkTokenPayload;
    } catch {
      throw new UnauthorizedException('Invalid or expired Google linking token.');
    }

    // Validate purpose claim to prevent token misuse
    if (payload.purpose !== 'google_account_linking' || !payload.jti || !payload.googleId) {
      throw new UnauthorizedException('Invalid token purpose or missing claims.');
    }

    // Enforce single-use token consumption
    if (this.usedLinkTokens.has(payload.jti)) {
      throw new UnauthorizedException('This link token has already been used.');
    }

    const user = await this.prisma.client.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        passwordHash: true,
        googleId: true,
        isActive: true,
      },
    });

    if (!user || !user.isActive || !user.passwordHash) {
      throw new UnauthorizedException('Account not found, inactive, or cannot be password-verified.');
    }

    const isMatch = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('Incorrect account password. Account linking rejected.');
    }

    // Check if another account took this googleId in the meantime
    const existingGoogle = await this.prisma.client.user.findUnique({
      where: { googleId: payload.googleId },
      select: { id: true },
    });

    if (existingGoogle && existingGoogle.id !== user.id) {
      throw new ConflictException('This Google account is already linked to another user profile.');
    }

    // Mark token as consumed
    this.usedLinkTokens.add(payload.jti);

    // Attach googleId to the user record
    const updatedUser = await this.prisma.client.user.update({
      where: { id: user.id },
      data: { googleId: payload.googleId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
      },
    });

    return this.issueAuthResponse(updatedUser);
  }

  async refresh(dto: RefreshTokenDto): Promise<AuthTokens> {
    let payload: any;
    try {
      payload = this.jwtService.verify(dto.refreshToken, {
        secret: this.refreshSecret,
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token.');
    }

    const user = await this.prisma.client.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        role: true,
        refreshTokenHash: true,
        isActive: true,
      },
    });

    if (!user || !user.isActive || !user.refreshTokenHash) {
      throw new UnauthorizedException('Access denied: session expired or user deactivated.');
    }

    const isMatch = await bcrypt.compare(dto.refreshToken, user.refreshTokenHash);
    if (!isMatch) {
      // Possible token reuse attack — invalidate stored token
      await this.prisma.client.user.update({
        where: { id: user.id },
        data: { refreshTokenHash: null },
      });
      throw new UnauthorizedException('Invalid refresh token.');
    }

    const tokens = await this.generateTokens(user.id, user.email, user.role);
    await this.updateRefreshTokenHash(user.id, tokens.refreshToken);

    return tokens;
  }

  async logout(userId: string): Promise<{ success: boolean }> {
    await this.prisma.client.user.update({
      where: { id: userId },
      data: { refreshTokenHash: null },
    });
    return { success: true };
  }

  async validateUserById(userId: string): Promise<AuthenticatedUser | null> {
    const user = await this.prisma.client.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
      },
    });

    if (!user || !user.isActive) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    };
  }

  private async issueAuthResponse(user: AuthenticatedUser): Promise<AuthResponse> {
    const tokens = await this.generateTokens(user.id, user.email, user.role);
    await this.updateRefreshTokenHash(user.id, tokens.refreshToken);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      tokens,
    };
  }

  private async generateTokens(userId: string, email: string, role: string): Promise<AuthTokens> {
    const payload = { sub: userId, email, role };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.accessSecret,
        expiresIn: this.accessExpiresIn,
      }),
      this.jwtService.signAsync(payload, {
        secret: this.refreshSecret,
        expiresIn: this.refreshExpiresIn,
      }),
    ]);

    return {
      accessToken,
      refreshToken,
      expiresIn: this.accessExpiresIn,
    };
  }

  private async updateRefreshTokenHash(userId: string, refreshToken: string): Promise<void> {
    const hash = await bcrypt.hash(refreshToken, 10);
    await this.prisma.client.user.update({
      where: { id: userId },
      data: { refreshTokenHash: hash },
    });
  }
}
