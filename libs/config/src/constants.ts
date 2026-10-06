// ─── JWT ───────────────────────────────────────────────────────────────────

/** Access token lifetime: 15 minutes */
export const JWT_EXPIRY_SECONDS = 15 * 60;

/** Refresh token lifetime: 30 days */
export const REFRESH_TOKEN_EXPIRY_SECONDS = 30 * 24 * 60 * 60;

/** Password reset token lifetime: 1 hour */
export const PASSWORD_RESET_TOKEN_EXPIRY_SECONDS = 60 * 60;

/** Email verification token lifetime: 24 hours */
export const EMAIL_VERIFICATION_TOKEN_EXPIRY_SECONDS = 24 * 60 * 60;

// ─── File Storage ──────────────────────────────────────────────────────────

/** Maximum upload size: 10 MB */
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

/** Allowed image MIME types */
export const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
] as const;

/** Allowed document MIME types */
export const ALLOWED_DOCUMENT_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
] as const;

// ─── Currencies ────────────────────────────────────────────────────────────

export const SUPPORTED_CURRENCIES = ['USD', 'EUR', 'GBP', 'NGN', 'GHS', 'KES', 'ZAR'] as const;
export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

export const CURRENCY_PRECISION: Record<SupportedCurrency, number> = {
  USD: 2,
  EUR: 2,
  GBP: 2,
  NGN: 2,
  GHS: 2,
  KES: 2,
  ZAR: 2,
};

export const DEFAULT_CURRENCY: SupportedCurrency = 'USD';

// ─── Pagination ────────────────────────────────────────────────────────────

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

// ─── Rate Limiting ─────────────────────────────────────────────────────────

/** Max requests per minute per IP for unauthenticated routes */
export const RATE_LIMIT_UNAUTHENTICATED = 30;

/** Max requests per minute per user for authenticated routes */
export const RATE_LIMIT_AUTHENTICATED = 120;

/** Max requests per minute for auth endpoints (stricter) */
export const RATE_LIMIT_AUTH_ENDPOINT = 10;

// ─── Queues ────────────────────────────────────────────────────────────────

export const QUEUE_NAMES = {
  NOTIFICATION: 'klenzo-notifications',
  ANALYTICS: 'klenzo-analytics',
  WEBHOOK: 'klenzo-webhooks',
  INSIGHT: 'klenzo-insights',
  FINANCE: 'klenzo-finance',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

// ─── KV Namespaces ─────────────────────────────────────────────────────────

export const KV_NAMESPACES = {
  REFRESH_TOKENS: 'REFRESH_TOKEN_KV',
  RATE_LIMIT: 'RATE_LIMIT_KV',
  DEVICE_TOKENS: 'DEVICE_TOKENS_KV',
  IDEMPOTENCY: 'IDEMPOTENCY_KV',
  ANALYTICS: 'ANALYTICS_KV',
} as const;

// ─── User Roles ────────────────────────────────────────────────────────────

export const USER_ROLES = {
  USER: 'USER',
  PREMIUM: 'PREMIUM',
  ADMIN: 'ADMIN',
  SUPER_ADMIN: 'SUPER_ADMIN',
  PLATFORM_ADMIN: 'PLATFORM_ADMIN',
} as const;

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];

// ─── App metadata ──────────────────────────────────────────────────────────

export const APP_NAME = 'Klenzo';
export const API_VERSION = 'v1';
export const API_PREFIX = `/api/${API_VERSION}`;

// ─── Habit ─────────────────────────────────────────────────────────────────

export const HABIT_NAME_MAX_LENGTH = 120;
export const HABIT_MAX_PER_USER = 50;

// ─── Task ──────────────────────────────────────────────────────────────────

export const TASK_TITLE_MAX_LENGTH = 255;
export const TASK_MAX_TAGS = 20;
export const TASK_MAX_ESTIMATED_MINUTES = 14400; // 10 days

// ─── KYC ──────────────────────────────────────────────────────────────────

export const KYC_DOCUMENT_MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
export const KYC_SUPPORTED_DOCUMENT_TYPES = [
  'PASSPORT',
  'NATIONAL_ID',
  'DRIVERS_LICENSE',
  'UTILITY_BILL',
] as const;

// ─── Finance ──────────────────────────────────────────────────────────────

export const TRANSACTION_AMOUNT_MAX = '1000000.00';
export const WALLET_DAILY_LIMIT_DEFAULT = '10000.00';
export const IDEMPOTENCY_KEY_TTL_SECONDS = 24 * 60 * 60; // 24 hours
