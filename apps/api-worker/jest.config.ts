/**
 * Jest configuration for api-worker (Nx compatibility shim).
 *
 * The Workers runtime tests live in vitest.config.ts and run via
 * `@cloudflare/vitest-pool-workers`.  Jest cannot execute code inside the
 * Workers runtime, so this config is intentionally scoped to any future
 * pure-Node utility tests (helpers, pure functions, type-level tests) that
 * do NOT depend on CF globals.
 *
 * If you add such tests, name them `*.node.spec.ts` and they will be picked
 * up here automatically without affecting the Workers pool.
 *
 * The Nx @nx/jest plugin discovers this file and registers `test` and
 * `test:node` targets for the api-worker project.
 */
export default {
  displayName: 'api-worker',
  // Inherit global Nx jest preset (transform, module name mapper, etc.)
  preset: '../../jest.preset.js',
  // Standard Node environment — no browser or Workers globals needed here.
  testEnvironment: 'node',
  // Only match *.node.spec.ts files so Workers-runtime tests are not
  // accidentally run under Jest (they will fail without workerd).
  testMatch: ['**/*.node.spec.[jt]s'],
  transform: {
    '^.+\\.[tj]s$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.app.json',
        // ts-jest should not try to emit declaration files.
        diagnostics: {
          ignoreCodes: ['TS151001'],
        },
      },
    ],
  },
  // Point coverage output to the monorepo-standard location.
  coverageDirectory: '../../coverage/apps/api-worker',
  // No tests initially — Nx `passWithNoTests` handles this gracefully.
  passWithNoTests: true,
};
