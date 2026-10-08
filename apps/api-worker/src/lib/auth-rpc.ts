/**
 * Typed service-to-service RPC client for the auth-worker (Phase 5).
 *
 * Replaces the gRPC client: calls go through the AUTH_WORKER service
 * binding's `fetch`, with explicit TypeScript contracts on both sides —
 * inputs validated with @klenzo/validation schemas (the exact schemas the
 * auth-worker validates with) and outputs validated against runtime mirrors
 * of @klenzo/contracts response types.
 *
 * Failure modes are typed:
 *   RpcError            — upstream returned an error / malformed payload
 *   RpcTimeoutError     — call exceeded the deadline
 *   RpcUnavailableError — binding missing or threw
 */

import {
  GetUserProfileResponseSchema,
  GetUserProfileSchema,
  ValidateTokenResponseSchema,
  ValidateTokenSchema,
} from '@klenzo/validation';
// Compile-time contract alignment with the Phase 2 contracts (see checks
// at the bottom of this file).
import type {
  GetUserProfileResponse as ContractGetUserProfileResponse,
  ValidateTokenResponse as ContractValidateTokenResponse,
} from '@klenzo/contracts';

// Runtime-schema types (aliases keep the contract names readable above).
type RpcValidateTokenResponse = import('@klenzo/validation').ValidateTokenResponse;
type RpcGetUserProfileResponse = import('@klenzo/validation').GetUserProfileResponse;

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class RpcError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'RpcError';
  }
}

export class RpcTimeoutError extends RpcError {
  constructor(message: string) {
    super(message);
    this.name = 'RpcTimeoutError';
  }
}

export class RpcUnavailableError extends RpcError {
  constructor(message: string) {
    super(message);
    this.name = 'RpcUnavailableError';
  }
}

// ---------------------------------------------------------------------------
// Transport
// ---------------------------------------------------------------------------

/** The shape of a Workers service binding (`env.AUTH_WORKER`). */
export interface RpcTransport {
  fetch(request: Request): Promise<Response>;
}

export interface AuthRpcConfig {
  /** Shared secret required by the auth-worker's /rpc/* routes. */
  rpcSecret: string;
  /** Deadline for each call (default 2 s). */
  timeoutMs?: number;
}

const RPC_HEADER = 'x-klenzo-rpc-secret';
const DEFAULT_TIMEOUT_MS = 2_000;

async function callRpc(
  transport: RpcTransport,
  path: string,
  body: unknown,
  config: AuthRpcConfig,
): Promise<unknown> {
  const request = new Request(`https://klenzo-auth-worker.internal${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      [RPC_HEADER]: config.rpcSecret,
    },
    body: JSON.stringify(body),
  });

  const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new RpcTimeoutError(`auth RPC ${path} timed out after ${timeoutMs}ms`)),
      timeoutMs,
    );
  });

  let res: Response;
  try {
    res = await Promise.race([transport.fetch(request), deadline]);
  } catch (err) {
    if (err instanceof RpcError) throw err; // deadline fired
    throw new RpcUnavailableError(
      `auth RPC ${path} failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }

  if (!res.ok) {
    let message = `auth RPC ${path} returned ${res.status}`;
    try {
      const errorBody = (await res.json()) as { message?: string | string[] };
      if (Array.isArray(errorBody?.message)) message = errorBody.message.join(', ');
      else if (typeof errorBody?.message === 'string') message = errorBody.message;
    } catch {
      // keep the generic message
    }
    throw new RpcError(message, res.status);
  }

  try {
    return await res.json();
  } catch {
    throw new RpcError(`auth RPC ${path} returned malformed JSON`, res.status);
  }
}

// ---------------------------------------------------------------------------
// Methods
// ---------------------------------------------------------------------------

/** POST /rpc/validate-token — verify an access token and get claims back. */
export async function validateToken(
  transport: RpcTransport,
  token: string,
  config: AuthRpcConfig,
): Promise<RpcValidateTokenResponse> {
  const input = ValidateTokenSchema.safeParse({ token });
  if (!input.success) {
    throw new RpcError(
      `invalid arguments: ${input.error.issues.map((i) => i.message).join(', ')}`,
    );
  }

  const raw = await callRpc(transport, '/rpc/validate-token', input.data, config);
  const parsed = ValidateTokenResponseSchema.safeParse(raw);
  if (!parsed.success) {
    throw new RpcError('auth RPC validate-token returned an invalid response shape');
  }
  return parsed.data;
}

/** POST /rpc/get-user-profile — identity lookup by user id. */
export async function getUserProfile(
  transport: RpcTransport,
  userId: string,
  config: AuthRpcConfig,
): Promise<RpcGetUserProfileResponse> {
  const input = GetUserProfileSchema.safeParse({ userId });
  if (!input.success) {
    throw new RpcError(
      `invalid arguments: ${input.error.issues.map((i) => i.message).join(', ')}`,
    );
  }

  const raw = await callRpc(transport, '/rpc/get-user-profile', input.data, config);
  const parsed = GetUserProfileResponseSchema.safeParse(raw);
  if (!parsed.success) {
    throw new RpcError('auth RPC get-user-profile returned an invalid response shape');
  }
  return parsed.data;
}

// ---------------------------------------------------------------------------
// Compile-time contract alignment (checked by `nx typecheck`)
// ---------------------------------------------------------------------------

const _contractValidateToken: ContractValidateTokenResponse =
  {} as RpcValidateTokenResponse;
const _contractValidateTokenReverse: RpcValidateTokenResponse =
  {} as ContractValidateTokenResponse;
const _contractGetUserProfile: ContractGetUserProfileResponse =
  {} as RpcGetUserProfileResponse;
const _contractGetUserProfileReverse: RpcGetUserProfileResponse =
  {} as ContractGetUserProfileResponse;
void _contractValidateToken;
void _contractValidateTokenReverse;
void _contractGetUserProfile;
void _contractGetUserProfileReverse;
