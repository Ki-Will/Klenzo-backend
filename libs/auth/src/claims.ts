import { decodeJwtUnsafe } from './jwt';

// ─── Claims Interface ─────────────────────────────────────────────────────

export interface AuthClaims {
  userId: string;
  email: string;
  role: string;
  iat: number;
  exp: number;
}

const ADMIN_ROLES = new Set(['ADMIN', 'SUPER_ADMIN', 'PLATFORM_ADMIN']);

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Extract claims from a JWT string without verifying the signature.
 * Only use this on tokens that have already been verified by verifyJwt().
 * Returns null if the token is malformed or missing required fields.
 */
export function extractClaims(token: string): AuthClaims | null {
  const payload = decodeJwtUnsafe(token);
  if (!payload) return null;

  const { userId, email, role, iat, exp } = payload as Partial<AuthClaims>;

  if (
    typeof userId !== 'string' ||
    typeof email !== 'string' ||
    typeof role !== 'string' ||
    typeof iat !== 'number' ||
    typeof exp !== 'number'
  ) {
    return null;
  }

  return { userId, email, role, iat, exp };
}

/**
 * Check whether claims represent an admin-level user.
 */
export function isAdmin(claims: AuthClaims): boolean {
  return ADMIN_ROLES.has(claims.role);
}

/**
 * Check whether claims represent a super admin.
 */
export function isSuperAdmin(claims: AuthClaims): boolean {
  return claims.role === 'SUPER_ADMIN';
}

/**
 * Check whether the claims are still valid (not expired).
 */
export function isClaimsExpired(claims: AuthClaims): boolean {
  return Math.floor(Date.now() / 1000) >= claims.exp;
}
