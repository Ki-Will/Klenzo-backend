import path from 'node:path';
import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';

/**
 * Vitest configuration for auth-worker.
 *
 * Runs tests inside the real Workers runtime via `workerd`, so the same
 * crypto, Request/Response, and cookie globals the Worker has in production
 * are what the tests exercise.
 *
 * @see https://developers.cloudflare.com/workers/testing/vitest-integration/
 */
export default defineWorkersConfig({
  resolve: {
    // @klenzo/* libs are consumed through tsconfig paths (tsc) and esbuild
    // (wrangler). Vite needs explicit aliases to resolve them the same way.
    alias: [
      {
        find: /^@klenzo\/(.+)$/,
        replacement: path.resolve(__dirname, '../../libs/$1/src/index.ts'),
      },
    ],
  },

  test: {
    // Run .spec.ts files in the Workers pool.
    include: ['src/**/*.spec.ts'],

    // Pool options are forwarded to @cloudflare/vitest-pool-workers.
    poolOptions: {
      workers: {
        // Point at the wrangler config so the pool uses the same
        // compatibility_date, compatibility_flags, and bindings as production.
        wrangler: {
          configPath: './wrangler.jsonc',
        },
        // Minimal env vars injected into the Workers runtime during tests.
        // Real secrets come from `wrangler secret put` in deployed envs.
        miniflare: {
          bindings: {
            ENVIRONMENT: 'test',
            JWT_SECRET: 'test-only-secret-not-real',
            RPC_SECRET: 'test-only-rpc-secret-not-real',
          },
        },
      },
    },
  },
});
