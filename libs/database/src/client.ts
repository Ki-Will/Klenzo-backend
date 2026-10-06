import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

export type { PrismaClient } from '@prisma/client';

// ── Factory ─────────────────────────────────────────────────────────────────

/**
 * Creates a new PrismaClient backed by the pg adapter.
 *
 * The adapter accepts a connection string directly — Hyperdrive exposes its
 * managed pool via `hyperdrive.connectionString`, which is a standard
 * PostgreSQL connection string.  We do NOT use `pg.Pool` directly; Hyperdrive
 * manages the pool on its side.
 *
 * Important: The adapter path (`@prisma/adapter-pg`) is required inside
 * Cloudflare Workers because the default PrismaClient uses Node.js `net`
 * module which is unavailable in the Workers runtime.
 */
export function createPrismaClient(connectionString: string): PrismaClient {
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0]);
}

// ── Singleton cache ──────────────────────────────────────────────────────────

/**
 * Module-level cache: connection-string → PrismaClient.
 *
 * Workers are long-lived processes that handle many requests; creating a new
 * PrismaClient on every request is wasteful and can exhaust connections.
 * One instance per unique connection string covers the Hyperdrive case where
 * the string may differ per environment or binding.
 */
const clientCache = new Map<string, PrismaClient>();

/**
 * Returns a cached PrismaClient for the given connection string, creating one
 * on first call.  Safe to call from the Worker `fetch` handler.
 */
export function getCachedClient(connectionString: string): PrismaClient {
  let client = clientCache.get(connectionString);
  if (!client) {
    client = createPrismaClient(connectionString);
    clientCache.set(connectionString, client);
  }
  return client;
}
