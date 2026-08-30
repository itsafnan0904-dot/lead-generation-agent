import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  AuthService,
  AuthResponse,
  AuthTokens,
  GoogleLoginResult,
} from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ConfirmGoogleLinkDto } from './dto/confirm-google-link.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import { CurrentUser, AuthenticatedUser } from './decorators/current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() dto: RegisterDto): Promise<AuthResponse> {
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto): Promise<AuthResponse> {
    return this.authService.login(dto);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() dto: RefreshTokenDto): Promise<AuthTokens> {
    return this.authService.refresh(dto);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async logout(@CurrentUser() user: AuthenticatedUser): Promise<{ success: boolean }> {
    return this.authService.logout(user.id);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMe(@CurrentUser() user: AuthenticatedUser): Promise<{ user: AuthenticatedUser }> {
    return { user };
  }

  /**
   * Initiates Google OAuth flow by redirecting user to Google's consent screen.
   */
  @Get('google')
  @UseGuards(GoogleAuthGuard)
  async googleAuth(): Promise<void> {
    // Handled automatically by Passport Google strategy redirect
  }

  /**
   * Handles Google OAuth callback redirect.
   * Dispatches to Case A (new user), Case B (existing Google user), or Case C (collision with password user).
   */
  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  async googleAuthCallback(@Req() req: any): Promise<GoogleLoginResult> {
    return this.authService.handleGoogleLogin(req.user);
  }

  /**
   * Confirms linking a Google account to an existing password-based account (resolving Case C).
   */
  @Post('google/confirm-link')
  @HttpCode(HttpStatus.OK)
  async confirmGoogleLink(@Body() dto: ConfirmGoogleLinkDto): Promise<AuthResponse> {
    return this.authService.confirmGoogleLink(dto);
  }
}
