import type { Context, MiddlewareHandler, Next } from 'hono';
import { verifyJwt } from './jwt';
import { extractClaims, isAdmin, type AuthClaims } from './claims';
import { UnauthorizedError, ForbiddenError, TokenExpiredError } from './errors';

// ─── Environment interface ────────────────────────────────────────────────

export interface AuthEnv {
  JWT_SECRET: string;
}

// ─── Context variable augmentation ────────────────────────────────────────
// Workers using this middleware should declare:
//   type Variables = { user: AuthClaims }
//   const app = new Hono<{ Bindings: Env; Variables: Variables }>()

// ─── Auth Middleware ──────────────────────────────────────────────────────

/**
 * Hono middleware that validates Bearer JWT tokens.
 * On success, sets `c.set('user', claims)` for downstream handlers.
 * On failure, throws an AuthError (caught by the error handler).
 *
 * Usage:
 *   app.use('/protected/*', authMiddleware())
 *   app.get('/protected/me', (c) => c.json(c.get('user')))
 */
export function authMiddleware<E extends AuthEnv = AuthEnv>(): MiddlewareHandler<{
  Bindings: E;
  Variables: { user: AuthClaims };
}> {
  return async (c: Context, next: Next) => {
    const authHeader = c.req.header('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Missing or invalid Authorization header');
    }

    const token = authHeader.slice(7).trim();
    if (!token) {
      throw new UnauthorizedError('Empty token');
    }

    const secret = (c.env as AuthEnv).JWT_SECRET;
    const payload = await verifyJwt(token, secret);

    if (!payload) {
      // We can't distinguish expired vs tampered without a second parse,
      // but that's intentional — don't leak information to attackers.
      throw new TokenExpiredError('Token is invalid or expired');
    }

    const claims = extractClaims(token);
    if (!claims) {
      throw new UnauthorizedError('Token missing required claims');
    }

    c.set('user', claims);
    await next();
  };
}

/**
 * Middleware that requires admin role.
 * Must be applied AFTER authMiddleware().
 */
export function adminMiddleware(): MiddlewareHandler<{
  Variables: { user: AuthClaims };
}> {
  return async (c: Context, next: Next) => {
    const user = c.get('user') as AuthClaims | undefined;
    if (!user) {
      throw new UnauthorizedError('Authentication required');
    }
    if (!isAdmin(user)) {
      throw new ForbiddenError('Admin access required');
    }
    await next();
  };
}

/**
 * Middleware factory that requires a specific role.
 * Must be applied AFTER authMiddleware().
 */
export function requireRole(
  ...allowedRoles: string[]
): MiddlewareHandler<{ Variables: { user: AuthClaims } }> {
  return async (c: Context, next: Next) => {
    const user = c.get('user') as AuthClaims | undefined;
    if (!user) {
      throw new UnauthorizedError('Authentication required');
    }
    if (!allowedRoles.includes(user.role)) {
      throw new ForbiddenError(`Role '${user.role}' is not authorized for this resource`);
    }
    await next();
  };
}
