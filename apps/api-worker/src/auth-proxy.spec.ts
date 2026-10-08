/**
 * PHASE 5 — auth proxy tests.
 *
 * Verifies that /auth/* and the legacy /api/auth/* prefix are forwarded to
 * the auth-worker **through the AUTH_WORKER service binding** with the
 * response (status, body, Set-Cookie) passed through, and that a missing or
 * failing binding degrades to a typed 503 instead of hanging or leaking.
 */

import { describe, it, expect } from 'vitest';

import { createApp } from './app';
import type { AuthWorkerService } from './types/env';

const BASE = 'https://api-worker.test';

interface FakeBinding {
  service: AuthWorkerService;
  seen: Request[];
}

function fakeAuthWorker(
  handler: (req: Request) => Response | Promise<Response>,
): FakeBinding {
  const seen: Request[] = [];
  const service: AuthWorkerService = {
    async fetch(req: Request): Promise<Response> {
      seen.push(req);
      return handler(req);
    },
  };
  return { service, seen };
}

async function json(app: ReturnType<typeof createApp>, path: string, init: RequestInit = {}) {
  const res = await app.request(`${BASE}${path}`, init);
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { res, body };
}

// ---------------------------------------------------------------------------
// Forwarding
// ---------------------------------------------------------------------------

describe('auth proxy forwarding', () => {
  it('forwards POST /api/auth/login to the binding as /auth/login', async () => {
    const fake = fakeAuthWorker(
      () =>
        new Response(
          JSON.stringify({ success: true, accessToken: 'tok' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
    );
    const app = createApp({ authWorker: fake.service });

    const payload = JSON.stringify({ email: 'a@b.c', password: 'password123' });
    const { res, body } = await json(app, '/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
    });

    expect(res.status).toBe(200);
    expect(body).toEqual({ success: true, accessToken: 'tok' });

    expect(fake.seen).toHaveLength(1);
    const forwarded = fake.seen[0];
    expect(new URL(forwarded.url).pathname).toBe('/auth/login');
    expect(forwarded.method).toBe('POST');
    expect(await forwarded.text()).toBe(payload);
    expect(forwarded.headers.get('content-type')).toBe('application/json');
  });

  it('forwards the bare /auth/* path too', async () => {
    const fake = fakeAuthWorker(() => Response.json({ ok: true }));
    const app = createApp({ authWorker: fake.service });

    await json(app, '/auth/profile', {
      method: 'GET',
      headers: { Cookie: 'kz_at=abc' },
    });

    expect(new URL(fake.seen[0].url).pathname).toBe('/auth/profile');
    expect(fake.seen[0].headers.get('cookie')).toBe('kz_at=abc');
  });

  it('preserves the query string', async () => {
    const fake = fakeAuthWorker(() => Response.json({ ok: true }));
    const app = createApp({ authWorker: fake.service });

    await json(app, '/api/auth/login?redirect=/dashboard');
    expect(new URL(fake.seen[0].url).search).toBe('?redirect=/dashboard');
  });

  it('passes status, body, and multiple Set-Cookie headers through', async () => {
    const fake = fakeAuthWorker(() => {
      const headers = new Headers({ 'Content-Type': 'application/json' });
      headers.append('Set-Cookie', 'kz_at=access; Path=/; HttpOnly');
      headers.append('Set-Cookie', 'kz_rt=refresh; Path=/; HttpOnly');
      return new Response(JSON.stringify({ success: true, message: 'Registration successful' }), {
        status: 201,
        headers,
      });
    });
    const app = createApp({ authWorker: fake.service });

    const { res } = await json(app, '/api/auth/register', { method: 'POST' });
    expect(res.status).toBe(201);

    const cookies =
      typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
    expect(cookies).toHaveLength(2);
    expect(cookies[0]).toContain('kz_at=access');
    expect(cookies[1]).toContain('kz_rt=refresh');
  });

  it('passes legacy error bodies through untouched', async () => {
    const legacyBody = {
      statusCode: 401,
      timestamp: new Date().toISOString(),
      path: '/auth/login',
      message: 'Invalid credentials',
    };
    const fake = fakeAuthWorker(
      () => new Response(JSON.stringify(legacyBody), { status: 401 }),
    );
    const app = createApp({ authWorker: fake.service });

    const { res, body } = await json(app, '/api/auth/login', { method: 'POST' });
    expect(res.status).toBe(401);
    expect(body).toEqual(legacyBody);
  });

  it('attaches X-Request-Id to the forwarded response', async () => {
    const fake = fakeAuthWorker(() => Response.json({ ok: true }));
    const app = createApp({ authWorker: fake.service });

    const { res } = await json(app, '/auth/profile', {
      headers: { 'X-Request-Id': 'trace-123' },
    });
    expect(res.headers.get('X-Request-Id')).toBe('trace-123');
  });
});

// ---------------------------------------------------------------------------
// Service unavailable / failure behavior
// ---------------------------------------------------------------------------

describe('auth proxy failure behavior', () => {
  it('answers 503 with a legacy body when the binding is missing', async () => {
    const app = createApp({}); // no injected binding …
    const { res, body } = await app.request(
      `${BASE}/auth/login`,
      { method: 'POST' },
      // … and no AUTH_WORKER in the env.
      { ENVIRONMENT: 'test', JWT_SECRET: 'x' } as never,
    ).then(async (r) => ({
      res: r,
      body: await r.json().catch(() => null),
    }));

    expect(res.status).toBe(503);
    expect(body.statusCode).toBe(503);
    expect(body.message).toBe('Auth service unavailable');
    expect(typeof body.timestamp).toBe('string');
  });

  it('answers 503 when the binding throws', async () => {
    const fake = fakeAuthWorker(() => {
      throw new Error('connection reset');
    });
    const app = createApp({ authWorker: fake.service });

    const { res, body } = await json(app, '/api/auth/refresh', { method: 'POST' });
    expect(res.status).toBe(503);
    expect(body.message).toBe('Auth service unavailable');
  });

  it('still serves /health without any auth binding', async () => {
    const app = createApp({});
    const { res, body } = await json(app, '/health');
    expect(res.status).toBe(200);
    expect(body.data.status).toBe('ok');
  });

  it('still 404s unknown routes in the api-worker envelope', async () => {
    const app = createApp({});
    const { res, body } = await json(app, '/finance/transactions');
    expect(res.status).toBe(404);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('NOT_FOUND');
  });
});
