import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@ai-sales-agent/database';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { AuthenticatedUser } from '../decorators/current-user.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // If no roles metadata is set on the route handler or class, allow access by default
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser | undefined;

    // RolesGuard assumes JwtAuthGuard has already executed and attached request.user
    if (!user || !user.role) {
      throw new ForbiddenException('Forbidden resource: User identity or role missing');
    }

    const hasRole = requiredRoles.includes(user.role);
    if (!hasRole) {
      throw new ForbiddenException(
        `Forbidden resource: Requires one of [${requiredRoles.join(', ')}], current role is '${user.role}'`,
      );
    }

    return true;
  }
}
