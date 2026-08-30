import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile, VerifyCallback } from 'passport-google-oauth20';

export interface GoogleProfilePayload {
  googleId: string;
  email: string;
  name: string;
  avatarUrl?: string;
}

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor() {
    super({
      clientID: process.env.GOOGLE_LOGIN_CLIENT_ID || 'mock_google_login_client_id',
      clientSecret: process.env.GOOGLE_LOGIN_CLIENT_SECRET || 'mock_google_login_client_secret',
      callbackURL: process.env.GOOGLE_LOGIN_CALLBACK_URL || 'http://localhost:4000/auth/google/callback',
      scope: ['email', 'profile'],
    });
  }

  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ): Promise<any> {
    const { id, emails, displayName, photos } = profile;

    if (!emails || emails.length === 0 || !emails[0].value) {
      return done(new UnauthorizedException('Google account does not provide an email address'), false);
    }

    const payload: GoogleProfilePayload = {
      googleId: id,
      email: emails[0].value.toLowerCase().trim(),
      name: displayName || emails[0].value.split('@')[0],
      avatarUrl: photos && photos.length > 0 ? photos[0].value : undefined,
    };

    return done(null, payload);
  }
}
