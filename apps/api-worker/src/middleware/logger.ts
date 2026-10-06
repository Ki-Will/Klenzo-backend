import type { Context, Next } from 'hono';
import type { Env } from '../types/env';
import type { RequestIdVariables } from './request-id';

/**
 * Structured logger middleware.
 *
 * Emits a single JSON log line per request via `console.log`, which the
 * Cloudflare Workers runtime forwards to Logpush / Workers Logs.
 *
 * Log shape:
 * ```json
 * {
 *   "level": "info",
 *   "timestamp": "2024-01-01T00:00:00.000Z",
 *   "requestId": "abc-123",
 *   "method": "GET",
 *   "path": "/health",
 *   "status": 200,
 *   "durationMs": 4
 * }
 * ```
 *
 * Usage: `app.use(structuredLogger())`
 */

export type LogLevel = 'info' | 'warn' | 'error';

export interface RequestLogEntry {
  level: LogLevel;
  timestamp: string;
  requestId: string;
  method: string;
  path: string;
  status: number;
  durationMs: number;
}

/**
 * Returns a Hono middleware that logs a structured JSON entry after each
 * request completes.
 */
export function structuredLogger() {
  return async function loggerMiddleware(
    c: Context<{ Bindings: Env; Variables: RequestIdVariables }>,
    next: Next,
  ): Promise<void> {
    const startMs = Date.now();

    await next();

    const durationMs = Date.now() - startMs;
    const status = c.res.status;

    const level: LogLevel = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';

    const entry: RequestLogEntry = {
      level,
      timestamp: new Date().toISOString(),
      // requestId may not be set if requestId middleware runs after logger;
      // always register requestId middleware before structuredLogger.
      requestId: c.get('requestId') ?? 'unknown',
      method: c.req.method,
      path: new URL(c.req.url).pathname,
      status,
      durationMs,
    };

    // console.log is the correct sink in CF Workers — it surfaces in
    // real-time logs (`wrangler tail`) and Logpush pipelines.
    console.log(JSON.stringify(entry));
  };
}
