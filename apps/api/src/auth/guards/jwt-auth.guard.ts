import { ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
/** A read-only user may still end their own session. */
const VIEWER_WRITE_ALLOWLIST = new Set(['/auth/logout']);

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser = any>(err: any, user: any, info: any, context?: ExecutionContext): TUser {
    if (err || !user) {
      throw err || new UnauthorizedException(info?.message || 'Unauthorized access: Valid bearer token required');
    }

    // VIEWER accounts are read-only everywhere: any request that changes data is refused.
    if (user.role === 'VIEWER' && context) {
      const req = context.switchToHttp().getRequest();
      const path = String(req.originalUrl || req.url || '').split('?')[0];
      if (!SAFE_METHODS.has(req.method) && !VIEWER_WRITE_ALLOWLIST.has(path)) {
        throw new ForbiddenException('Read-only account: this action is not permitted for viewers.');
      }
    }
    return user;
  }
}
