/**
 * Auth proxy — Phase 5 service-binding transport.
 *
 * The frontend's requests arrive at api-worker either as `/api/auth/*`
 * (legacy NestJS global prefix, used by the Next.js `/backend` rewrite) or
 * `/auth/*`.  Either way they are forwarded to the auth-worker **through the
 * AUTH_WORKER service binding** — never over public HTTP or gRPC — and the
 * auth-worker's response (status, body, Set-Cookie) is passed through
 * untouched so legacy cookies and error shapes stay intact.
 */

import { Hono } from 'hono';

import type { Env, AuthWorkerService } from '../types/env';
import type { RequestIdVariables } from '../middleware/request-id';
import type { AppDeps } from '../types/deps';

type App = Hono<{ Bindings: Env; Variables: RequestIdVariables }>;

function unavailableBody(path: string) {
  return {
    statusCode: 503,
    timestamp: new Date().toISOString(),
    path,
    message: 'Auth service unavailable',
  };
}

export function authProxyRoutes(deps: AppDeps): App {
  const app = new Hono<{ Bindings: Env; Variables: RequestIdVariables }>();

  app.all('/*', async (c) => {
    const binding: AuthWorkerService | undefined =
      deps.authWorker ?? (c.env?.AUTH_WORKER as AuthWorkerService | undefined);

    if (!binding || typeof binding.fetch !== 'function') {
      return c.json(unavailableBody(c.req.path), 503);
    }

    const url = new URL(c.req.url);
    // Strip the legacy `/api` global prefix — the auth-worker serves /auth/*.
    const forwardPath = url.pathname.startsWith('/api/')
      ? url.pathname.slice('/api'.length)
      : url.pathname;

    const headers = new Headers(c.req.raw.headers);
    headers.delete('host');

    const hasBody =
      c.req.method !== 'GET' && c.req.method !== 'HEAD' && c.req.method !== 'OPTIONS';
    const target = new Request(
      `https://klenzo-auth-worker.internal${forwardPath}${url.search}`,
      {
        method: c.req.method,
        headers,
        ...(hasBody ? { body: await c.req.raw.arrayBuffer() } : {}),
      },
    );

    try {
      const res = await binding.fetch(target);
      // Copy into a fresh (mutable) Response so downstream middleware can
      // add headers (X-Request-Id); the header list copy preserves every
      // Set-Cookie entry.
      return new Response(res.body, {
        status: res.status,
        statusText: res.statusText,
        headers: res.headers,
      });
    } catch {
      return c.json(unavailableBody(c.req.path), 503);
    }
  });

  return app;
}
