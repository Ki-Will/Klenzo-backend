/**
 * TOTP unit tests — RFC 6238 test vectors (SHA-1, 30 s step) prove the Web
 * Crypto implementation produces the same codes the legacy speakeasy setup
 * generated for authenticator apps.
 */

import { describe, it, expect } from 'vitest';
import {
  base32Decode,
  base32Encode,
  generateTotpSecret,
  otpauthUrl,
  totpAt,
  verifyTotp,
} from './totp';

// RFC 6238 test secret: ASCII "12345678901234567890".
const RFC_SECRET_B32 = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

describe('base32', () => {
  it('roundtrips bytes', () => {
    const bytes = new Uint8Array([1, 2, 3, 250, 251, 252]);
    expect([...base32Decode(base32Encode(bytes))]).toEqual([...bytes]);
  });

  it('decodes the RFC secret to the ASCII key', () => {
    const decoded = base32Decode(RFC_SECRET_B32);
    expect(new TextDecoder().decode(decoded)).toBe('12345678901234567890');
  });

  it('rejects invalid characters', () => {
    expect(() => base32Decode('INV@LID')).toThrow();
  });
});

describe('totpAt', () => {
  // RFC 6238 Appendix B, T=59 s → 8-digit 94287082 → 6-digit 287082.
  it('matches the RFC 6238 test vector at T=59', async () => {
    expect(await totpAt(RFC_SECRET_B32, 59_000)).toBe('287082');
  });

  it('produces 6-digit codes', async () => {
    const code = await totpAt(generateTotpSecret());
    expect(code).toMatch(/^\d{6}$/);
  });
});

describe('verifyTotp', () => {
  it('accepts the current code', async () => {
    const secret = generateTotpSecret();
    const code = await totpAt(secret);
    expect(await verifyTotp(secret, code)).toBe(true);
  });

  it('accepts ±1 step of clock drift (legacy window: 1)', async () => {
    const secret = generateTotpSecret();
    const now = Date.now();
    const prev = await totpAt(secret, now - 30_000);
    const next = await totpAt(secret, now + 30_000);
    expect(await verifyTotp(secret, prev, now)).toBe(true);
    expect(await verifyTotp(secret, next, now)).toBe(true);
  });

  it('rejects codes outside the drift window', async () => {
    const secret = generateTotpSecret();
    const now = Date.now();
    const tooOld = await totpAt(secret, now - 120_000);
    expect(await verifyTotp(secret, tooOld, now)).toBe(false);
  });

  it('rejects malformed codes', async () => {
    const secret = generateTotpSecret();
    expect(await verifyTotp(secret, '12345')).toBe(false);
    expect(await verifyTotp(secret, 'abcdef')).toBe(false);
    expect(await verifyTotp(secret, '')).toBe(false);
  });
});

describe('otpauthUrl', () => {
  it('builds an authenticator-compatible URL', () => {
    const url = otpauthUrl('JBSWY3DPEHPK3PXP', 'alice@example.com');
    expect(url).toContain('otpauth://totp/');
    expect(url).toContain('secret=JBSWY3DPEHPK3PXP');
    expect(url).toContain('issuer=Klenzo');
    expect(url).toContain('digits=6');
    expect(url).toContain('period=30');
    expect(url).toContain('alice%40example.com');
  });
});
