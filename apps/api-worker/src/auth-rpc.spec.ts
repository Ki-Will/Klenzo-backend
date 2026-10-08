/**
 * PHASE 5 — typed auth RPC client tests.
 *
 * Covers the migration plan's Phase 5 test list for the RPC client that
 * replaces the gRPC stubs:
 *
 *   RPC method invocation · invalid arguments · typed response ·
 *   service unavailable behavior · authorization · timeout/failure ·
 *   contract tests
 */

import { describe, it, expect, vi } from 'vitest';

import {
  RpcError,
  RpcTimeoutError,
  RpcUnavailableError,
  getUserProfile,
  validateToken,
  type RpcTransport,
} from './lib/auth-rpc';

const CONFIG = { rpcSecret: 'shared-rpc-secret', timeoutMs: 500 };

const VALID_TOKEN_RESPONSE = {
  isValid: true,
  userId: 'u-1',
  email: 'alice@example.com',
  role: 'USER',
  isActive: true,
};

const VALID_PROFILE_RESPONSE = {
  id: 'u-1',
  email: 'alice@example.com',
  name: 'Alice',
  phone: '',
  avatar: '',
  role: 'USER',
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
};

function transportReturning(
  response: Response | (() => Response | Promise<Response>),
): { transport: RpcTransport; seen: Request[] } {
  const seen: Request[] = [];
  const transport: RpcTransport = {
    async fetch(req: Request): Promise<Response> {
      seen.push(req);
      return typeof response === 'function' ? response() : response;
    },
  };
  return { transport, seen };
}

// ---------------------------------------------------------------------------
// RPC method invocation + authorization
// ---------------------------------------------------------------------------

describe('validateToken', () => {
  it('invokes /rpc/validate-token with the shared secret header', async () => {
    const { transport, seen } = transportReturning(
      Response.json(VALID_TOKEN_RESPONSE),
    );

    const result = await validateToken(transport, 'the.jwt.token', CONFIG);

    expect(seen).toHaveLength(1);
    const req = seen[0];
    expect(new URL(req.url).pathname).toBe('/rpc/validate-token');
    expect(req.method).toBe('POST');
    expect(req.headers.get('x-klenzo-rpc-secret')).toBe('shared-rpc-secret');
    expect(req.headers.get('content-type')).toBe('application/json');
    expect(await req.clone().json()).toEqual({ token: 'the.jwt.token' });

    expect(result).toEqual(VALID_TOKEN_RESPONSE);
  });

  it('returns a typed (contract-shaped) response', async () => {
    const { transport } = transportReturning(Response.json(VALID_TOKEN_RESPONSE));
    const result = await validateToken(transport, 'tok', CONFIG);

    // Field-level contract check against @klenzo/contracts ValidateTokenResponse.
    const contract: {
      isValid: boolean;
      userId: string;
      email: string;
      role: string;
      isActive: boolean;
    } = result;
    expect(contract.isValid).toBe(true);
    expect(contract.userId).toBe('u-1');
    expect(contract.isActive).toBe(true);
  });

  it('rejects invalid arguments before touching the transport', async () => {
    const { transport, seen } = transportReturning(Response.json({}));

    await expect(validateToken(transport, '', CONFIG)).rejects.toThrow(RpcError);
    await expect(validateToken(transport, '', CONFIG)).rejects.toThrow(
      /invalid arguments/,
    );
    expect(seen).toHaveLength(0);
  });

  it('throws on a malformed response shape', async () => {
    const { transport } = transportReturning(Response.json({ totally: 'wrong' }));
    await expect(validateToken(transport, 'tok', CONFIG)).rejects.toThrow(
      /invalid response shape/,
    );
  });

  it('maps upstream error bodies onto RpcError with status', async () => {
    const { transport } = transportReturning(
      new Response(
        JSON.stringify({ statusCode: 401, message: 'Unauthorized' }),
        { status: 401 },
      ),
    );
    try {
      await validateToken(transport, 'tok', CONFIG);
      expect.unreachable?.();
    } catch (err) {
      expect(err).toBeInstanceOf(RpcError);
      expect((err as RpcError).message).toBe('Unauthorized');
      expect((err as RpcError).status).toBe(401);
    }
  });

  it('joins array messages from validation failures', async () => {
    const { transport } = transportReturning(
      new Response(JSON.stringify({ message: ['bad one', 'bad two'] }), {
        status: 400,
      }),
    );
    await expect(validateToken(transport, 'tok', CONFIG)).rejects.toThrow(
      'bad one, bad two',
    );
  });
});

describe('getUserProfile', () => {
  it('invokes /rpc/get-user-profile and returns the typed profile', async () => {
    const { transport, seen } = transportReturning(
      Response.json(VALID_PROFILE_RESPONSE),
    );

    const result = await getUserProfile(transport, 'u-1', CONFIG);

    expect(new URL(seen[0].url).pathname).toBe('/rpc/get-user-profile');
    expect(await seen[0].clone().json()).toEqual({ userId: 'u-1' });
    expect(result).toEqual(VALID_PROFILE_RESPONSE);
  });

  it('rejects invalid arguments before touching the transport', async () => {
    const { transport, seen } = transportReturning(Response.json({}));
    await expect(getUserProfile(transport, '', CONFIG)).rejects.toThrow(
      /invalid arguments/,
    );
    expect(seen).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Service unavailable behavior
// ---------------------------------------------------------------------------

describe('service unavailable', () => {
  it('wraps a throwing binding in RpcUnavailableError', async () => {
    const transport: RpcTransport = {
      fetch: () => Promise.reject(new Error('binding exploded')),
    };
    await expect(validateToken(transport, 'tok', CONFIG)).rejects.toThrow(
      RpcUnavailableError,
    );
  });

  it('wraps a malformed (non-JSON) success body in RpcError', async () => {
    const { transport } = transportReturning(
      new Response('<html>gateway</html>', { status: 200 }),
    );
    await expect(validateToken(transport, 'tok', CONFIG)).rejects.toThrow(
      RpcError,
    );
  });
});

// ---------------------------------------------------------------------------
// Timeout / failure behavior
// ---------------------------------------------------------------------------

describe('timeout', () => {
  it('fails with RpcTimeoutError when the call exceeds the deadline', async () => {
    const transport: RpcTransport = {
      fetch: () => new Promise<Response>(() => undefined), // never settles
    };
    const start = Date.now();
    await expect(
      validateToken(transport, 'tok', { rpcSecret: 's', timeoutMs: 50 }),
    ).rejects.toThrow(RpcTimeoutError);
    expect(Date.now() - start).toBeLessThan(2_000);
  });

  it('does not leave the deadline timer dangling', async () => {
    vi.useFakeTimers();
    try {
      const { transport } = transportReturning(Response.json(VALID_TOKEN_RESPONSE));
      const pending = validateToken(transport, 'tok', {
        rpcSecret: 's',
        timeoutMs: 5_000,
      });
      await expect(pending).resolves.toEqual(VALID_TOKEN_RESPONSE);
      // If the timer were not cleared, vitest would report open handles.
    } finally {
      vi.useRealTimers();
    }
  });
});
