import { SetMetadata } from '@nestjs/common';
import { UserRole } from '@ai-sales-agent/database';

export const ROLES_KEY = 'roles';

/**
 * Attaches required UserRole metadata to a route handler or controller class.
 * Usage: @Roles(UserRole.ADMIN, UserRole.MANAGER)
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
