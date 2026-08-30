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
   * Initiates Google OAuth consent screen for the shared system Gmail account.
   * Restricted strictly to ADMIN users.
   * Guard order: JwtAuthGuard populates request.user, then RolesGuard checks ADMIN role.
   */
  @Get('connect')
  @Roles(UserRole.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  async connectGmail(
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ): Promise<void> {
    const consentUrl = this.gmailService.getConsentUrl(user.id);
    return res.redirect(consentUrl);
  }

  /**
   * OAuth callback handling Google's redirect with authorization code.
   * Verifies signed HMAC state initiated by an active ADMIN user.
   */
  @Get('oauth/callback')
  async oauthCallback(
    @Query('code') code: string,
    @Query('state') state?: string,
  ): Promise<GmailStatusResponse> {
    return this.gmailService.handleOAuthCallback(code, state);
  }

  /**
   * Returns current shared Gmail connection status (never exposes raw tokens).
   * Accessible to any authenticated user (ADMIN, SALES_REP, MANAGER, VIEWER).
   */
  @Get('status')
  @UseGuards(JwtAuthGuard)
  async getStatus(): Promise<GmailStatusResponse> {
    return this.gmailService.getStatus();
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

