/**
 * Dependency smoke test — verifies that the Worker-runtime test pool can load
 * and run every dependency auth-worker relies on: bcryptjs (legacy password
 * hashes, including a pre-existing persisted `$2b$` hash), @klenzo/auth
 * (Web Crypto JWT), @klenzo/validation (zod), and @klenzo/database (Prisma
 * client import).  Kept as a canary: if an upgrade or the §4.5 patch wipe
 * breaks any of these in workerd, this suite fails first.
 */
import { describe, it, expect } from 'vitest';
import * as bcrypt from 'bcryptjs';
import { signJwt, verifyJwt } from '@klenzo/auth';
import { RegisterLegacySchema } from '@klenzo/validation';
import { getCachedClient } from '@klenzo/database';

describe('dependency spike in workerd', () => {
  it('bcryptjs hashes and verifies (legacy $2b$ format)', async () => {
    const hash = await bcrypt.hash('correct horse', 10);
    expect(hash.startsWith('$2')).toBe(true);
    expect(await bcrypt.compare('correct horse', hash)).toBe(true);
    expect(await bcrypt.compare('wrong', hash)).toBe(false);
  });

  it('bcryptjs verifies a pre-existing legacy bcrypt hash', async () => {
    // Pre-generated bcrypt hash of "password123" (persisted $2b$10$ format,
    // the same shape legacy bcrypt@5 writes into auth.users.passwordHash).
    const legacyHash =
      '$2b$10$Z8wAvPWshCayuHKMp8Y9oeLtB1aN3KXOZ1ou6ptOYTqd72bLOhJzC';
    expect(await bcrypt.compare('password123', legacyHash)).toBe(true);
    expect(await bcrypt.compare('nope', legacyHash)).toBe(false);
  });

  it('@klenzo/auth signs and verifies a JWT', async () => {
    const token = await signJwt({ id: 'u1', email: 'a@b.c' }, 'secret', 900);
    const payload = await verifyJwt<{ id: string }>(token, 'secret');
    expect(payload?.id).toBe('u1');
    expect(await verifyJwt(token, 'wrong-secret')).toBeNull();
  });

  it('@klenzo/validation parses the legacy register shape', () => {
    const parsed = RegisterLegacySchema.safeParse({
      email: 'A@Example.com',
      password: 'short',
    });
    expect(parsed.success).toBe(false);
    const ok = RegisterLegacySchema.safeParse({
      email: 'A@Example.com',
      password: 'long-enough',
    });
    expect(ok.success).toBe(true);
    if (ok.success) expect(ok.data.email).toBe('a@example.com');
  });

  it('@klenzo/database exposes a cached Prisma client factory', () => {
    const client = getCachedClient('postgresql://user:pass@localhost:5432/x');
    expect(typeof client.$queryRaw).toBe('function');
    expect(getCachedClient('postgresql://user:pass@localhost:5432/x')).toBe(
      client,
    );
  });
});
