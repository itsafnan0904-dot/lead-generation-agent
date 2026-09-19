import {
  Controller,
  Get,
  Post,
  Query,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { UserRole } from '@ai-sales-agent/database';
import { GmailService, GmailStatusResponse } from './gmail.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../auth/decorators/current-user.decorator';

@Controller('gmail')
export class GmailController {
  constructor(private readonly gmailService: GmailService) {}

  /**
   * Generates Google OAuth consent URL for connecting the shared business Gmail account.
   * Restricted strictly to ADMIN users.
   * Guard order: JwtAuthGuard populates request.user, then RolesGuard checks ADMIN role.
   */
  @Get('connect')
  @Roles(UserRole.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  async connectGmail(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ authUrl: string }> {
    const authUrl = this.gmailService.getConsentUrl(user.id);
    return { authUrl };
  }

  /**
   * OAuth callback handling Google's redirect with authorization code.
   * Verifies signed HMAC state initiated by an active ADMIN user.
   * Redirects user back to the frontend Gmail dashboard page.
   */
  @Get('oauth/callback')
  async oauthCallback(
    @Query('code') code: string,
    @Res() res: Response,
    @Query('state') state?: string,
  ): Promise<void> {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    try {
      await this.gmailService.handleOAuthCallback(code, state);
      return res.redirect(`${frontendUrl}/gmail?connected=true`);
    } catch (err: any) {
      let safeReason = 'oauth_failed';
      const msg = err.message || '';
      if (msg.includes('Missing authorization code') || msg.includes('Missing OAuth state')) {
        safeReason = 'missing_parameters';
      } else if (msg.includes('expired')) {
        safeReason = 'state_expired';
      } else if (msg.includes('ADMIN role') || msg.includes('Unauthorized')) {
        safeReason = 'admin_required';
      } else if (msg.includes('Invalid') || msg.includes('tampered') || msg.includes('signature')) {
        safeReason = 'invalid_state';
      } else if (msg.includes('exchange')) {
        safeReason = 'exchange_failed';
      }
      return res.redirect(`${frontendUrl}/gmail?error=${encodeURIComponent(safeReason)}`);
    }
  }

  /**
   * Returns current shared Gmail connection status (never exposes raw tokens).
   * Accessible to any authenticated user (ADMIN, SALES_REP, MANAGER, VIEWER).
   * Supports optional ?force=true query parameter to bypass cache and force fresh Google API verification.
   */
  @Get('status')
  @UseGuards(JwtAuthGuard)
  async getStatus(@Query('force') force?: string): Promise<GmailStatusResponse> {
    return this.gmailService.getStatus({ forceVerify: force === 'true' });
  }

  /**
   * Disconnects and deactivates the shared Gmail account.
   * Restricted strictly to ADMIN users.
   * Guard order: JwtAuthGuard populates request.user, then RolesGuard checks ADMIN role.
   */
  @Post('disconnect')
  @Roles(UserRole.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @HttpCode(HttpStatus.OK)
  async disconnect(): Promise<{ success: boolean; message: string }> {
    return this.gmailService.disconnect();
  }
}

