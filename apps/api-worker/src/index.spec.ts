/**
 * Unit tests for api-worker routes.
 *
 * Runtime: @cloudflare/vitest-pool-workers — executes inside the actual
 * Workers runtime so `crypto.randomUUID()`, `Request`, `Response`, etc. are
 * all the real globals (no polyfills needed).
 */
import { describe, it, expect } from 'vitest';

// Import the worker under test.  The pool-workers environment evaluates the
// module in the Workers runtime so all CF globals are available.
import worker from './index';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimal Env stub — only the fields the routes actually read. */
const mockEnv = {
  ENVIRONMENT: 'test',
  JWT_SECRET: 'test-secret',
  AUTH_WORKER: {} as Service,
} satisfies Record<string, unknown>;

/**
 * Convenience wrapper: dispatch a request against the worker and return the
 * parsed JSON body along with the raw Response for header / status assertions.
 */
async function fetch(path: string, init?: RequestInit): Promise<{ res: Response; body: unknown }> {
  const req = new Request(`https://api-worker.example.com${path}`, init);
  const res = await worker.fetch(req, mockEnv as never, {} as ExecutionContext);
  const body = await res.json();
  return { res, body };
}

// ---------------------------------------------------------------------------
// GET /health
// ---------------------------------------------------------------------------
describe('GET /health', () => {
  it('returns HTTP 200', async () => {
    const { res } = await fetch('/health');
    expect(res.status).toBe(200);
  });

  it('returns { success: true, data.status: "ok" }', async () => {
    const { body } = await fetch('/health');
    const b = body as Record<string, unknown>;
    expect(b.success).toBe(true);
    const data = b.data as Record<string, unknown>;
    expect(data.status).toBe('ok');
  });

  it('includes a valid ISO timestamp in data', async () => {
    const { body } = await fetch('/health');
    const data = (body as Record<string, unknown>).data as Record<string, unknown>;
    expect(typeof data.timestamp).toBe('string');
    expect(() => new Date(data.timestamp as string)).not.toThrow();
    expect(Number.isNaN(new Date(data.timestamp as string).getTime())).toBe(false);
  });

  it('echoes requestId in data and X-Request-Id header', async () => {
    const { res, body } = await fetch('/health');
    const data = (body as Record<string, unknown>).data as Record<string, unknown>;
    const headerReqId = res.headers.get('X-Request-Id');
    expect(typeof data.requestId).toBe('string');
    expect((data.requestId as string).length).toBeGreaterThan(0);
    expect(data.requestId).toBe(headerReqId);
  });

  it('uses a client-supplied X-Request-Id when present', async () => {
    const clientId = 'my-trace-id-abc-123';
    const { res, body } = await fetch('/health', {
      headers: { 'X-Request-Id': clientId },
    });
    const data = (body as Record<string, unknown>).data as Record<string, unknown>;
    expect(data.requestId).toBe(clientId);
    expect(res.headers.get('X-Request-Id')).toBe(clientId);
  });
});

// ---------------------------------------------------------------------------
// GET /version
// ---------------------------------------------------------------------------
describe('GET /version', () => {
  it('returns HTTP 200', async () => {
    const { res } = await fetch('/version');
    expect(res.status).toBe(200);
  });

  it('returns { success: true, data.version: "1.0.0" }', async () => {
    const { body } = await fetch('/version');
    const b = body as Record<string, unknown>;
    expect(b.success).toBe(true);
    const data = b.data as Record<string, unknown>;
    expect(data.version).toBe('1.0.0');
  });

  it('returns service name "api-worker"', async () => {
    const { body } = await fetch('/version');
    const data = (body as Record<string, unknown>).data as Record<string, unknown>;
    expect(data.service).toBe('api-worker');
  });

  it('returns environment from env bindings', async () => {
    const { body } = await fetch('/version');
    const data = (body as Record<string, unknown>).data as Record<string, unknown>;
    expect(data.environment).toBe('test');
  });

  it('sets X-Request-Id response header', async () => {
    const { res } = await fetch('/version');
    const reqId = res.headers.get('X-Request-Id');
    expect(typeof reqId).toBe('string');
    expect((reqId ?? '').length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 404 handler
// ---------------------------------------------------------------------------
describe('404 — unknown routes', () => {
  it('returns HTTP 404', async () => {
    const { res } = await fetch('/does-not-exist');
    expect(res.status).toBe(404);
  });

  it('returns { success: false, error.code: "NOT_FOUND" }', async () => {
    const { body } = await fetch('/does-not-exist');
    const b = body as Record<string, unknown>;
    expect(b.success).toBe(false);
    const error = b.error as Record<string, unknown>;
    expect(error.code).toBe('NOT_FOUND');
  });

  it('includes a requestId in the 404 response', async () => {
    const { body } = await fetch('/missing');
    const b = body as Record<string, unknown>;
    expect(typeof b.requestId).toBe('string');
    expect((b.requestId as string).length).toBeGreaterThan(0);
  });

  it('includes a timestamp in the 404 response', async () => {
    const { body } = await fetch('/missing');
    const b = body as Record<string, unknown>;
    expect(typeof b.timestamp).toBe('string');
    expect(Number.isNaN(new Date(b.timestamp as string).getTime())).toBe(false);
  });
});
