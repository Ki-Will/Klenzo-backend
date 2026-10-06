import type { Context, Next } from 'hono';
import type { Env } from '../types/env';

/**
 * Request-ID middleware.
 *
 * - Reads the incoming `X-Request-Id` header; if absent, generates a UUID v4.
 * - Stores the id in Hono's context variables: `c.get('requestId')`.
 * - Reflects the id back in the `X-Request-Id` response header so clients
 *   can correlate logs with specific requests.
 *
 * Usage: `app.use(requestId())`
 */

/** Shape of the variables stored in Hono context by this middleware. */
export type RequestIdVariables = {
  requestId: string;
};

/**
 * Generate a RFC-4122 UUID v4 using the Web Crypto API (Workers-compatible,
 * no Node.js dependency).
 */
function generateUUID(): string {
  // crypto.randomUUID() is available in both the CF Workers runtime and
  // modern browsers; it produces a properly formatted UUID v4.
  return crypto.randomUUID();
}

/**
 * Returns a Hono middleware factory that populates `requestId` in context.
 */
export function requestId() {
  return async function requestIdMiddleware(
    c: Context<{ Bindings: Env; Variables: RequestIdVariables }>,
    next: Next,
  ): Promise<void> {
    const incoming = c.req.header('x-request-id');
    const id = incoming && incoming.trim().length > 0 ? incoming.trim() : generateUUID();

    // Make the id available to route handlers and downstream middleware.
    c.set('requestId', id);

    await next();

    // Reflect the id in the response regardless of whether it was generated
    // or forwarded from the client.
    c.header('X-Request-Id', id);
  };
}
