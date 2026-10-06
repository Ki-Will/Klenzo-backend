import type { PrismaClient } from '@prisma/client';
import { getCachedClient } from './client.js';

// ── Hyperdrive binding type ──────────────────────────────────────────────────

/**
 * Matches the Cloudflare Hyperdrive runtime binding interface.
 *
 * In `wrangler.toml` you declare:
 * ```toml
 * [[hyperdrive]]
 * binding = "DB"
 * id = "<your-hyperdrive-config-id>"
 * ```
 *
 * At runtime the Worker receives the binding as an object with this shape.
 * The connection string is a fully-formed PostgreSQL URL that routes through
 * Hyperdrive's connection pooler.
 */
export interface HyperdriveBinding {
  readonly connectionString: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Extracts the connection string from a Hyperdrive binding.
 *
 * Keeping this as a thin wrapper enables easy mocking in tests and clear
 * intent at the call site.
 */
export function getConnectionString(hyperdrive: HyperdriveBinding): string {
  return hyperdrive.connectionString;
}

/**
 * Creates (or returns a cached) PrismaClient configured to use the given
 * Hyperdrive binding.
 *
 * Usage in a Worker handler:
 * ```ts
 * export default {
 *   async fetch(request, env) {
 *     const prisma = createClientFromHyperdrive(env.DB)
 *     // ...
 *   }
 * }
 * ```
 */
export function createClientFromHyperdrive(hyperdrive: HyperdriveBinding): PrismaClient {
  const connectionString = getConnectionString(hyperdrive);
  return getCachedClient(connectionString);
}
