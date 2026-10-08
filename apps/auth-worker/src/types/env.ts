/**
 * Cloudflare Worker environment bindings for auth-worker.
 *
 * All bindings declared here must be mirrored in wrangler.jsonc.
 * Types come from @cloudflare/workers-types; no Node-isms allowed.
 */

/** Hyperdrive exposes its managed pool via a standard connection string. */
export interface HyperdriveBinding {
  readonly connectionString: string;
}

export interface Env {
  /** Deployment environment: 'development' | 'staging' | 'production' */
  ENVIRONMENT: string;
  /** HS256 secret for access / MFA-challenge tokens (legacy fallback below). */
  JWT_SECRET: string;
  /** Shared secret required by /rpc/* service-to-service routes (fail-closed). */
  RPC_SECRET: string;
  /** Plain connection string — used until the Hyperdrive binding exists. */
  DATABASE_URL?: string;
  /** Hyperdrive binding (preferred in production). */
  DB?: HyperdriveBinding;
}
