import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { UserRole } from '@ai-sales-agent/database';
import { ROLES_KEY } from '../decorators/roles.decorator';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  const createMockExecutionContext = (user?: any): ExecutionContext => {
    return {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    } as unknown as ExecutionContext;
  };

  it('allows access when no @Roles() metadata is defined on the route', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);

    const context = createMockExecutionContext({
      id: 'u1',
      role: UserRole.SALES_REP,
    });

    const result = guard.canActivate(context);
    expect(result).toBe(true);
  });

  it('allows access when requiredRoles array is empty', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([]);

    const context = createMockExecutionContext({
      id: 'u1',
      role: UserRole.SALES_REP,
    });

    const result = guard.canActivate(context);
    expect(result).toBe(true);
  });

  it('allows access when user possesses the exact required role', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([UserRole.ADMIN]);

    const context = createMockExecutionContext({
      id: 'admin-1',
      role: UserRole.ADMIN,
    });

    const result = guard.canActivate(context);
    expect(result).toBe(true);
  });

  it('allows access when user possesses one of multiple allowed roles', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([UserRole.ADMIN, UserRole.MANAGER]);

    const context = createMockExecutionContext({
      id: 'manager-1',
      role: UserRole.MANAGER,
    });

    const result = guard.canActivate(context);
    expect(result).toBe(true);
  });

  it('throws 403 ForbiddenException when user does not possess required role', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([UserRole.ADMIN]);

    const context = createMockExecutionContext({
      id: 'rep-1',
      role: UserRole.SALES_REP,
    });

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    expect(() => guard.canActivate(context)).toThrow(
      "Forbidden resource: Requires one of [ADMIN], current role is 'SALES_REP'",
    );
  });

  it('throws 403 ForbiddenException when user object is missing on request (e.g. guard ordering error)', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([UserRole.ADMIN]);

    const context = createMockExecutionContext(undefined);

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    expect(() => guard.canActivate(context)).toThrow(
      'Forbidden resource: User identity or role missing',
    );
  });

  it('throws 403 ForbiddenException when user object has no role', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([UserRole.ADMIN]);

    const context = createMockExecutionContext({ id: 'anon' });

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});
