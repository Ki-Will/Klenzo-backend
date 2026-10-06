import type { PrismaClient } from '@prisma/client';

export interface DatabaseHealthResult {
  ok: boolean;
  latencyMs: number;
}

/**
 * Probes the database with a lightweight `SELECT 1` query and measures
 * round-trip latency.
 *
 * Returns `{ ok: true, latencyMs }` on success, or `{ ok: false, latencyMs }`
 * on failure (the error is swallowed so callers can expose health endpoints
 * without leaking internal error details).
 *
 * @example
 * // In a Worker health-check route:
 * const health = await checkDatabaseConnection(prisma)
 * return new Response(JSON.stringify(health), {
 *   status: health.ok ? 200 : 503,
 * })
 */
export async function checkDatabaseConnection(
  prisma: PrismaClient,
): Promise<DatabaseHealthResult> {
  const start = Date.now();
  try {
    // $queryRaw is available on both regular PrismaClient and transaction clients.
    // `SELECT 1` is the lightest possible probe — one round-trip, no table scan.
    await prisma.$queryRaw`SELECT 1`;
    return { ok: true, latencyMs: Date.now() - start };
  } catch {
    return { ok: false, latencyMs: Date.now() - start };
  }
}
