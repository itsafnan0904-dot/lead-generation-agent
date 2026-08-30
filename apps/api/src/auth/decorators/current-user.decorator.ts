import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { UserRole } from '@ai-sales-agent/database';

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

export const CurrentUser = createParamDecorator(
  (data: keyof AuthenticatedUser | undefined, ctx: ExecutionContext): AuthenticatedUser | any => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser;

    if (!user) {
      return null;
    }

    return data ? user[data] : user;
  },
);
