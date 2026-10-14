/**
 * PHASE 4 — Auth Worker test suite.
 *
 * Covers the migration plan's Phase 4 test list against the real Hono app in
 * the Workers runtime (in-memory user store injected via createApp):
 *
 *   registration · duplicate account · login success · wrong password ·
 *   expired token · invalid token · authorization failure · valid
 *   authorization · service-to-service auth · contract compatibility
 *
 * All response shapes asserted here are the LEGACY NestJS shapes the
 * existing frontend parses (klenzoo-frontend/apps/web/lib/api.ts).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { signJwt } from '@klenzo/auth';
import type { ValidateTokenResponse } from '@klenzo/contracts';

import { createApp } from './app';
import { memoryUserStore, type MemoryUserStore } from './lib/store';
import { verifyPassword } from './lib/password';
import { generateTotpSecret, totpAt } from './lib/totp';
import type { Deps } from './types/deps';

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------

const JWT_SECRET = 'test-jwt-secret';
const RPC_SECRET = 'test-rpc-secret';
const BASE = 'https://auth-worker.test';

interface Harness {
  app: ReturnType<typeof createApp>;
  store: MemoryUserStore;
}

function makeHarness(overrides: Partial<Deps> = {}): Harness {
  const store = memoryUserStore();
  const deps: Deps = {
    store,
    jwtSecret: JWT_SECRET,
    rpcSecret: RPC_SECRET,
    secureCookies: false,
    ...overrides,
  };
  return { app: createApp(deps), store };
}

interface JsonResult {
  res: Response;
  body: any;
}

async function json(
  app: Harness['app'],
  path: string,
  init: RequestInit = {},
): Promise<JsonResult> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const res = await app.request(`${BASE}${path}`, { ...init, headers });
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { res, body };
}

/** All Set-Cookie header values as a name → raw-cookie map. */
function setCookies(res: Response): Record<string, string> {
  const list =
    typeof res.headers.getSetCookie === 'function'
      ? res.headers.getSetCookie()
      : [res.headers.get('Set-Cookie')].filter(Boolean) as string[];
  const out: Record<string, string> = {};
  for (const raw of list) {
    const eq = raw.indexOf('=');
    if (eq > 0) out[raw.slice(0, eq)] = raw;
  }
  return out;
}

function cookieValue(res: Response, name: string): string | undefined {
  const raw = setCookies(res)[name];
  if (!raw) return undefined;
  return raw.slice(raw.indexOf('=') + 1, raw.indexOf(';'));
}

async function register(
  harness: Harness,
  email = 'alice@example.com',
  password = 'password123',
): Promise<JsonResult> {
  return json(harness.app, '/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

async function login(
  harness: Harness,
  email: string,
  password: string,
): Promise<JsonResult> {
  return json(harness.app, '/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

describe('registration', () => {
  let h: Harness;
  beforeEach(() => {
    h = makeHarness();
  });

  it('creates an account and auto-logs-in with legacy 201 body', async () => {
    const { res, body } = await register(h);
    expect(res.status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.message).toBe('Registration successful');
    expect(typeof body.accessToken).toBe('string');
    expect(typeof body.refreshToken).toBe('string');
    expect(body.user.email).toBe('alice@example.com');
    expect(body.user.isActive).toBe(true);
    // safeUser strips secrets
    expect(body.user.passwordHash).toBeUndefined();
    expect(body.user.refreshToken).toBeUndefined();
    expect(body.user.passwordResetToken).toBeUndefined();
  });

  it('sets kz_at (15 min) and kz_rt (7 d) HttpOnly cookies', async () => {
    const { res, body } = await register(h);
    const cookies = setCookies(res);

    const at = cookies['kz_at'];
    const rt = cookies['kz_rt'];
    expect(at).toBeDefined();
    expect(rt).toBeDefined();
    expect(at).toContain('Max-Age=900');
    expect(rt).toContain(`Max-Age=${7 * 24 * 60 * 60}`);
    for (const raw of [at, rt]) {
      expect(raw).toContain('Path=/');
      expect(raw).toContain('HttpOnly');
      expect(raw).toContain('SameSite=Lax');
      expect(raw).not.toContain('Secure'); // not production
    }
    // Cookie values match the tokens in the body
    expect(cookieValue(res, 'kz_at')).toBe(body.accessToken);
    expect(cookieValue(res, 'kz_rt')).toBe(body.refreshToken);
  });

  it('stores a bcrypt hash, never the plaintext password', async () => {
    await register(h);
    const row = [...h.store.rows.values()][0];
    expect(row.passwordHash.startsWith('$2')).toBe(true);
    expect(row.passwordHash).not.toContain('password123');
    expect(await verifyPassword('password123', row.passwordHash)).toBe(true);
    expect(await verifyPassword('wrong', row.passwordHash)).toBe(false);
  });

  it('rejects a duplicate account with legacy 409 body', async () => {
    await register(h);
    const { res, body } = await register(h);
    expect(res.status).toBe(409);
    expect(body.statusCode).toBe(409);
    expect(body.message).toBe('Email already in use');
    expect(typeof body.timestamp).toBe('string');
    expect(body.path).toBe('/auth/register');
  });

  it('rejects a short password with 400 + message list', async () => {
    const { res, body } = await json(h.app, '/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email: 'bob@example.com', password: 'short' }),
    });
    expect(res.status).toBe(400);
    expect(body.statusCode).toBe(400);
    expect(Array.isArray(body.message)).toBe(true);
    expect(h.store.rows.size).toBe(0);
  });

  it('rejects an invalid email with 400', async () => {
    const { res } = await json(h.app, '/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email: 'not-an-email', password: 'password123' }),
    });
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------

describe('login', () => {
  let h: Harness;
  beforeEach(async () => {
    h = makeHarness();
    await register(h);
  });

  it('returns a session with legacy 200 body on success', async () => {
    const { res, body } = await login(h, 'alice@example.com', 'password123');
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.user.email).toBe('alice@example.com');
    expect(body.user.passwordHash).toBeUndefined();
    expect(typeof body.accessToken).toBe('string');
    expect(typeof body.refreshToken).toBe('string');
    expect(body.user.lastLogin).toBeTruthy();
    expect(setCookies(res)['kz_at']).toBeDefined();
    expect(setCookies(res)['kz_rt']).toBeDefined();
  });

  it('rejects a wrong password with 401 "Invalid credentials" and counts the attempt', async () => {
    const { res, body } = await login(h, 'alice@example.com', 'wrong-password');
    expect(res.status).toBe(401);
    expect(body.statusCode).toBe(401);
    expect(body.message).toBe('Invalid credentials');
    const row = [...h.store.rows.values()][0];
    expect(row.failedLoginAttempts).toBe(1);
    expect(row.isActive).toBe(true);
  });

  it('rejects an unknown email with the same 401 (no enumeration)', async () => {
    const { res, body } = await login(h, 'ghost@example.com', 'password123');
    expect(res.status).toBe(401);
    expect(body.message).toBe('Invalid credentials');
  });

  it('locks the account after 5 failed attempts', async () => {
    for (let i = 0; i < 5; i++) {
      await login(h, 'alice@example.com', 'wrong-password');
    }
    const row = [...h.store.rows.values()][0];
    expect(row.isActive).toBe(false);
    expect(row.failedLoginAttempts).toBe(5);

    // Even the correct password now reports the lock (legacy order: lock
    // check happens before the password check).
    const { res, body } = await login(h, 'alice@example.com', 'password123');
    expect(res.status).toBe(401);
    expect(body.message).toBe(
      'Account is locked. Reset your password to regain access.',
    );
  });

  it('resets the failure counter and stamps lastLogin on success', async () => {
    await login(h, 'alice@example.com', 'wrong-password');
    await login(h, 'alice@example.com', 'password123');
    const row = [...h.store.rows.values()][0];
    expect(row.failedLoginAttempts).toBe(0);
    expect(row.lastLogin).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Authorization (kz_at / Bearer token)
// ---------------------------------------------------------------------------

describe('authorization', () => {
  let h: Harness;
  let token: string;

  beforeEach(async () => {
    h = makeHarness();
    await register(h);
    token = (await login(h, 'alice@example.com', 'password123')).body
      .accessToken;
  });

  it('valid authorization: GET /auth/profile with cookie', async () => {
    const { res, body } = await json(h.app, '/auth/profile', {
      headers: { Cookie: `kz_at=${token}` },
    });
    expect(res.status).toBe(200);
    expect(body.email).toBe('alice@example.com');
    expect(body.passwordHash).toBeUndefined();
  });

  it('valid authorization: Bearer header also works', async () => {
    const { res } = await json(h.app, '/auth/profile', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
  });

  it('authorization failure: no credentials → 401', async () => {
    const { res, body } = await json(h.app, '/auth/profile');
    expect(res.status).toBe(401);
    expect(body.statusCode).toBe(401);
    expect(body.message).toBe('Unauthorized');
  });

  it('invalid token: garbage → 401', async () => {
    const { res } = await json(h.app, '/auth/profile', {
      headers: { Cookie: 'kz_at=garbage.token.here' },
    });
    expect(res.status).toBe(401);
  });

  it('expired token → 401', async () => {
    const expired = await signJwt(
      { id: 'x', email: 'alice@example.com', userId: 'x', role: 'USER' },
      JWT_SECRET,
      -60,
    );
    const { res, body } = await json(h.app, '/auth/profile', {
      headers: { Cookie: `kz_at=${expired}` },
    });
    expect(res.status).toBe(401);
    expect(body.message).toBe('Unauthorized');
  });

  it('token signed with the wrong secret → 401', async () => {
    const forged = await signJwt(
      { id: 'x', email: 'alice@example.com', userId: 'x', role: 'USER' },
      'some-other-secret',
      900,
    );
    const { res } = await json(h.app, '/auth/profile', {
      headers: { Cookie: `kz_at=${forged}` },
    });
    expect(res.status).toBe(401);
  });

  it('deleted/inactive user → 401', async () => {
    const row = [...h.store.rows.values()][0];
    await h.store.update(row.id, { isActive: false });
    const { res, body } = await json(h.app, '/auth/profile', {
      headers: { Cookie: `kz_at=${token}` },
    });
    expect(res.status).toBe(401);
    expect(body.message).toBe('User not found or account is inactive');
  });
});

// ---------------------------------------------------------------------------
// Refresh
// ---------------------------------------------------------------------------

describe('refresh', () => {
  let h: Harness;
  let loginResult: JsonResult;

  beforeEach(async () => {
    h = makeHarness();
    await register(h);
    loginResult = await login(h, 'alice@example.com', 'password123');
  });

  it('issues a new access token and rotates the refresh cookie', async () => {
    const oldRefresh = cookieValue(loginResult.res, 'kz_rt');
    const { res, body } = await json(h.app, '/auth/refresh', {
      method: 'POST',
      headers: { Cookie: `kz_rt=${oldRefresh}` },
    });
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(typeof body.accessToken).toBe('string');
    expect(setCookies(res)['kz_at']).toBeDefined();

    const newRefresh = cookieValue(res, 'kz_rt');
    expect(newRefresh).toBeDefined();
    expect(newRefresh).not.toBe(oldRefresh);
  });

  it('rejects replay of the old refresh token after rotation', async () => {
    const oldRefresh = cookieValue(loginResult.res, 'kz_rt');
    await json(h.app, '/auth/refresh', {
      method: 'POST',
      headers: { Cookie: `kz_rt=${oldRefresh}` },
    });
    const { res, body } = await json(h.app, '/auth/refresh', {
      method: 'POST',
      headers: { Cookie: `kz_rt=${oldRefresh}` },
    });
    expect(res.status).toBe(401);
    expect(body.message).toBe('Invalid or expired refresh token');
  });

  it('missing cookie → 401 "No refresh token"', async () => {
    const { res, body } = await json(h.app, '/auth/refresh', { method: 'POST' });
    expect(res.status).toBe(401);
    expect(body.message).toBe('No refresh token');
  });

  it('bogus cookie → 401 "Invalid or expired refresh token"', async () => {
    const { res, body } = await json(h.app, '/auth/refresh', {
      method: 'POST',
      headers: { Cookie: 'kz_rt=deadbeef' },
    });
    expect(res.status).toBe(401);
    expect(body.message).toBe('Invalid or expired refresh token');
  });

  it('expired refresh token → 401', async () => {
    const row = [...h.store.rows.values()][0];
    await h.store.update(row.id, {
      refreshTokenExpires: new Date(Date.now() - 1000),
    });
    const { res } = await json(h.app, '/auth/refresh', {
      method: 'POST',
      headers: { Cookie: `kz_rt=${cookieValue(loginResult.res, 'kz_rt')}` },
    });
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// Logout
// ---------------------------------------------------------------------------

describe('logout', () => {
  let h: Harness;
  let loginResult: JsonResult;

  beforeEach(async () => {
    h = makeHarness();
    await register(h);
    loginResult = await login(h, 'alice@example.com', 'password123');
  });

  it('clears both cookies and invalidates the refresh token', async () => {
    const at = cookieValue(loginResult.res, 'kz_at');
    const rt = cookieValue(loginResult.res, 'kz_rt');

    const { res, body } = await json(h.app, '/auth/logout', {
      method: 'POST',
      headers: { Cookie: `kz_at=${at}` },
    });
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);

    const cookies = setCookies(res);
    expect(cookies['kz_at']).toContain('Max-Age=0');
    expect(cookies['kz_rt']).toContain('Max-Age=0');

    // The stored refresh hash is gone — the old cookie can no longer refresh.
    const { res: refreshRes } = await json(h.app, '/auth/refresh', {
      method: 'POST',
      headers: { Cookie: `kz_rt=${rt}` },
    });
    expect(refreshRes.status).toBe(401);
  });

  it('requires authentication', async () => {
    const { res } = await json(h.app, '/auth/logout', { method: 'POST' });
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// MFA login
// ---------------------------------------------------------------------------

describe('mfa login', () => {
  let h: Harness;
  let userId: string;
  let secret: string;

  beforeEach(async () => {
    h = makeHarness();
    const created = await register(h);
    const row = [...h.store.rows.values()][0];
    userId = row.id;
    secret = generateTotpSecret();
    await h.store.update(row.id, { mfaEnabled: true, mfaSecret: secret });
    void created;
  });

  it('returns {mfaRequired, mfaToken} without session cookies', async () => {
    const { res, body } = await login(h, 'alice@example.com', 'password123');
    expect(res.status).toBe(200);
    expect(body.mfaRequired).toBe(true);
    expect(typeof body.mfaToken).toBe('string');
    expect(body.accessToken).toBeUndefined();
    expect(setCookies(res)['kz_at']).toBeUndefined();
  });

  it('completes the login with a valid TOTP code', async () => {
    const challenge = await login(h, 'alice@example.com', 'password123');
    const code = await totpAt(secret);
    const { res, body } = await json(h.app, '/auth/login/mfa', {
      method: 'POST',
      body: JSON.stringify({ mfaToken: challenge.body.mfaToken, code }),
    });
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.user.email).toBe('alice@example.com');
    expect(typeof body.accessToken).toBe('string');
    expect(setCookies(res)['kz_at']).toBeDefined();
  });

  it('rejects a wrong TOTP code with 401', async () => {
    const challenge = await login(h, 'alice@example.com', 'password123');
    const valid = await totpAt(secret);
    const wrong = valid === '000000' ? '111111' : '000000';
    const { res, body } = await json(h.app, '/auth/login/mfa', {
      method: 'POST',
      body: JSON.stringify({ mfaToken: challenge.body.mfaToken, code: wrong }),
    });
    expect(res.status).toBe(401);
    expect(body.message).toBe('Invalid authentication code');
  });

  it('rejects a malformed code (non-6-digit) with 400', async () => {
    const challenge = await login(h, 'alice@example.com', 'password123');
    const { res } = await json(h.app, '/auth/login/mfa', {
      method: 'POST',
      body: JSON.stringify({ mfaToken: challenge.body.mfaToken, code: '12ab56' }),
    });
    expect(res.status).toBe(400);
  });

  it('rejects an expired challenge token', async () => {
    const expired = await signJwt(
      { sub: userId, type: 'mfa_challenge' },
      JWT_SECRET,
      -60,
    );
    const { res, body } = await json(h.app, '/auth/login/mfa', {
      method: 'POST',
      body: JSON.stringify({ mfaToken: expired, code: '123456' }),
    });
    expect(res.status).toBe(401);
    expect(body.message).toBe('MFA challenge expired — please sign in again');
  });

  it('rejects a valid token that is not an mfa_challenge', async () => {
    const wrongType = await signJwt(
      { sub: userId, type: 'session' },
      JWT_SECRET,
      600,
    );
    const { res, body } = await json(h.app, '/auth/login/mfa', {
      method: 'POST',
      body: JSON.stringify({ mfaToken: wrongType, code: '123456' }),
    });
    expect(res.status).toBe(401);
    expect(body.message).toBe('Invalid MFA challenge');
  });
});

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

describe('profile', () => {
  let h: Harness;
  let token: string;

  beforeEach(async () => {
    h = makeHarness();
    await register(h);
    token = (await login(h, 'alice@example.com', 'password123')).body
      .accessToken;
  });

  it('updates name / phone / notificationSettings', async () => {
    const { res, body } = await json(h.app, '/auth/profile', {
      method: 'POST',
      headers: { Cookie: `kz_at=${token}` },
      body: JSON.stringify({
        name: 'Alice U',
        phone: '+250788000000',
        notificationSettings: { smartInsights: true, securityAlerts: false },
      }),
    });
    expect(res.status).toBe(200);
    expect(body.name).toBe('Alice U');
    expect(body.phone).toBe('+250788000000');
    expect(body.notificationSettings).toEqual({
      smartInsights: true,
      securityAlerts: false,
    });
    expect(body.passwordHash).toBeUndefined();

    const row = [...h.store.rows.values()][0];
    expect(row.name).toBe('Alice U');
  });

  it('treats an empty body as a no-op', async () => {
    const { res, body } = await json(h.app, '/auth/profile', {
      method: 'POST',
      headers: { Cookie: `kz_at=${token}` },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(200);
    expect(body.email).toBe('alice@example.com');
  });

  it('rejects an invalid field type with 400', async () => {
    const { res } = await json(h.app, '/auth/profile', {
      method: 'POST',
      headers: { Cookie: `kz_at=${token}` },
      body: JSON.stringify({ name: 42 }),
    });
    expect(res.status).toBe(400);
  });

  it('requires authentication', async () => {
    const { res } = await json(h.app, '/auth/profile', {
      method: 'POST',
      body: JSON.stringify({ name: 'X' }),
    });
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// Service-to-service RPC (Phase 4/5 contract)
// ---------------------------------------------------------------------------

describe('rpc service-to-service', () => {
  let h: Harness;
  let token: string;
  let userId: string;

  const rpcHeaders = {
    'Content-Type': 'application/json',
    'x-klenzo-rpc-secret': RPC_SECRET,
  };

  beforeEach(async () => {
    h = makeHarness();
    await register(h);
    loginResult2 = await login(h, 'alice@example.com', 'password123');
    token = loginResult2.body.accessToken;
    userId = [...h.store.rows.values()][0].id;
  });

  let loginResult2: JsonResult;

  it('rejects calls without the shared secret', async () => {
    const { res } = await json(h.app, '/rpc/validate-token', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
    expect(res.status).toBe(401);
  });

  it('rejects calls with a wrong secret', async () => {
    const { res } = await json(h.app, '/rpc/validate-token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-klenzo-rpc-secret': 'wrong-secret',
      },
      body: JSON.stringify({ token }),
    });
    expect(res.status).toBe(401);
  });

  it('rejects every RPC when no secret is configured (fail closed)', async () => {
    const openHarn = makeHarness({ rpcSecret: '' });
    const { res } = await json(openHarn.app, '/rpc/validate-token', {
      method: 'POST',
      headers: rpcHeaders,
      body: JSON.stringify({ token }),
    });
    expect(res.status).toBe(401);
  });

  it('validates a good token into typed claims (contract shape)', async () => {
    const { res, body } = await json(h.app, '/rpc/validate-token', {
      method: 'POST',
      headers: rpcHeaders,
      body: JSON.stringify({ token }),
    });
    expect(res.status).toBe(200);
    // Runtime contract check against @klenzo/contracts ValidateTokenResponse.
    const typed: ValidateTokenResponse = body;
    expect(typed.isValid).toBe(true);
    expect(typed.userId).toBe(userId);
    expect(typed.email).toBe('alice@example.com');
    expect(typed.role).toBe('USER');
    expect(typed.isActive).toBe(true);
  });

  it('reports invalid tokens as isValid: false', async () => {
    const { res, body } = await json(h.app, '/rpc/validate-token', {
      method: 'POST',
      headers: rpcHeaders,
      body: JSON.stringify({ token: 'not.a.jwt' }),
    });
    expect(res.status).toBe(200);
    expect(body.isValid).toBe(false);
    expect(body.userId).toBe('');
  });

  it('rejects invalid arguments with 400', async () => {
    const { res, body } = await json(h.app, '/rpc/validate-token', {
      method: 'POST',
      headers: rpcHeaders,
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
    expect(Array.isArray(body.message)).toBe(true);
  });

  it('get-user-profile returns the contract profile', async () => {
    const { res, body } = await json(h.app, '/rpc/get-user-profile', {
      method: 'POST',
      headers: rpcHeaders,
      body: JSON.stringify({ userId }),
    });
    expect(res.status).toBe(200);
    expect(body.id).toBe(userId);
    expect(body.email).toBe('alice@example.com');
    expect(typeof body.name).toBe('string');
    expect(typeof body.phone).toBe('string');
    expect(typeof body.avatar).toBe('string');
    expect(body.role).toBe('USER');
    expect(body.isActive).toBe(true);
    expect(typeof body.createdAt).toBe('string');
    expect(Number.isNaN(Date.parse(body.createdAt))).toBe(false);
    expect(body.passwordHash).toBeUndefined();
  });

  it('get-user-profile 404s for unknown users', async () => {
    const { res, body } = await json(h.app, '/rpc/get-user-profile', {
      method: 'POST',
      headers: rpcHeaders,
      body: JSON.stringify({ userId: 'does-not-exist' }),
    });
    expect(res.status).toBe(404);
    expect(body.message).toBe('User not found');
  });
});

// ---------------------------------------------------------------------------
// Contract compatibility with the existing API
// ---------------------------------------------------------------------------

describe('legacy contract compatibility', () => {
  let h: Harness;
  beforeEach(() => {
    h = makeHarness();
  });

  it('login 401 body carries `message` for the frontend ApiError', async () => {
    const { res, body } = await login(h, 'nobody@example.com', 'bad');
    expect(res.status).toBe(401);
    expect(typeof body.message).toBe('string');
    expect(body.statusCode).toBe(401);
  });

  it('login success body matches the frontend LoginSuccessResult', async () => {
    await register(h);
    const { body } = await login(h, 'alice@example.com', 'password123');
    expect(body).toMatchObject({
      success: true,
      user: expect.objectContaining({ email: 'alice@example.com' }),
      accessToken: expect.any(String),
      refreshToken: expect.any(String),
    });
  });

  it('mfa body matches the frontend MfaRequiredResult', async () => {
    await register(h);
    const row = [...h.store.rows.values()][0];
    await h.store.update(row.id, {
      mfaEnabled: true,
      mfaSecret: generateTotpSecret(),
    });
    const { body } = await login(h, 'alice@example.com', 'password123');
    expect(body).toEqual({
      mfaRequired: true,
      mfaToken: expect.any(String),
    });
    expect(Object.keys(body).sort()).toEqual(['mfaRequired', 'mfaToken']);
  });

  it('unknown routes answer with the legacy 404 shape', async () => {
    const { res, body } = await json(h.app, '/auth/does-not-exist');
    expect(res.status).toBe(404);
    expect(body.statusCode).toBe(404);
    expect(body.message).toBe('Cannot GET /auth/does-not-exist');
  });

  it('health route answers without touching the database', async () => {
    const { res, body } = await json(h.app, '/health');
    expect(res.status).toBe(200);
    expect(body.status).toBe('ok');
    expect(body.service).toBe('auth-worker');
  });
});

// ---------------------------------------------------------------------------
// Forgot / reset password (legacy parity)
// ---------------------------------------------------------------------------

describe('forgot/reset password', () => {
  let h: Harness;
  beforeEach(async () => {
    h = makeHarness();
    await register(h);
  });

  it('forgot-password returns the same message for unknown emails (no enumeration)', async () => {
    const { res, body } = await json(h.app, '/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email: 'nobody@example.com' }),
    });
    expect(res.status).toBe(200);
    expect(body.message).toBe('If that email exists, a reset link has been sent');
    expect(body.devResetToken).toBeUndefined();
  });

  it('forgot-password stores a SHA-256 hash (never the raw token) + 1 h expiry', async () => {
    const { res, body } = await json(h.app, '/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email: 'alice@example.com' }),
    });
    expect(res.status).toBe(200);
    expect(body.message).toBe('If that email exists, a reset link has been sent');

    const row = [...h.store.rows.values()][0];
    if (!body.devResetToken) throw new Error('expected devResetToken in non-production');
    expect(row.passwordResetToken).toBeTypeOf('string');
    expect(row.passwordResetToken).not.toBe(body.devResetToken);
    expect(row.passwordResetToken).toMatch(/^[0-9a-f]{64}$/); // sha256 hex
    expect(row.passwordResetExpires).toBeInstanceOf(Date);
    expect(row.passwordResetExpires!.getTime()).toBeGreaterThan(Date.now());
  });

  it('forgot-password rejects an invalid email with 400', async () => {
    const { res } = await json(h.app, '/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email: 'not-an-email' }),
    });
    expect(res.status).toBe(400);
  });

  it('reset-password resets the password, clears the token, and unlocks the account', async () => {
    const forgot = await json(h.app, '/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email: 'alice@example.com' }),
    });

    // Simulate a locked account with failed attempts (the recovery path).
    const row = [...h.store.rows.values()][0];
    await h.store.update(row.id, { isActive: false, failedLoginAttempts: 5 });

    const { res, body } = await json(h.app, '/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token: forgot.body.devResetToken, password: 'newpassword123' }),
    });
    expect(res.status).toBe(200);
    expect(body.message).toBe('Password reset successful');

    const updated = [...h.store.rows.values()][0];
    expect(updated.passwordResetToken).toBeNull();
    expect(updated.passwordResetExpires).toBeNull();
    expect(updated.isActive).toBe(true); // unlocked
    expect(updated.failedLoginAttempts).toBe(0);
    // Old password fails, new one works.
    const oldLogin = await login(h, 'alice@example.com', 'password123');
    expect(oldLogin.res.status).toBe(401);
    const newLogin = await login(h, 'alice@example.com', 'newpassword123');
    expect(newLogin.res.status).toBe(200);
    expect(newLogin.body.success).toBe(true);
  });

  it('reset-password rejects an unknown token with 401', async () => {
    const { res, body } = await json(h.app, '/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token: 'bogus-token', password: 'newpassword123' }),
    });
    expect(res.status).toBe(401);
    expect(body.message).toBe('Invalid or expired reset token');
  });

  it('reset-password rejects an expired token with 401', async () => {
    const forgot = await json(h.app, '/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email: 'alice@example.com' }),
    });
    const row = [...h.store.rows.values()][0];
    await h.store.update(row.id, {
      passwordResetExpires: new Date(Date.now() - 1000),
    });
    const { res } = await json(h.app, '/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token: forgot.body.devResetToken, password: 'newpassword123' }),
    });
    expect(res.status).toBe(401);
  });

  it('reset-password rejects a short password with 400', async () => {
    const forgot = await json(h.app, '/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email: 'alice@example.com' }),
    });
    const { res } = await json(h.app, '/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token: forgot.body.devResetToken, password: 'short' }),
    });
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// MFA management (legacy parity)
// ---------------------------------------------------------------------------

describe('mfa management', () => {
  let h: Harness;
  let token: string;
  let rowId: string;

  beforeEach(async () => {
    h = makeHarness();
    const created = await register(h);
    token = created.body.accessToken as string;
    rowId = [...h.store.rows.values()][0].id;
  });

  const authed = (token: string) => ({ Authorization: `Bearer ${token}` });

  it('status reports mfaEnabled: false and requires auth', async () => {
    const anon = await json(h.app, '/auth/mfa/status');
    expect(anon.res.status).toBe(401);

    const { res, body } = await json(h.app, '/auth/mfa/status', {
      headers: authed(token),
    });
    expect(res.status).toBe(200);
    expect(body.mfaEnabled).toBe(false);
  });

  it('setup persists a secret, returns otpauthUrl, but does NOT enable MFA', async () => {
    const { res, body } = await json(h.app, '/auth/mfa/setup', {
      method: 'POST',
      headers: authed(token),
    });
    expect(res.status).toBe(200);
    expect(typeof body.secret).toBe('string');
    expect(body.otpauthUrl).toContain('otpauth://totp/');
    expect(body.otpauthUrl).toContain(`secret=${body.secret}`);

    const row = [...h.store.rows.values()][0];
    expect(row.mfaSecret).toBe(body.secret);
    expect(row.mfaEnabled).toBe(false); // must verify via enable first
  });

  it('setup conflicts (409) when MFA is already enabled', async () => {
    await h.store.update(rowId, { mfaEnabled: true, mfaSecret: generateTotpSecret() });
    const { res, body } = await json(h.app, '/auth/mfa/setup', {
      method: 'POST',
      headers: authed(token),
    });
    expect(res.status).toBe(409);
    expect(body.message).toBe('Two-factor authentication is already enabled');
  });

  it('enable requires setup first (400), rejects wrong code (401), then enables', async () => {
    const noSetup = await json(h.app, '/auth/mfa/enable', {
      method: 'POST',
      headers: authed(token),
      body: JSON.stringify({ code: '123456' }),
    });
    expect(noSetup.res.status).toBe(400);

    const setup = await json(h.app, '/auth/mfa/setup', {
      method: 'POST',
      headers: authed(token),
    });
    const secret = setup.body.secret as string;

    const wrong = await json(h.app, '/auth/mfa/enable', {
      method: 'POST',
      headers: authed(token),
      body: JSON.stringify({ code: '000000' }),
    });
    expect(wrong.res.status).toBe(401);
    expect(wrong.body.message).toBe('Invalid authentication code');

    const code = await totpAt(secret);
    const ok = await json(h.app, '/auth/mfa/enable', {
      method: 'POST',
      headers: authed(token),
      body: JSON.stringify({ code }),
    });
    expect(ok.res.status).toBe(200);
    expect(ok.body.mfaEnabled).toBe(true);
    expect([...h.store.rows.values()][0].mfaEnabled).toBe(true);

    // And now login demands the second factor.
    const loginRes = await login(h, 'alice@example.com', 'password123');
    expect(loginRes.body.mfaRequired).toBe(true);
  });

  it('enable conflicts (409) when already enabled', async () => {
    const secret = generateTotpSecret();
    await h.store.update(rowId, { mfaEnabled: true, mfaSecret: secret });
    const code = await totpAt(secret);
    const { res } = await json(h.app, '/auth/mfa/enable', {
      method: 'POST',
      headers: authed(token),
      body: JSON.stringify({ code }),
    });
    expect(res.status).toBe(409);
  });

  it('disable requires a valid code, then clears the secret and flag', async () => {
    // Not enabled yet → 409.
    const notEnabled = await json(h.app, '/auth/mfa/disable', {
      method: 'POST',
      headers: authed(token),
      body: JSON.stringify({ code: '123456' }),
    });
    expect(notEnabled.res.status).toBe(409);

    const secret = generateTotpSecret();
    await h.store.update(rowId, { mfaEnabled: true, mfaSecret: secret });

    const wrong = await json(h.app, '/auth/mfa/disable', {
      method: 'POST',
      headers: authed(token),
      body: JSON.stringify({ code: '000000' }),
    });
    expect(wrong.res.status).toBe(401);

    const code = await totpAt(secret);
    const ok = await json(h.app, '/auth/mfa/disable', {
      method: 'POST',
      headers: authed(token),
      body: JSON.stringify({ code }),
    });
    expect(ok.res.status).toBe(200);
    expect(ok.body.mfaEnabled).toBe(false);
    const row = [...h.store.rows.values()][0];
    expect(row.mfaEnabled).toBe(false);
    expect(row.mfaSecret).toBeNull();
  });

  it('mfa/enable rejects a malformed code with 400', async () => {
    await json(h.app, '/auth/mfa/setup', { method: 'POST', headers: authed(token) });
    const { res } = await json(h.app, '/auth/mfa/enable', {
      method: 'POST',
      headers: authed(token),
      body: JSON.stringify({ code: 'ab12cd' }),
    });
    expect(res.status).toBe(400);
  });
});
