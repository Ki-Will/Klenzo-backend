/**
 * Internal RPC routes — the Phase 4/5 service-to-service surface.
 *
 * Called by api-worker through the AUTH_WORKER service binding (never over
 * public HTTP).  Guarded by the shared `RPC_SECRET` (fail-closed: routes
 * reject everything when the secret is unset).
 *
 *   POST /rpc/validate-token    {token}                → ValidateTokenResponse
 *   POST /rpc/get-user-profile  {userId}               → GetUserProfileResponse
 *
 * Request bodies are validated with @klenzo/validation schemas — the exact
 * same schemas the api-worker client validates with — so the wire shape can
 * never drift between the two workers (replaces the gRPC proto surface).
 */

import { Hono } from 'hono';
import {
  GetUserProfileSchema,
  ValidateTokenSchema,
} from '@klenzo/validation';

import type { AppEnv, Deps } from '../types/deps';
import { HttpError, readJson } from '../lib/http';
import { verifyAccessToken } from '../lib/session';

function zodMessages(error: { issues: Array<{ message: string }> }): string[] {
  return error.issues.map((i) => i.message);
}

const INVALID_TOKEN_RESPONSE = {
  isValid: false,
  userId: '',
  email: '',
  role: '',
  isActive: false,
} as const;

export function rpcRoutes(deps: Deps): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  // ── Service-to-service authorization ──────────────────────────────────────
  app.use('*', async (c, next) => {
    const provided = c.req.header('x-klenzo-rpc-secret');
    if (!deps.rpcSecret || !provided || provided !== deps.rpcSecret) {
      throw new HttpError(401, 'Unauthorized');
    }
    await next();
  });

  // ── validate-token ────────────────────────────────────────────────────────
  app.post('/validate-token', async (c) => {
    const parsed = ValidateTokenSchema.safeParse(await readJson(c));
    if (!parsed.success) throw new HttpError(400, zodMessages(parsed.error));

    const payload = await verifyAccessToken(parsed.data.token, deps.jwtSecret);
    if (!payload) return c.json(INVALID_TOKEN_RESPONSE);

    const user = await deps.store.findById(payload.id ?? payload.userId ?? '');
    if (!user) return c.json(INVALID_TOKEN_RESPONSE);

    return c.json({
      isValid: user.isActive,
      userId: user.id,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
    });
  });

  // ── get-user-profile ──────────────────────────────────────────────────────
  app.post('/get-user-profile', async (c) => {
    const parsed = GetUserProfileSchema.safeParse(await readJson(c));
    if (!parsed.success) throw new HttpError(400, zodMessages(parsed.error));

    const user = await deps.store.findById(parsed.data.userId);
    if (!user) throw new HttpError(404, 'User not found');

    return c.json({
      id: user.id,
      email: user.email,
      // Contract fields are non-nullable strings; the DB columns are nullable.
      name: user.name ?? '',
      phone: user.phone ?? '',
      avatar: user.avatar ?? '',
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt.toISOString(),
    });
  });

  return app;
}
