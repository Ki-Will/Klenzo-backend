/**
 * Shared dependency and Hono generics for auth-worker.
 *
 * The app is built by `createApp(deps)` so tests can inject an in-memory
 * user store while the Worker entrypoint wires the real Prisma-backed one.
 */

import type { Env } from './env';
import type { UserStore } from '../lib/store';

export interface Deps {
  /** User persistence (Prisma in production, in-memory in tests). */
  store: UserStore;
  /** HS256 secret for access / MFA-challenge tokens. */
  jwtSecret: string;
  /** Shared secret guarding /rpc/* routes. Empty ⇒ every RPC call is rejected. */
  rpcSecret: string;
  /** `Secure` cookie attribute — true only in production. */
  secureCookies: boolean;
}

/** Hono generic: bindings from wrangler + per-request authenticated user. */
export type AppEnv = {
  Bindings: Env;
  Variables: {
    authUser: import('../lib/store').UserRecord;
  };
};
