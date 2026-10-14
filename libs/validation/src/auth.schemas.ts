import { z } from 'zod';
import { PhoneNumberSchema } from './common';

// ─── Register ─────────────────────────────────────────────────────────────

export const RegisterSchema = z.object({
  email: z.string().trim().email('Invalid email address').toLowerCase(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be at most 128 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
  firstName: z.string().trim().min(1, 'First name is required').max(100, 'First name too long'),
  lastName: z.string().trim().min(1, 'Last name is required').max(100, 'Last name too long'),
  phoneNumber: PhoneNumberSchema.optional(),
});

export type RegisterInput = z.infer<typeof RegisterSchema>;

// ─── Register (legacy parity) ───────────────────────────────────────────
//
// Exact shape accepted by the legacy NestJS RegisterDto (apps/klenzo):
// `{ email, password ≥ 8 }` — nothing else is required. The existing
// frontend sign-up page sends ONLY { email, password } with no client-side
// complexity rules, so the Auth Worker must accept this shape for the
// Phase 4 exit gate ("frontend authenticates through the new Worker
// while the rest of the system remains unchanged").
//
// Profile fields are optional here for forward-compat: API clients may
// send them and the Worker will persist them, but they are never required.

export const RegisterLegacySchema = z.object({
  email: z.string().trim().email('Invalid email address').toLowerCase(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be at most 128 characters'),
  firstName: z.string().trim().min(1).max(100).optional(),
  lastName: z.string().trim().min(1).max(100).optional(),
  phoneNumber: PhoneNumberSchema.optional(),
});

export type RegisterLegacyInput = z.infer<typeof RegisterLegacySchema>;

// ─── Login ─────────────────────────────────────────────────────────────────

export const LoginSchema = z.object({
  email: z.string().trim().email('Invalid email address').toLowerCase(),
  password: z.string().min(1, 'Password is required'),
});

export type LoginInput = z.infer<typeof LoginSchema>;

// ─── Update Profile ────────────────────────────────────────────────────────

export const UpdateProfileSchema = z
  .object({
    firstName: z.string().trim().min(1).max(100).optional(),
    lastName: z.string().trim().min(1).max(100).optional(),
    phoneNumber: PhoneNumberSchema.optional(),
    avatarUrl: z.string().url('avatarUrl must be a valid URL').optional(),
  })
  .refine((data) => Object.values(data).some((v) => v !== undefined), {
    message: 'At least one field must be provided',
  });

export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;

// ─── Change Password ────────────────────────────────────────────────────────

export const ChangePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z
      .string()
      .min(8, 'New password must be at least 8 characters')
      .max(128, 'New password must be at most 128 characters')
      .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
      .regex(/[a-z]/, 'Must contain at least one lowercase letter')
      .regex(/[0-9]/, 'Must contain at least one number')
      .regex(/[^A-Za-z0-9]/, 'Must contain at least one special character'),
    confirmNewPassword: z.string().min(1, 'Please confirm your new password'),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    message: 'Passwords do not match',
    path: ['confirmNewPassword'],
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: 'New password must differ from current password',
    path: ['newPassword'],
  });

export type ChangePasswordInput = z.infer<typeof ChangePasswordSchema>;

// ─── Refresh Token ─────────────────────────────────────────────────────────

export const RefreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export type RefreshTokenInput = z.infer<typeof RefreshTokenSchema>;

// ─── MFA login (second step) ────────────────────────────────────────────
//
// Exact shape of the legacy MfaLoginDto: `{ mfaToken, code }` where code
// must be 6 digits.

export const MfaLoginSchema = z.object({
  mfaToken: z.string().min(1, 'mfaToken is required'),
  code: z
    .string()
    .regex(/^\d{6}$/, 'Authentication code must be 6 digits'),
});

export type MfaLoginInput = z.infer<typeof MfaLoginSchema>;

// ─── Update profile (legacy parity) ───────────────────────────────────────
//
// Mirrors the legacy UpdateProfileDto — every field optional, all fields
// accepted by the existing frontend profile editor (name / phone / avatar /
// notificationSettings).  An empty object is valid and is treated as a no-op.

export const UpdateProfileLegacySchema = z.object({
  email: z.string().trim().email('Invalid email address').toLowerCase().optional(),
  name: z.string().trim().max(200, 'Name too long').optional(),
  phone: z.string().trim().max(50, 'Phone too long').optional(),
  avatar: z.string().max(2048, 'Avatar URL too long').optional(),
  // Flat boolean map (the frontend's notificationSettings shape) — a record
  // type so it is directly assignable to Prisma's Json column input.
  notificationSettings: z.record(z.boolean()).optional(),
});

export type UpdateProfileLegacyInput = z.infer<typeof UpdateProfileLegacySchema>;

// ─── Forgot password (legacy parity) ───────────────────────────────────────
//
// Exact shape of the legacy ForgotPasswordDto: `{ email }`. The response is
// always the same message regardless of whether the email exists (anti
// enumeration).

export const ForgotPasswordSchema = z.object({
  email: z.string().trim().email('Invalid email address').toLowerCase(),
});

export type ForgotPasswordInput = z.infer<typeof ForgotPasswordSchema>;

// ─── Reset password (legacy parity) ────────────────────────────────────────
//
// Exact shape of the legacy ResetPasswordDto: `{ token, password ≥ 8 }` —
// the legacy DTO has NO complexity rules, so parity demands min-length only.

export const ResetPasswordSchema = z.object({
  token: z.string().min(1, 'token is required'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be at most 128 characters'),
});

export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>;

// ─── MFA enable / disable (legacy parity) ──────────────────────────────────
//
// Exact shape of the legacy EnableMfaDto / DisableMfaDto: `{ code }` where
// code must be 6 digits.

export const EnableMfaSchema = z.object({
  code: z.string().regex(/^\d{6}$/, 'Authentication code must be 6 digits'),
});

export type EnableMfaInput = z.infer<typeof EnableMfaSchema>;

export const DisableMfaSchema = z.object({
  code: z.string().regex(/^\d{6}$/, 'Authentication code must be 6 digits'),
});

export type DisableMfaInput = z.infer<typeof DisableMfaSchema>;

// ─── Internal RPC bodies (service-to-service, Phase 5) ───────────────────
//
// Explicit TypeScript contracts for Worker-to-Worker RPC over service
// bindings (replaces gRPC). Both the auth-worker (server side) and the
// api-worker client validate with these schemas so the wire shape can
// never drift between the two.

export const ValidateTokenSchema = z.object({
  token: z.string().min(1, 'token is required'),
});

export type ValidateTokenInput = z.infer<typeof ValidateTokenSchema>;

export const GetUserProfileSchema = z.object({
  userId: z.string().min(1, 'userId is required'),
});

export type GetUserProfileInput = z.infer<typeof GetUserProfileSchema>;

// ─── Internal RPC response bodies (validated by the api-worker client) ────
//
// Runtime mirrors of @klenzo/contracts ValidateTokenResponse and
// GetUserProfileResponse.  The client validates every response against
// these schemas, so a wire-shape change on either side fails loudly in the
// caller instead of silently propagating.

export const ValidateTokenResponseSchema = z.object({
  isValid: z.boolean(),
  userId: z.string(),
  email: z.string(),
  role: z.string(),
  isActive: z.boolean(),
});

export type ValidateTokenResponse = z.infer<typeof ValidateTokenResponseSchema>;

export const GetUserProfileResponseSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  phone: z.string(),
  avatar: z.string(),
  role: z.string(),
  isActive: z.boolean(),
  createdAt: z.string(),
});

export type GetUserProfileResponse = z.infer<typeof GetUserProfileResponseSchema>;
