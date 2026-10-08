/**
 * HTTP helpers with LEGACY NestJS parity.
 *
 * The existing frontend (klenzoo-frontend/apps/web/lib/api.ts) reads error
 * bodies as `{ statusCode, timestamp, path, message }` (produced by the
 * legacy AllExceptionsFilter) and expects `message` to be a string or string
 * array.  Cookies must match the legacy controller exactly:
 *   kz_at — access token, 15 min, HttpOnly, SameSite=Lax, Path=/
 *   kz_rt — refresh token, 7 days, HttpOnly, SameSite=Lax, Path=/
 */

import type { Context } from 'hono';

// ── Errors ───────────────────────────────────────────────────────────────────

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly messages: string | string[],
  ) {
    super(typeof messages === 'string' ? messages : messages.join(', '));
    this.name = 'HttpError';
  }
}

/** Shape produced by the legacy AllExceptionsFilter. */
export function legacyErrorBody(
  statusCode: number,
  message: string | string[],
  path: string,
) {
  return {
    statusCode,
    timestamp: new Date().toISOString(),
    path,
    message,
  };
}

/** Parse a JSON request body; throws a 400 HttpError on malformed payloads. */
export async function readJson(c: Context): Promise<unknown> {
  try {
    return await c.req.json();
  } catch {
    throw new HttpError(400, 'Invalid JSON body');
  }
}

// ── Cookies ──────────────────────────────────────────────────────────────────

export function parseCookies(
  header: string | null | undefined,
): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx < 1) continue;
    const name = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (!(name in out)) out[name] = value;
  }
  return out;
}

interface CookieOptions {
  maxAgeSeconds?: number;
  secure?: boolean;
}

export function serializeCookie(
  name: string,
  value: string,
  opts: CookieOptions = {},
): string {
  let cookie = `${name}=${value}; Path=/; HttpOnly; SameSite=Lax`;
  if (opts.maxAgeSeconds !== undefined) {
    cookie += `; Max-Age=${opts.maxAgeSeconds}`;
  }
  if (opts.secure) cookie += '; Secure';
  return cookie;
}

export function clearCookie(name: string, opts: { secure?: boolean } = {}): string {
  return serializeCookie(name, '', { ...opts, maxAgeSeconds: 0 });
}

/** Append a Set-Cookie header without overwriting previous ones. */
export function appendSetCookie(c: Context, cookie: string): void {
  c.header('Set-Cookie', cookie, { append: true });
}
