import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions';

/**
 * Decorator to require specific permissions for a route.
 *
 * Usage:
 *   @RequirePermissions('transactions.reverse_approve')
 *   @RequirePermissions('users.read', 'users.update')
 */
export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
