/**
 * auth-worker application factory.
 *
 * `createApp(deps)` returns the fully wired Hono app; tests inject an
 * in-memory store directly, while src/index.ts wires the Prisma-backed one
 * from the Worker env.
 */

import { Hono } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

import type { AppEnv, Deps } from './types/deps';
import { HttpError, legacyErrorBody } from './lib/http';
import { authRoutes } from './routes/auth';
import { rpcRoutes } from './routes/rpc';

export function createApp(deps: Deps): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  // Liveness probe — no database access, always answers.
  app.get('/health', (c) =>
    c.json({
      status: 'ok',
      service: 'auth-worker',
      timestamp: new Date().toISOString(),
    }),
  );

  app.route('/auth', authRoutes(deps));
  app.route('/rpc', rpcRoutes(deps));

  // Legacy-shaped 404 — NestJS: "Cannot METHOD /path".
  app.notFound((c) => {
    const path = new URL(c.req.url).pathname;
    return c.json(
      legacyErrorBody(404, `Cannot ${c.req.method} ${path}`, path),
      404,
    );
  });

  // Legacy-shaped error handler — mirrors AllExceptionsFilter.
  app.onError((err, c) => {
    const path = new URL(c.req.url).pathname;

    if (err instanceof HttpError) {
      return c.json(
        legacyErrorBody(err.status, err.messages, path),
        err.status as ContentfulStatusCode,
      );
    }

    console.error(
      JSON.stringify({
        level: 'error',
        timestamp: new Date().toISOString(),
        path,
        message: err.message,
        stack: err.stack,
      }),
    );
    return c.json(legacyErrorBody(500, 'Internal server error', path), 500);
  });

  return app;
}
