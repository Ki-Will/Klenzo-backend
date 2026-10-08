/**
 * Session token helpers — LEGACY PARITY.
 *
 * Access token  — HS256 JWT, 15 min, secret `JWT_SECRET || 'KlenzoSecret'`.
 *                 Legacy payload was `{ id, email }` (jwt.strategy reads
 *                 `payload.id`); we additionally embed `userId` + `role` so
 *                 @klenzo/auth AuthClaims consumers work with both old and
 *                 new tokens.
 * Refresh token — 40 random bytes as hex; only the SHA-256 hash is stored
 *                 (auth.users.refreshToken) with refreshTokenExpires = +7 d;
 *                 rotated on every refresh.
 * MFA challenge — JWT `{ sub, type: 'mfa_challenge' }`, 10 min.
 */

import { signJwt, verifyJwt, type JwtPayload } from '@klenzo/auth';
import type { UserRecord } from './store';

export const ACCESS_TOKEN_TTL_S = 15 * 60;
export const REFRESH_TOKEN_TTL_DAYS = 7;
export const MFA_CHALLENGE_TTL_S = 10 * 60;

export interface AccessPayload extends JwtPayload {
  /** Legacy claim name — NestJS jwt.strategy reads `payload.id`. */
  id: string;
  email: string;
  /** Forward-compat claim names used by @klenzo/auth AuthClaims. */
  userId: string;
  role: string;
}

export function accessTokenPayload(user: UserRecord): AccessPayload {
  return {
    id: user.id,
    email: user.email,
    userId: user.id,
    role: user.role,
  };
}

export function signAccessToken(user: UserRecord, secret: string): Promise<string> {
  return signJwt(accessTokenPayload(user), secret, ACCESS_TOKEN_TTL_S);
}

export function verifyAccessToken(
  token: string,
  secret: string,
): Promise<AccessPayload | null> {
  return verifyJwt<AccessPayload>(token, secret);
}

export interface MfaChallengePayload extends JwtPayload {
  sub: string;
  type: string;
}

export function signMfaChallenge(userId: string, secret: string): Promise<string> {
  return signJwt({ sub: userId, type: 'mfa_challenge' }, secret, MFA_CHALLENGE_TTL_S);
}

export function verifyMfaChallenge(
  token: string,
  secret: string,
): Promise<MfaChallengePayload | null> {
  return verifyJwt<MfaChallengePayload>(token, secret);
}

// ── Refresh token ────────────────────────────────────────────────────────────

export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(input),
  );
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export interface IssuedRefreshToken {
  /** Raw token handed to the client (cookie kz_rt). */
  token: string;
  /** SHA-256 hex — persisted to auth.users.refreshToken. */
  hash: string;
  /** auth.users.refreshTokenExpires. */
  expires: Date;
}

export async function newRefreshToken(now: Date = new Date()): Promise<IssuedRefreshToken> {
  const bytes = crypto.getRandomValues(new Uint8Array(40)); // legacy: randomBytes(40)
  const token = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  const hash = await sha256Hex(token);
  const expires = new Date(
    now.getTime() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
  );
  return { token, hash, expires };
}
