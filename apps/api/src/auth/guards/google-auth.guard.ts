import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {
  handleRequest<TUser = any>(err: any, user: any, info: any): TUser {
    if (err || !user) {
      throw err || new UnauthorizedException(info?.message || 'Google authentication failed');
    }
    return user;
  }
}
