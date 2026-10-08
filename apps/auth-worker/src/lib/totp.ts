/**
 * TOTP (RFC 6238) — Web Crypto implementation.
 *
 * Parity with the legacy speakeasy usage in mfa.service.ts:
 *   algorithm SHA-1, 6 digits, 30 s step, base32 secret, window 1
 * (±30 s of clock drift accepted).
 *
 * Implemented with crypto.subtle only — no Node crypto, no speakeasy —
 * so it runs unmodified inside the Workers runtime.
 */

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Decode(input: string): Uint8Array {
  const clean = input.replace(/[\s=]+/g, '').toUpperCase();
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = BASE32_ALPHABET.indexOf(ch);
    if (idx === -1) throw new Error('invalid base32 character');
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return new Uint8Array(out);
}

export function base32Encode(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

async function hotp(key: Uint8Array, counter: number, digits: number): Promise<string> {
  const counterBytes = new Uint8Array(8);
  let remaining = counter;
  for (let i = 7; i >= 0; i--) {
    counterBytes[i] = remaining & 0xff;
    remaining = Math.floor(remaining / 256);
  }
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    // Fresh ArrayBuffer-backed copy — newer TS lib types reject
    // Uint8Array<ArrayBufferLike> where BufferSource is expected.
    new Uint8Array(key),
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign'],
  );
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, counterBytes));
  const offset = mac[mac.length - 1] & 0x0f;
  const code =
    ((mac[offset] & 0x7f) << 24) |
    (mac[offset + 1] << 16) |
    (mac[offset + 2] << 8) |
    mac[offset + 3];
  return String(code % 10 ** digits).padStart(digits, '0');
}

export const TOTP_STEP_MS = 30_000;

/** Current (or at-time) TOTP code for a base32 secret. */
export function totpAt(secretBase32: string, atMs: number = Date.now()): Promise<string> {
  const counter = Math.floor(atMs / TOTP_STEP_MS);
  return hotp(base32Decode(secretBase32), counter, 6);
}

/** Verify a 6-digit code, accepting ±`window` steps of drift (legacy: 1). */
export async function verifyTotp(
  secretBase32: string,
  code: string,
  atMs: number = Date.now(),
  window = 1,
): Promise<boolean> {
  if (!/^\d{6}$/.test(code)) return false;
  for (let w = -window; w <= window; w++) {
    const expected = await totpAt(secretBase32, atMs + w * TOTP_STEP_MS);
    if (expected === code) return true;
  }
  return false;
}

/** 20 random bytes → base32 (legacy speakeasy length: 32 chars of entropy). */
export function generateTotpSecret(): string {
  return base32Encode(crypto.getRandomValues(new Uint8Array(20)));
}

/** otpauth:// URL for authenticator apps (MFA setup flow). */
export function otpauthUrl(
  secretBase32: string,
  account: string,
  issuer = 'Klenzo',
): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  return (
    `otpauth://totp/${label}?secret=${secretBase32}` +
    `&issuer=${encodeURIComponent(issuer)}` +
    '&algorithm=SHA1&digits=6&period=30'
  );
}
