/**
 * Cloudflare Worker environment binding interfaces.
 * Each Worker declares `Env extends BaseWorkerEnv` (or a more specific interface)
 * and passes it as the generic to Hono: `new Hono<{ Bindings: Env }>()`.
 */

import type { Hyperdrive } from '@cloudflare/workers-types';

// ─── Base (all services) ──────────────────────────────────────────────────

export interface BaseWorkerEnv {
  /** Cloudflare Hyperdrive binding for Postgres (wrangler: [[hyperdrive]]) */
  HYPERDRIVE: Hyperdrive;

  /** Redis connection string (stored as a secret) */
  REDIS_URL: string;

  /** HS256 JWT signing secret (stored as a secret) */
  JWT_SECRET: string;

  /** Environment name: 'development' | 'staging' | 'production' */
  ENVIRONMENT: 'development' | 'staging' | 'production';

  /** R2 bucket for file storage (wrangler: [[r2_buckets]]) */
  R2_BUCKET: R2Bucket;

  /** Application version tag (injected at build time) */
  APP_VERSION?: string;
}

// ─── Auth Worker ──────────────────────────────────────────────────────────

export interface AuthWorkerEnv extends BaseWorkerEnv {
  /** Queue for sending welcome / verification emails */
  NOTIFICATION_QUEUE: Queue;

  /** Refresh token KV namespace (wrangler: [[kv_namespaces]]) */
  REFRESH_TOKEN_KV: KVNamespace;

  /** Rate-limit KV namespace */
  RATE_LIMIT_KV: KVNamespace;
}

// ─── Finance Worker ───────────────────────────────────────────────────────

export interface FinanceWorkerEnv extends BaseWorkerEnv {
  /** Queue for transaction processing jobs */
  FINANCE_QUEUE: Queue;

  /** Queue for analytics events */
  ANALYTICS_QUEUE: Queue;

  /** Queue for webhook dispatch */
  WEBHOOK_QUEUE: Queue;

  /** Auth Worker service binding */
  AUTH_SERVICE: { fetch(request: Request): Promise<Response> };

  /** Idempotency key KV namespace */
  IDEMPOTENCY_KV: KVNamespace;
}

// ─── Habit Worker ─────────────────────────────────────────────────────────

export interface HabitWorkerEnv extends BaseWorkerEnv {
  /** Queue for habit insights / streak processing */
  INSIGHT_QUEUE: Queue;

  /** Queue for analytics events */
  ANALYTICS_QUEUE: Queue;

  /** Auth Worker service binding */
  AUTH_SERVICE: { fetch(request: Request): Promise<Response> };
}

// ─── Productivity Worker ──────────────────────────────────────────────────

export interface ProductivityWorkerEnv extends BaseWorkerEnv {
  /** Queue for analytics events */
  ANALYTICS_QUEUE: Queue;

  /** Queue for productivity insights */
  INSIGHT_QUEUE: Queue;

  /** Auth Worker service binding */
  AUTH_SERVICE: { fetch(request: Request): Promise<Response> };
}

// ─── Notification Worker ──────────────────────────────────────────────────

export interface NotificationWorkerEnv extends BaseWorkerEnv {
  /** Inbound notification queue (this worker is the consumer) */
  NOTIFICATION_QUEUE: Queue;

  /** Firebase / APNs credentials */
  FCM_SERVER_KEY: string;
  APNS_KEY_ID: string;
  APNS_TEAM_ID: string;
  APNS_PRIVATE_KEY: string;

  /** SMTP credentials */
  SMTP_HOST: string;
  SMTP_PORT: string;
  SMTP_USER: string;
  SMTP_PASSWORD: string;
  FROM_EMAIL: string;

  /** Twilio for SMS */
  TWILIO_ACCOUNT_SID: string;
  TWILIO_AUTH_TOKEN: string;
  TWILIO_FROM_NUMBER: string;

  /** Device token KV */
  DEVICE_TOKENS_KV: KVNamespace;
}

// ─── Insight Worker ────────────────────────────────────────────────────────

export interface InsightWorkerEnv extends BaseWorkerEnv {
  /** Inbound queue for insight generation jobs */
  INSIGHT_QUEUE: Queue;

  /** Analytics KV namespace */
  ANALYTICS_KV: KVNamespace;

  /** Service bindings for cross-domain data fetching */
  HABIT_SERVICE: { fetch(request: Request): Promise<Response> };
  FINANCE_SERVICE: { fetch(request: Request): Promise<Response> };
  PRODUCTIVITY_SERVICE: { fetch(request: Request): Promise<Response> };
}

// ─── Gateway Worker ────────────────────────────────────────────────────────

export interface GatewayWorkerEnv extends BaseWorkerEnv {
  AUTH_SERVICE: { fetch(request: Request): Promise<Response> };
  FINANCE_SERVICE: { fetch(request: Request): Promise<Response> };
  HABIT_SERVICE: { fetch(request: Request): Promise<Response> };
  PRODUCTIVITY_SERVICE: { fetch(request: Request): Promise<Response> };
  NOTIFICATION_SERVICE: { fetch(request: Request): Promise<Response> };
  INSIGHT_SERVICE: { fetch(request: Request): Promise<Response> };
  RATE_LIMIT_KV: KVNamespace;
}
