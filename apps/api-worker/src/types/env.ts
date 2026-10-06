/**
 * Cloudflare Worker environment bindings for api-worker.
 *
 * All bindings declared here must be mirrored in wrangler.jsonc.
 * Types come from @cloudflare/workers-types; no Node-isms allowed.
 */

// ---------------------------------------------------------------------------
// Hyperdrive placeholder — import the real type when the binding is wired up.
// ---------------------------------------------------------------------------
// import type { Hyperdrive } from '@cloudflare/workers-types';
export type HyperdriveBinding = {
  readonly connectionString: string;
};

// ---------------------------------------------------------------------------
// Service-binding interfaces — each bound Worker exposes its own fetch.
// ---------------------------------------------------------------------------
export interface AuthWorkerService {
  fetch(request: Request): Promise<Response>;
}

// ---------------------------------------------------------------------------
// Main Env interface — referenced as the second type parameter of Hono<{ Bindings: Env }>.
// ---------------------------------------------------------------------------
export interface Env {
  // ----- Vars / Secrets -----
  /** Deployment environment: 'development' | 'staging' | 'production' */
  ENVIRONMENT: string;
  /** HS256/RS256 secret used for JWT verification */
  JWT_SECRET: string;

  // ----- Service Bindings -----
  /** Bound auth-worker service — call via env.AUTH_WORKER.fetch() */
  AUTH_WORKER: Service;

  // ----- KV Namespaces (add when needed) -----
  // CACHE_KV: KVNamespace;

  // ----- Durable Objects (add when needed) -----
  // RATE_LIMITER: DurableObjectNamespace;

  // ----- Hyperdrive (add when needed) -----
  // DB: HyperdriveBinding;

  // ----- R2 Buckets (add when needed) -----
  // UPLOADS_BUCKET: R2Bucket;

  // ----- Queues (add when needed) -----
  // NOTIFICATION_QUEUE: Queue;
}
