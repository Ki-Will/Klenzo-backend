/**
 * Password hashing for auth-worker — LEGACY PARITY.
 *
 * The legacy NestJS service hashes with bcrypt (cost 10) and the live
 * auth.users table contains bcrypt hashes (`$2b$…`).  bcryptjs is a pure-JS
 * bcrypt implementation that verifies those hashes inside the Workers
 * runtime (no Node native bindings), so we hash AND verify with bcryptjs.
 *
 * @klenzo/auth's PBKDF2 helpers are intentionally NOT used here: PBKDF2
 * hashes cannot verify existing bcrypt hashes, which would break every
 * existing account on cutover.
 */

import * as bcrypt from 'bcryptjs';

const COST = 10; // matches legacy bcrypt.hash(password, 10)

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, COST);
}

export function verifyPassword(
  password: string,
  storedHash: string,
): Promise<boolean> {
  return bcrypt.compare(password, storedHash);
}
