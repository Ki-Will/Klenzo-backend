/**
 * Dependency injection for api-worker's app factory.
 *
 * Tests pass a fake auth-worker service; production resolves the binding
 * from `env.AUTH_WORKER` per request.
 */

import type { AuthWorkerService } from './env';

export interface AppDeps {
  /** Test injection for the AUTH_WORKER service binding. */
  authWorker?: AuthWorkerService;
}
