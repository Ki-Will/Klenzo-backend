/**
 * Worker-compatible JWT utilities using the Web Crypto API (crypto.subtle).
 * Does NOT use jsonwebtoken, jose, or any Node-specific library.
 * Algorithm: HS256 (HMAC-SHA-256)
 */

// ─── Base64URL helpers ──────────────────────────────────────────────────────

function base64UrlEncode(buffer: ArrayBuffer | ArrayBufferView): string {
  const bytes =
    buffer instanceof ArrayBuffer
      ? new Uint8Array(buffer)
      : new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  let str = '';
  for (let i = 0; i < bytes.length; i++) {
    str += String.fromCharCode(bytes[i]);
  }
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function base64UrlDecode(input: string): Uint8Array {
  // Pad to multiple of 4
  const padded = input.replace(/-/g, '+').replace(/_/g, '/');
  const paddingNeeded = (4 - (padded.length % 4)) % 4;
  const padded2 = padded + '='.repeat(paddingNeeded);
  const raw = atob(padded2);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    bytes[i] = raw.charCodeAt(i);
  }
  return bytes;
}

function encodeJSON(obj: unknown): string {
  return base64UrlEncode(new TextEncoder().encode(JSON.stringify(obj)));
}

function decodeJSON<T>(encoded: string): T {
  const bytes = base64UrlDecode(encoded);
  return JSON.parse(new TextDecoder().decode(bytes)) as T;
}

// ─── Key import ──────────────────────────────────────────────────────────────

async function importKey(secret: string): Promise<CryptoKey> {
  const keyData = new TextEncoder().encode(secret);
  return crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

// ─── JWT Header ──────────────────────────────────────────────────────────────

const JWT_HEADER = encodeJSON({ alg: 'HS256', typ: 'JWT' });

// ─── Public API ──────────────────────────────────────────────────────────────

export interface JwtPayload {
  [key: string]: unknown;
  iat?: number;
  exp?: number;
}

/**
 * Sign a JWT using HS256.
 * @param payload  Claims to embed (iat and exp are set automatically).
 * @param secret   HMAC secret string.
 * @param expiresInSeconds  TTL in seconds (default 3600).
 */
export async function signJwt(
  payload: JwtPayload,
  secret: string,
  expiresInSeconds = 3600,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const claims: JwtPayload = {
    ...payload,
    iat: now,
    exp: now + expiresInSeconds,
  };

  const header = JWT_HEADER;
  const body = encodeJSON(claims);
  const signingInput = `${header}.${body}`;

  const key = await importKey(secret);
  const signatureBuffer = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(signingInput),
  );

  const signature = base64UrlEncode(signatureBuffer);
  return `${signingInput}.${signature}`;
}

/**
 * Verify a JWT's signature and expiry, returning the decoded payload or null.
 * Returns null if the token is malformed, has an invalid signature, or is expired.
 */
export async function verifyJwt<T extends JwtPayload = JwtPayload>(
  token: string,
  secret: string,
): Promise<T | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [header, body, signature] = parts;
    const signingInput = `${header}.${body}`;

    const key = await importKey(secret);
    const expectedSigBuffer = await crypto.subtle.sign(
      'HMAC',
      key,
      new TextEncoder().encode(signingInput),
    );

    const expectedSig = base64UrlEncode(expectedSigBuffer);

    // Constant-time comparison is done by subtle.verify — we reconstruct
    // the signature bytes to compare properly
    const actualSigBytes = base64UrlDecode(signature);
    const expectedSigBytes = new Uint8Array(expectedSigBuffer);

    if (actualSigBytes.length !== expectedSigBytes.length) return null;

    let mismatch = 0;
    for (let i = 0; i < actualSigBytes.length; i++) {
      mismatch |= actualSigBytes[i] ^ expectedSigBytes[i];
    }
    if (mismatch !== 0) return null;

    const payload = decodeJSON<T>(body);

    // Check expiry
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp !== undefined && payload.exp < now) {
      return null;
    }

    // Suppress unused variable warning from TS
    void expectedSig;

    return payload;
  } catch {
    return null;
  }
}

/**
 * Decode a JWT without verifying its signature.
 * Useful for extracting claims from an already-verified token.
 */
export function decodeJwtUnsafe<T extends JwtPayload = JwtPayload>(token: string): T | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    return decodeJSON<T>(parts[1]);
  } catch {
    return null;
  }
}
