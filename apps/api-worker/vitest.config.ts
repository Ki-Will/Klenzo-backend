import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';

/**
 * Vitest configuration for api-worker.
 *
 * Uses @cloudflare/vitest-pool-workers to run tests inside the real Workers
 * runtime via `workerd`, giving tests access to the same globals the Worker
 * has in production (crypto, Request, Response, ExecutionContext, etc.).
 *
 * @see https://developers.cloudflare.com/workers/testing/vitest-integration/
 */
export default defineWorkersConfig({
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
        // Secrets referenced in index.ts that are NOT in wrangler.jsonc vars
        // must be provided here so the Worker can start without throwing.
        miniflare: {
          bindings: {
            ENVIRONMENT: 'test',
            JWT_SECRET: 'test-only-secret-not-real',
          },
        },
      },
    },
  },
});
