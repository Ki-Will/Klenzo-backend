import { Hono } from 'hono';
import { cors } from 'hono/cors';

import { requestId } from './middleware/request-id';
import { structuredLogger } from './middleware/logger';
import { errorResponse, successResponse } from './types/responses';
import type { Env } from './types/env';
import type { RequestIdVariables } from './middleware/request-id';

// ---------------------------------------------------------------------------
// App type — binds the Env and Variables generics so every handler is typed.
// ---------------------------------------------------------------------------
type AppVariables = RequestIdVariables;

const app = new Hono<{ Bindings: Env; Variables: AppVariables }>();

// ---------------------------------------------------------------------------
// Global middleware (order matters: requestId → logger → cors)
// ---------------------------------------------------------------------------

// 1. Attach / generate a request id first so the logger can include it.
app.use('*', requestId());

// 2. Log after the response is built (runs next() then logs).
app.use('*', structuredLogger());

// 3. CORS — allow any origin in development; tighten per-env in wrangler.jsonc
//    or by reading env.ENVIRONMENT at runtime.
app.use(
  '*',
  cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
    exposeHeaders: ['X-Request-Id'],
    maxAge: 86400,
    credentials: false,
  }),
);

// ---------------------------------------------------------------------------
// Health route
// ---------------------------------------------------------------------------
app.get('/health', (c) => {
  const reqId = c.get('requestId');
  return c.json(
    successResponse(
      {
        status: 'ok',
        timestamp: new Date().toISOString(),
        requestId: reqId,
      },
      reqId,
    ),
    200,
  );
});

// ---------------------------------------------------------------------------
// Version route
// ---------------------------------------------------------------------------
app.get('/version', (c) => {
  const reqId = c.get('requestId');
  return c.json(
    successResponse(
      {
        version: '1.0.0',
        service: 'api-worker',
        environment: c.env.ENVIRONMENT,
      },
      reqId,
    ),
    200,
  );
});

// ---------------------------------------------------------------------------
// 404 handler — catches any request that didn't match a registered route.
// ---------------------------------------------------------------------------
app.notFound((c) => {
  const reqId = c.get('requestId') ?? 'unknown';
  return c.json(
    errorResponse(
      'NOT_FOUND',
      `Route ${c.req.method} ${new URL(c.req.url).pathname} not found`,
      reqId,
    ),
    404,
  );
});

// ---------------------------------------------------------------------------
// Global error handler — catches unhandled errors thrown in route handlers.
// ---------------------------------------------------------------------------
app.onError((err, c) => {
  const reqId = c.get('requestId') ?? 'unknown';

  // Log the full error to Workers Logs for post-mortem investigation.
  console.error(
    JSON.stringify({
      level: 'error',
      timestamp: new Date().toISOString(),
      requestId: reqId,
      message: err.message,
      stack: err.stack,
    }),
  );

  return c.json(
    errorResponse(
      'INTERNAL_SERVER_ERROR',
      'An unexpected error occurred',
      reqId,
    ),
    500,
  );
});

// ---------------------------------------------------------------------------
// Worker export — standard CF Workers module syntax.
// ---------------------------------------------------------------------------
export default {
  fetch: app.fetch,
} satisfies ExportedHandler<Env>;
