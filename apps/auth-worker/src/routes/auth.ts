/**
 * Auth routes — contract-compatible ports of the legacy NestJS AuthController
 * (apps/klenzo/src/app/auth/auth.controller.ts + auth.service.ts).
 *
 * Every response body, status code, and cookie mirrors the legacy API so the
 * existing frontend keeps working unchanged:
 *
 *   POST /auth/register   201 {success, message, user, accessToken, refreshToken} + kz_at/kz_rt
 *   POST /auth/login      200 {success, user, accessToken, refreshToken} + cookies
 *                         ── or ── {mfaRequired: true, mfaToken}
 *   POST /auth/login/mfa  200 {success, user, accessToken, refreshToken} + cookies
 *   POST /auth/refresh    200 {success, accessToken} + rotated cookies
 *   POST /auth/logout     200 {success: true} + cleared cookies   (authenticated)
 *   GET  /auth/profile    200 safeUser                            (authenticated)
 *   POST /auth/profile    200 safeUser                            (authenticated)
 *   POST /auth/forgot-password  200 {message}   (always the same message)
 *   POST /auth/reset-password   200 {message}
 *   GET  /auth/mfa/status   200 {mfaEnabled}                      (authenticated)
 *   POST /auth/mfa/setup    200 {secret, otpauthUrl}              (authenticated)
 *   POST /auth/mfa/enable   200 {mfaEnabled: true}                (authenticated)
 *   POST /auth/mfa/disable  200 {mfaEnabled: false}               (authenticated)
 *
 * Errors use the legacy AllExceptionsFilter body:
 *   {statusCode, timestamp, path, message}
 */

import { Hono, type Context, type MiddlewareHandler } from 'hono';
import {
  DisableMfaSchema,
  EnableMfaSchema,
  ForgotPasswordSchema,
  LoginSchema,
  MfaLoginSchema,
  RegisterLegacySchema,
  ResetPasswordSchema,
  UpdateProfileLegacySchema,
} from '@klenzo/validation';

import type { AppEnv, Deps } from '../types/deps';
import {
  HttpError,
  appendSetCookie,
  clearCookie,
  parseCookies,
  readJson,
  serializeCookie,
} from '../lib/http';
import { hashPassword, verifyPassword } from '../lib/password';
import {
  newRefreshToken,
  sha256Hex,
  signAccessToken,
  signMfaChallenge,
  verifyAccessToken,
  verifyMfaChallenge,
  ACCESS_TOKEN_TTL_S,
  REFRESH_TOKEN_TTL_DAYS,
} from '../lib/session';
import { generateTotpSecret, otpauthUrl, verifyTotp } from '../lib/totp';
import { toSafeUser, type UserRecord } from '../lib/store';

const MAX_FAILED_ATTEMPTS = 5;

// ── Helpers ──────────────────────────────────────────────────────────────────

function zodMessages(error: { issues: Array<{ message: string }> }): string[] {
  return error.issues.map((i) => i.message);
}

function setSessionCookies(
  c: Context<AppEnv>,
  deps: Deps,
  accessToken: string,
  refreshToken: string,
): void {
  const secure = deps.secureCookies;
  appendSetCookie(
    c,
    serializeCookie('kz_at', accessToken, {
      maxAgeSeconds: ACCESS_TOKEN_TTL_S,
      secure,
    }),
  );
  appendSetCookie(
    c,
    serializeCookie('kz_rt', refreshToken, {
      maxAgeSeconds: REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60,
      secure,
    }),
  );
}

/** Issue an access + refresh pair and persist the refresh hash (legacy flow). */
async function issueSession(deps: Deps, user: UserRecord) {
  const accessToken = await signAccessToken(user, deps.jwtSecret);
  const refresh = await newRefreshToken();
  const updated = await deps.store.update(user.id, {
    refreshToken: refresh.hash,
    refreshTokenExpires: refresh.expires,
  });
  return { accessToken, refreshToken: refresh.token, user: updated };
}

// ── Authentication middleware (cookie kz_at first, then Bearer) ─────────────

function requireAuth(deps: Deps): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const cookies = parseCookies(c.req.header('Cookie'));
    const authHeader = c.req.header('Authorization');
    const bearer =
      authHeader && authHeader.startsWith('Bearer ')
        ? authHeader.slice('Bearer '.length)
        : undefined;
    const token = cookies['kz_at'] ?? bearer;

    if (!token) throw new HttpError(401, 'Unauthorized');

    const payload = await verifyAccessToken(token, deps.jwtSecret);
    if (!payload) throw new HttpError(401, 'Unauthorized');

    const user = await deps.store.findById(payload.id ?? payload.userId ?? '');
    if (!user || !user.isActive) {
      throw new HttpError(401, 'User not found or account is inactive');
    }

    c.set('authUser', user);
    await next();
  };
}

// ── Routes ───────────────────────────────────────────────────────────────────

export function authRoutes(deps: Deps): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  // REGISTER — 201, auto-login (tokens + user inline).
  app.post('/register', async (c) => {
    const parsed = RegisterLegacySchema.safeParse(await readJson(c));
    if (!parsed.success) throw new HttpError(400, zodMessages(parsed.error));

    const existing = await deps.store.findByEmail(parsed.data.email);
    if (existing) throw new HttpError(409, 'Email already in use');

    const name =
      [parsed.data.firstName, parsed.data.lastName].filter(Boolean).join(' ') ||
      undefined;

    const user = await deps.store.create({
      email: parsed.data.email,
      passwordHash: await hashPassword(parsed.data.password),
      name: name ?? null,
      phone: parsed.data.phoneNumber ?? null,
    });

    // Legacy also fired a welcome email + in-session tracking here; both need
    // infrastructure (email provider, Redis) that lands in a later phase.

    const session = await issueSession(deps, user);
    setSessionCookies(c, deps, session.accessToken, session.refreshToken);

    return c.json(
      {
        success: true,
        message: 'Registration successful',
        user: toSafeUser(session.user),
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
      },
      201,
    );
  });

  // LOGIN — 200 with session, or {mfaRequired, mfaToken} when MFA is on.
  app.post('/login', async (c) => {
    const parsed = LoginSchema.safeParse(await readJson(c));
    if (!parsed.success) throw new HttpError(400, zodMessages(parsed.error));

    const user = await deps.store.findByEmail(parsed.data.email);
    if (!user) throw new HttpError(401, 'Invalid credentials');

    if (!user.isActive) {
      throw new HttpError(
        401,
        'Account is locked. Reset your password to regain access.',
      );
    }

    const match = await verifyPassword(parsed.data.password, user.passwordHash);
    if (!match) {
      const attempts = user.failedLoginAttempts + 1;
      if (attempts >= MAX_FAILED_ATTEMPTS) {
        await deps.store.update(user.id, {
          isActive: false,
          failedLoginAttempts: attempts,
        });
        // Legacy also emailed an account-locked notice (later phase).
      } else {
        await deps.store.update(user.id, { failedLoginAttempts: attempts });
      }
      throw new HttpError(401, 'Invalid credentials');
    }

    await deps.store.update(user.id, {
      failedLoginAttempts: 0,
      lastLogin: new Date(),
    });

    if (user.mfaEnabled) {
      const mfaToken = await signMfaChallenge(user.id, deps.jwtSecret);
      return c.json({ mfaRequired: true as const, mfaToken });
    }

    const session = await issueSession(deps, user);
    setSessionCookies(c, deps, session.accessToken, session.refreshToken);

    return c.json({
      success: true,
      user: toSafeUser(session.user),
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
    });
  });

  // MFA LOGIN — second step; completes the challenge into a real session.
  app.post('/login/mfa', async (c) => {
    const parsed = MfaLoginSchema.safeParse(await readJson(c));
    if (!parsed.success) throw new HttpError(400, zodMessages(parsed.error));

    const challenge = await verifyMfaChallenge(parsed.data.mfaToken, deps.jwtSecret);
    if (!challenge) {
      throw new HttpError(401, 'MFA challenge expired — please sign in again');
    }
    if (challenge.type !== 'mfa_challenge' || !challenge.sub) {
      throw new HttpError(401, 'Invalid MFA challenge');
    }

    const user = await deps.store.findById(challenge.sub);
    if (!user || !user.isActive) {
      throw new HttpError(401, 'User not found or inactive');
    }
    if (!user.mfaEnabled || !user.mfaSecret) {
      throw new HttpError(401, 'MFA is not enabled');
    }

    const valid = await verifyTotp(user.mfaSecret, parsed.data.code);
    if (!valid) throw new HttpError(401, 'Invalid authentication code');

    await deps.store.update(user.id, { failedLoginAttempts: 0, lastLogin: new Date() });

    const session = await issueSession(deps, user);
    setSessionCookies(c, deps, session.accessToken, session.refreshToken);

    return c.json({
      success: true,
      user: toSafeUser(session.user),
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
    });
  });

  // REFRESH — rotates kz_rt and re-issues kz_at.
  app.post('/refresh', async (c) => {
    const cookies = parseCookies(c.req.header('Cookie'));
    const refreshToken = cookies['kz_rt'];
    if (!refreshToken) throw new HttpError(401, 'No refresh token');

    const hash = await sha256Hex(refreshToken);
    const user = await deps.store.findByRefreshHash(hash);
    if (
      !user ||
      !user.refreshTokenExpires ||
      user.refreshTokenExpires < new Date()
    ) {
      throw new HttpError(401, 'Invalid or expired refresh token');
    }

    const session = await issueSession(deps, user);
    setSessionCookies(c, deps, session.accessToken, session.refreshToken);

    return c.json({ success: true, accessToken: session.accessToken });
  });

  // LOGOUT — clears the refresh token server-side and both cookies.
  app.post('/logout', requireAuth(deps), async (c) => {
    const user = c.get('authUser');
    await deps.store.update(user.id, {
      refreshToken: null,
      refreshTokenExpires: null,
    });

    const secure = deps.secureCookies;
    appendSetCookie(c, clearCookie('kz_at', { secure }));
    appendSetCookie(c, clearCookie('kz_rt', { secure }));

    return c.json({ success: true });
  });

  // PROFILE — read.
  app.get('/profile', requireAuth(deps), (c) => {
    return c.json(toSafeUser(c.get('authUser')));
  });

  // PROFILE — update (legacy UpdateProfileDto: all fields optional).
  app.post('/profile', requireAuth(deps), async (c) => {
    const parsed = UpdateProfileLegacySchema.safeParse(await readJson(c));
    if (!parsed.success) throw new HttpError(400, zodMessages(parsed.error));

    const current = c.get('authUser');
    const fields = parsed.data;

    // Empty body ⇒ no-op (legacy would hand `{}` to Prisma; we return the
    // current user instead of risking a Prisma validation error).
    if (Object.keys(fields).length === 0) {
      return c.json(toSafeUser(current));
    }

    const updated = await deps.store.update(current.id, fields);
    return c.json(toSafeUser(updated));
  });

  // ── FORGOT / RESET PASSWORD ─────────────────────────────────────────────

  // FORGOT PASSWORD — always the same 200 body (anti-enumeration, legacy
  // parity). The raw token is normally delivered by email; the Worker has no
  // email provider yet (later phase), so in non-production it is echoed in
  // `devResetToken` to keep the flow end-to-end testable.
  app.post('/forgot-password', async (c) => {
    const parsed = ForgotPasswordSchema.safeParse(await readJson(c));
    if (!parsed.success) throw new HttpError(400, zodMessages(parsed.error));

    const user = await deps.store.findByEmail(parsed.data.email);
    if (!user) {
      return c.json({ message: 'If that email exists, a reset link has been sent' });
    }

    const rawBytes = crypto.getRandomValues(new Uint8Array(32));
    const resetToken = Array.from(rawBytes, (b) => b.toString(16).padStart(2, '0')).join('');
    const hashedToken = await sha256Hex(resetToken);
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour (legacy)

    await deps.store.update(user.id, {
      passwordResetToken: hashedToken,
      passwordResetExpires: expires,
    });

    // TODO(phase: email): sendPasswordResetEmail(user.email, resetToken)
    // once the email provider lands. Legacy fires-and-forgets the email.

    if (!deps.secureCookies) {
      return c.json({
        message: 'If that email exists, a reset link has been sent',
        devResetToken: resetToken,
      });
    }

    return c.json({ message: 'If that email exists, a reset link has been sent' });
  });

  // RESET PASSWORD — consumes the hashed token, re-hashes the new password,
  // and UNLOCKS the account (isActive=true, failedLoginAttempts=0) — the
  // locked-account recovery path promised by the login error message.
  app.post('/reset-password', async (c) => {
    const parsed = ResetPasswordSchema.safeParse(await readJson(c));
    if (!parsed.success) throw new HttpError(400, zodMessages(parsed.error));

    const hashedToken = await sha256Hex(parsed.data.token);
    const user = await deps.store.findByResetHash(hashedToken);
    if (!user || !user.passwordResetExpires || user.passwordResetExpires < new Date()) {
      throw new HttpError(401, 'Invalid or expired reset token');
    }

    await deps.store.update(user.id, {
      passwordHash: await hashPassword(parsed.data.password),
      passwordResetToken: null,
      passwordResetExpires: null,
      failedLoginAttempts: 0,
      isActive: true,
    });

    return c.json({ message: 'Password reset successful' });
  });

  // ── MFA MANAGEMENT ───────────────────────────────────────────────────────

  // MFA STATUS — read the current flag.
  app.get('/mfa/status', requireAuth(deps), (c) => {
    return c.json({ mfaEnabled: c.get('authUser').mfaEnabled });
  });

  // MFA SETUP — generate + persist a TOTP secret WITHOUT enabling MFA yet;
  // the user must prove possession via /mfa/enable. 409 when already enabled.
  app.post('/mfa/setup', requireAuth(deps), async (c) => {
    const user = c.get('authUser');
    if (user.mfaEnabled) {
      throw new HttpError(409, 'Two-factor authentication is already enabled');
    }

    const secret = generateTotpSecret();
    await deps.store.update(user.id, { mfaSecret: secret });

    return c.json({
      secret,
      // Label mirrors legacy speakeasy: name=`Klenzo (${email})`,
      // issuer=`Klenzo` → otpauth://totp/Klenzo:Klenzo (email)?...
      otpauthUrl: otpauthUrl(secret, `Klenzo (${user.email})`),
    });
  });

  // MFA ENABLE — verify the first code, then flip mfaEnabled=true.
  app.post('/mfa/enable', requireAuth(deps), async (c) => {
    const parsed = EnableMfaSchema.safeParse(await readJson(c));
    if (!parsed.success) throw new HttpError(400, zodMessages(parsed.error));

    const user = c.get('authUser');
    if (user.mfaEnabled) throw new HttpError(409, 'MFA is already enabled');
    if (!user.mfaSecret) {
      throw new HttpError(
        400,
        'MFA setup has not been started. Call POST /auth/mfa/setup first.',
      );
    }

    const valid = await verifyTotp(user.mfaSecret, parsed.data.code);
    if (!valid) throw new HttpError(401, 'Invalid authentication code');

    await deps.store.update(user.id, { mfaEnabled: true });
    return c.json({ mfaEnabled: true });
  });

  // MFA DISABLE — requires a valid current code; clears the secret too.
  app.post('/mfa/disable', requireAuth(deps), async (c) => {
    const parsed = DisableMfaSchema.safeParse(await readJson(c));
    if (!parsed.success) throw new HttpError(400, zodMessages(parsed.error));

    const user = c.get('authUser');
    if (!user.mfaEnabled) throw new HttpError(409, 'MFA is not currently enabled');
    if (!user.mfaSecret) {
      throw new HttpError(400, 'MFA secret is missing — contact support');
    }

    const valid = await verifyTotp(user.mfaSecret, parsed.data.code);
    if (!valid) throw new HttpError(401, 'Invalid authentication code');

    await deps.store.update(user.id, { mfaEnabled: false, mfaSecret: null });
    return c.json({ mfaEnabled: false });
  });

  return app;
}
