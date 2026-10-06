/**
 * Worker-compatible password hashing using the Web Crypto API (crypto.subtle).
 * Algorithm: PBKDF2 with SHA-256.
 * Does NOT use bcrypt, argon2, or any Node-specific library.
 *
 * Hash format: "pbkdf2:iterations:base64url(salt):base64url(hash)"
 */

const ALGORITHM = 'PBKDF2';
const HASH_ALGO = 'SHA-256';
const ITERATIONS = 310_000; // OWASP 2023 recommendation for PBKDF2-SHA-256
const KEY_LENGTH = 32;       // 256-bit output
const SALT_LENGTH = 16;      // 128-bit salt

// ─── Internal helpers ─────────────────────────────────────────────────────

function bufferToBase64Url(buffer: ArrayBuffer | ArrayBufferView): string {
  const bytes = buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  let str = '';
  for (let i = 0; i < bytes.length; i++) {
    str += String.fromCharCode(bytes[i]);
  }
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function base64UrlToBuffer(input: string): Uint8Array {
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

async function deriveKey(
  password: string,
  salt: Uint8Array,
  iterations: number,
): Promise<ArrayBuffer> {
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    { name: ALGORITHM },
    false,
    ['deriveBits'],
  );

  return crypto.subtle.deriveBits(
    {
      name: ALGORITHM,
      salt,
      iterations,
      hash: HASH_ALGO,
    },
    passwordKey,
    KEY_LENGTH * 8,
  );
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Hash a password using PBKDF2-SHA-256 with a random salt.
 * Returns a self-describing hash string that includes all parameters needed
 * to verify the password later.
 *
 * Format: `pbkdf2:<iterations>:<base64url-salt>:<base64url-hash>`
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const hashBuffer = await deriveKey(password, salt, ITERATIONS);

  const saltEncoded = bufferToBase64Url(salt);
  const hashEncoded = bufferToBase64Url(hashBuffer);

  return `pbkdf2:${ITERATIONS}:${saltEncoded}:${hashEncoded}`;
}

/**
 * Verify a password against a stored hash produced by hashPassword().
 * Returns false for any malformed hash without throwing.
 */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  try {
    const parts = storedHash.split(':');
    if (parts.length !== 4 || parts[0] !== 'pbkdf2') {
      return false;
    }

    const iterations = parseInt(parts[1], 10);
    if (!Number.isFinite(iterations) || iterations <= 0) return false;

    const salt = base64UrlToBuffer(parts[2]);
    const expectedHashBytes = base64UrlToBuffer(parts[3]);

    const actualHashBuffer = await deriveKey(password, salt, iterations);
    const actualHashBytes = new Uint8Array(actualHashBuffer);

    // Constant-time comparison to prevent timing attacks
    if (actualHashBytes.length !== expectedHashBytes.length) return false;

    let mismatch = 0;
    for (let i = 0; i < actualHashBytes.length; i++) {
      mismatch |= actualHashBytes[i] ^ expectedHashBytes[i];
    }

    return mismatch === 0;
  } catch {
    return false;
  }
}
