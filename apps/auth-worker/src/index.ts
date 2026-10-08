/**
 * auth-worker — Cloudflare Worker entrypoint (Phase 4).
 *
 * Wires the real Prisma-backed user store from the env (Hyperdrive binding or
 * DATABASE_URL secret) and exports the standard module fetch handler.
 */

import { getCachedClient } from '@klenzo/database';

import type { Hono } from 'hono';

import { createApp } from './app';
import { lazyUserStore, prismaUserStore } from './lib/store';
import type { AppEnv, Deps } from './types/deps';
import type { Env } from './types/env';

function resolveDeps(env: Env): Deps {
  return {
    // Lazy: /health works even before a database is configured; the first
    // query surfaces a clear error via the legacy 500 body.
    store: lazyUserStore(() => {
      const connectionString = env.DB?.connectionString ?? env.DATABASE_URL;
      if (!connectionString) {
        throw new Error(
          'No database configured: bind Hyperdrive (DB) or set the DATABASE_URL secret',
        );
      }
      return prismaUserStore(getCachedClient(connectionString));
    }),
    jwtSecret: env.JWT_SECRET || 'KlenzoSecret',
    rpcSecret: env.RPC_SECRET ?? '',
    secureCookies: env.ENVIRONMENT === 'production',
  };
}

// One app instance per env object (Workers reuse the env across requests).
const apps = new WeakMap<object, Hono<AppEnv>>();

function appFor(env: Env): Hono<AppEnv> {
  let app = apps.get(env);
  if (!app) {
    app = createApp(resolveDeps(env));
    apps.set(env, app);
  }
  return app;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return appFor(env).fetch(request, env, ctx);
  },
} satisfies ExportedHandler<Env>;
