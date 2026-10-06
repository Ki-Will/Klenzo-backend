# Target Architecture — Cloudflare Workers

> **Status:** Design (Phase 0)  
> **Updated:** 2026-10-01  
> **Replaces:** NestJS microservices + Nginx + Docker Compose + Redis self-hosted  
> **Constraint:** $0/month — all resources must fit within Cloudflare free tier limits.

---

## Table of Contents

1. [Design Principles](#1-design-principles)
2. [Worker Inventory](#2-worker-inventory)
3. [Request Flow](#3-request-flow)
4. [Service Binding Topology](#4-service-binding-topology)
5. [Cloudflare Infrastructure Map](#5-cloudflare-infrastructure-map)
6. [Hyperdrive (PostgreSQL)](#6-hyperdrive-postgresql)
7. [Cloudflare Queues (BullMQ replacement)](#7-cloudflare-queues-bullmq-replacement)
8. [Cloudflare R2 (Object Storage)](#8-cloudflare-r2-object-storage)
9. [Upstash Redis (Cache + Pub/Sub)](#9-upstash-redis-cache--pubsub)
10. [Durable Objects (WebSocket + Rate Limiting)](#10-durable-objects-websocket--rate-limiting)
11. [Authentication Architecture](#11-authentication-architecture)
12. [Free-Tier Resource Budget](#12-free-tier-resource-budget)
13. [wrangler.toml Structure](#13-wranglertoml-structure)
14. [Deployment Topology](#14-deployment-topology)
15. [Key Differences from NestJS Architecture](#15-key-differences-from-nestjs-architecture)

---

## 1. Design Principles

1. **Zero infrastructure.** No VMs, no containers, no Docker Compose. All compute is Cloudflare Workers (V8 isolates).
2. **Service Bindings replace gRPC.** Inter-worker calls use Cloudflare Service Bindings — zero-latency, no network hop, type-safe RPC.
3. **Cloudflare Queues replace BullMQ.** Persistent job queues with at-least-once delivery, dead letter queues, and automatic retries.
4. **Hyperdrive replaces direct PgBouncer.** Connection pooling to Neon PostgreSQL is handled by Cloudflare Hyperdrive — Workers connect via the Hyperdrive binding, no cold connection overhead.
5. **Upstash Redis replaces self-hosted Redis.** HTTP-based Redis compatible with Workers' no-TCP constraint.
6. **Durable Objects replace Socket.IO.** WebSocket connections are managed by Durable Objects for persistent state across requests.
7. **R2 remains.** Already using Cloudflare R2; native `env.R2` binding replaces `@aws-sdk/client-s3`.
8. **One Worker per domain.** Each of the 7 workers owns its Prisma tables, its routes, and publishes/consumes its queues.
9. **api-worker is the edge gateway.** All external traffic enters through `api-worker`, which verifies JWT and routes to domain workers via Service Bindings.

---

## 2. Worker Inventory

| Worker Name | Replaces | Domain | Routes |
|---|---|---|---|
| `api-worker` | Nginx + klenzo monolith (routing layer) | Edge gateway, JWT middleware, rate limiting | `api.klenzo.app/*` |
| `auth-worker` | auth-service (HTTP :3001, gRPC :5001) | Identity, sessions, KYC, MFA, Google OAuth | Called via Service Binding only + `/api/auth/*` |
| `finance-worker` | finance-service (HTTP :3002, gRPC :5002) | Transactions, wallets, transfers, payroll, ledger, risk | Called via Service Binding + `/api/finance/*` etc. |
| `habit-worker` | habit-service (HTTP :3004) | Habit tracking, completion logs, streaks | Called via Service Binding + `/api/habits/*` |
| `productivity-worker` | productivity-service (HTTP :3003) | Tasks | Called via Service Binding + `/api/productivity/*` |
| `notification-worker` | notification-service (HTTP :3005) | Notifications DB, email dispatch, Durable Object WebSocket | Called via Service Binding + `/api/notifications/*` |
| `insight-worker` | insight-service (HTTP :3006) | Analytics, admin, audit logs, RBAC, feature flags, approvals, consent | Called via Service Binding + `/api/insights/*` + `/api/admin/*` |

---

## 3. Request Flow

### External HTTP Request

```
Client (browser / mobile)
    │
    ▼  HTTPS
Cloudflare Edge (anycast, ~50ms global P99)
    │
    ▼
api-worker  ← all traffic enters here
    │
    ├── JWT verification (Upstash Redis cache → Hyperdrive fallback)
    ├── Rate limiting (Durable Object RateLimiter)
    ├── Path-based routing
    │
    ├── /api/auth/*    ──── Service Binding ──→  auth-worker
    ├── /api/finance/* ──── Service Binding ──→  finance-worker
    ├── /api/habits/*  ──── Service Binding ──→  habit-worker
    ├── /api/productivity/* ─ Service Binding → productivity-worker
    ├── /api/notifications/* ─ Service Binding → notification-worker
    ├── /api/insights/* ─── Service Binding ──→  insight-worker
    └── /api/admin/*   ──── Service Binding ──→  insight-worker
```

### WebSocket Connection

```
Client ──── WSS ────▶ api-worker
                           │
                           │  Durable Object stub
                           ▼
                    NotificationHub DO
                           │
                    ┌──────┴──────┐
                    │             │
               WebSocket       notification-worker
               state map       (via Service Binding)
```

### Queue Processing (Asynchronous)

```
finance-worker
    │
    │  env.FINANCE_EVENTS_QUEUE.send(job)
    ▼
Cloudflare Queue: "klenzo-finance-events"
    │
    │  (auto-invoked by CF runtime)
    ▼
notification-worker.queue(batch)
    │
    ├── Persist Notification to DB (Hyperdrive → Neon)
    ├── Push to NotificationHub DO (WebSocket)
    └── Send email (Cloudflare Email / SMTP worker)
```

---

## 4. Service Binding Topology

Service Bindings are zero-overhead in-process calls — no HTTP, no serialization overhead, no network latency. The callee worker runs in the same isolate context.

```
                    ┌─────────────────┐
                    │   api-worker    │
                    │  (edge router)  │
                    └────────┬────────┘
                             │ Service Bindings
          ┌──────────────────┼──────────────────────┐
          │                  │                       │
          ▼                  ▼                       ▼
  ┌──────────────┐  ┌──────────────────┐  ┌─────────────────┐
  │ auth-worker  │  │ finance-worker   │  │  habit-worker   │
  └──────┬───────┘  └────────┬─────────┘  └─────────────────┘
         │                   │
         │ Service Binding    │ Service Binding
         ▼                   ▼
   Called by:          Called by:
   - finance-worker    - insight-worker
     (token check)       (wallet summary)
   - insight-worker
     (user profile)
```

### Service Binding Matrix

| Caller | Binding Name | Callee | Replaces gRPC Call |
|---|---|---|---|
| `api-worker` | `AUTH` | `auth-worker` | — (new routing layer) |
| `api-worker` | `FINANCE` | `finance-worker` | — |
| `api-worker` | `HABIT` | `habit-worker` | — |
| `api-worker` | `PRODUCTIVITY` | `productivity-worker` | — |
| `api-worker` | `NOTIFICATION` | `notification-worker` | — |
| `api-worker` | `INSIGHT` | `insight-worker` | — |
| `finance-worker` | `AUTH` | `auth-worker` | `auth.ValidateToken` gRPC |
| `insight-worker` | `AUTH` | `auth-worker` | `auth.GetUserProfile` gRPC |
| `insight-worker` | `FINANCE` | `finance-worker` | `finance.GetTransactionSummary` gRPC |
| `notification-worker` | `AUTH` | `auth-worker` | Token validation for WebSocket |

### RPC Method Convention

Service Binding calls use a simple HTTP-like RPC pattern inside Workers:

```typescript
// finance-worker calls auth-worker for token validation
const result = await env.AUTH.fetch(new Request('http://internal/rpc/validate-token', {
  method: 'POST',
  body: JSON.stringify({ token }),
  headers: { 'Content-Type': 'application/json', 'X-Internal': '1' }
}));
```

Or using Workers RPC (class-based, preferred):

```typescript
// auth-worker exports an RPC class
export class AuthWorkerRPC extends WorkerEntrypoint {
  async validateToken(token: string): Promise<{ isValid: boolean; userId: string; role: string }> { … }
  async getUserProfile(userId: string): Promise<UserProfile> { … }
  async checkRole(userId: string, requiredRole: string): Promise<boolean> { … }
}
```

---

## 5. Cloudflare Infrastructure Map

```
Cloudflare Account
├── Workers (Compute)
│   ├── api-worker                    (edge, all traffic)
│   ├── auth-worker                   (identity domain)
│   ├── finance-worker                (finance domain)
│   ├── habit-worker                  (habit domain)
│   ├── productivity-worker           (productivity domain)
│   ├── notification-worker           (notification domain + queue consumer)
│   └── insight-worker                (analytics + admin domain)
│
├── Durable Objects
│   ├── NotificationHub               (WebSocket connection manager, per-user)
│   └── RateLimiter                   (sliding-window rate limiter, per-IP)
│
├── Cloudflare Queues
│   ├── klenzo-notifications          (notification jobs → notification-worker)
│   ├── klenzo-finance-events         (finance events → notification-worker + insight-worker)
│   └── klenzo-analytics              (analytics events → insight-worker)
│
├── Cloudflare R2
│   └── klenzo-storage                (user avatars, document uploads)
│
├── Hyperdrive
│   └── klenzo-hyperdrive             (connection pool → Neon PostgreSQL)
│
└── Workers KV (optional)
    └── klenzo-feature-flags          (feature flag cache — fast reads, infrequent writes)

External Services
├── Neon (PostgreSQL)                 (shared DB, multi-schema)
└── Upstash Redis                     (HTTP Redis — cache + pub/sub channel state)
```

---

## 6. Hyperdrive (PostgreSQL)

**What it replaces:** Direct Prisma connection + PgBouncer (`config/pgbouncer.ini`)

**Why needed:** Workers cannot hold persistent TCP connections. Hyperdrive proxies the connection to Neon, pooling and multiplexing across isolate invocations.

**Configuration:**

```toml
[[hyperdrive]]
binding = "HYPERDRIVE"
id      = "<hyperdrive-config-id>"
```

**Prisma adapter:**

```typescript
import { PrismaClient } from '@prisma/client';
import { PrismaD1 } from '@prisma/adapter-d1'; // or hyperdrive adapter

// In each worker's fetch handler:
const prisma = new PrismaClient({
  datasourceUrl: env.HYPERDRIVE.connectionString,
});
```

**Schema isolation preserved:** Each worker passes `?schema={name}` in its connection string, maintaining the existing auth/finance/habit/productivity/notifications/platform/public boundary.

**Free tier:** Hyperdrive has no separate free tier limit — it's billed per-request at the Workers rate.

---

## 7. Cloudflare Queues (BullMQ replacement)

**What they replace:** BullMQ `notifications`, `finance-events`, `analytics` queues backed by Redis.

**Key differences from BullMQ:**

| Feature | BullMQ | Cloudflare Queues |
|---|---|---|
| Backing store | Redis | Cloudflare distributed |
| Delivery | At-least-once | At-least-once |
| Dead letter queue | Manual config | Built-in |
| Retry | Configurable exponential | Configurable (max 3 by default) |
| Priority | Yes (int) | No native priority |
| Batching | No | Yes (up to 100 messages) |
| Delay | Yes | Yes |
| Concurrency | Worker-level | Consumer-level parallelism |

### Queue Definitions

#### `klenzo-notifications`

```toml
[[queues.producers]]
queue   = "klenzo-notifications"
binding = "NOTIFICATIONS_QUEUE"

[[queues.consumers]]
queue            = "klenzo-notifications"
max_batch_size   = 10
max_batch_timeout = 5   # seconds
max_retries      = 3
dead_letter_queue = "klenzo-notifications-dlq"
```

**Producer:** `notification-worker`, `finance-worker`, `auth-worker`  
**Consumer:** `notification-worker`

| Job Type | Payload | Priority Workaround |
|---|---|---|
| `send-notification` | `{ userId, type, title, body, category, metadata }` | `delaySeconds: 0` for normal, `delaySeconds: -1` n/a — use separate high-priority queue |
| `send-email` | `{ to, subject, html }` | — |
| `send-bulk` | `{ userIds[], type, title, body }` | Fan-out in consumer |

#### `klenzo-finance-events`

```toml
[[queues.producers]]
queue   = "klenzo-finance-events"
binding = "FINANCE_EVENTS_QUEUE"

[[queues.consumers]]
queue            = "klenzo-finance-events"
max_batch_size   = 50
max_batch_timeout = 10
max_retries      = 3
dead_letter_queue = "klenzo-finance-events-dlq"
```

**Producer:** `finance-worker`  
**Consumer:** `notification-worker` (alerts), `insight-worker` (analytics cache invalidation)

| Job Type | Payload |
|---|---|
| `transaction-event` | `{ userId, transactionId, event, data }` |
| `wallet-event` | `{ userId, walletId, event, data }` |
| `transfer-event` | `{ senderId, recipientId, transferId, event, data }` |

#### `klenzo-analytics`

```toml
[[queues.producers]]
queue   = "klenzo-analytics"
binding = "ANALYTICS_QUEUE"

[[queues.consumers]]
queue            = "klenzo-analytics"
max_batch_size   = 100
max_batch_timeout = 30
max_retries      = 2
```

**Producer:** All workers  
**Consumer:** `insight-worker`

---

## 8. Cloudflare R2 (Object Storage)

**What it replaces:** `R2Service` using `@aws-sdk/client-s3` with `R2_ENDPOINT_URL`.

**Change:** Remove `@aws-sdk/client-s3`. Use native `env.STORAGE` R2 binding instead.

```toml
[[r2_buckets]]
binding  = "STORAGE"
bucket_name = "klenzo-storage"
```

**Upload (before — S3 SDK):**
```typescript
await this.s3.send(new PutObjectCommand({ Bucket, Key, Body, ContentType }));
```

**Upload (after — R2 binding):**
```typescript
await env.STORAGE.put(key, file.arrayBuffer(), { httpMetadata: { contentType } });
```

**Public access:** R2 custom domain `assets.klenzo.app` → bucket (replaces `R2_PUBLIC_URL` env var).

**Free tier:** 10 GB storage, 1M Class A ops/month, 10M Class B ops/month.

---

## 9. Upstash Redis (Cache + Pub/Sub)

**What it replaces:** Self-hosted `redis:7-alpine` Docker container + `ioredis`.

**Why Upstash over native CF KV:** Need Redis data structures (sorted sets for BullMQ if needed, pub/sub channels). Upstash provides HTTP-based Redis compatible with the Workers runtime (no TCP).

**Client:**

```typescript
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: env.UPSTASH_REDIS_REST_URL,
  token: env.UPSTASH_REDIS_REST_TOKEN,
});
```

### Cache Key Mapping (unchanged from current)

| Key Pattern | TTL | Data |
|---|---|---|
| `banners:active` | 300s | Active system banners |
| `notif:user:{userId}` | 30s | User notification inbox |
| `user:profile:{userId}` | 120s | JWT validation cache |
| `insights:dashboard:{userId}` | 120s | Aggregated dashboard metrics |

### Pub/Sub replacement

Redis Pub/Sub cannot be used in a stateless Worker (subscribe requires a persistent connection). Instead:

- **Intra-worker events** replaced by Service Binding direct calls.
- **Cross-worker async events** replaced by Cloudflare Queues.
- **Real-time notifications** replaced by Durable Object `NotificationHub`.

**Free tier (Upstash):** 10,000 commands/day on free plan. Upgrade to pay-per-request ($0.2 per 100K commands) if needed.

---

## 10. Durable Objects (WebSocket + Rate Limiting)

### NotificationHub DO

**What it replaces:** `NotificationGateway` (`@nestjs/websockets` + `socket.io`)

**Location:** Defined in `notification-worker`, usable from `api-worker` via binding.

```typescript
export class NotificationHub extends DurableObject {
  // Keyed per user: DO id = userId
  // Holds open WebSocket connections for the user

  async fetch(request: Request) {
    if (request.headers.get('Upgrade') === 'websocket') {
      return this.handleWebSocket(request);
    }
    // Service Binding: push a notification event to connected sockets
    return this.handlePush(request);
  }

  private async handleWebSocket(request: Request) {
    const pair = new WebSocketPair();
    this.ctx.acceptWebSocket(pair[1]);
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  async webSocketMessage(ws: WebSocket, message: string) {
    const data = JSON.parse(message);
    if (data.type === 'heartbeat') ws.send(JSON.stringify({ status: 'ok' }));
    if (data.type === 'markAsRead') { /* forward to notification-worker */ }
  }
}
```

**DO Binding in wrangler.toml:**

```toml
[[durable_objects.bindings]]
name       = "NOTIFICATION_HUB"
class_name = "NotificationHub"

[[migrations]]
tag                = "v1"
new_classes        = ["NotificationHub", "RateLimiter"]
```

### RateLimiter DO

**What it replaces:** Nginx `limit_req_zone` + NestJS `ThrottlerModule`.

```typescript
export class RateLimiter extends DurableObject {
  // Sliding window rate limiter per IP + route group
  // Config: { auth: 10/s, api: 50/s }

  async checkLimit(key: string, limit: number, windowMs: number): Promise<boolean> {
    // Uses DO storage for sliding window counts
    // Returns true = allow, false = reject (429)
  }
}
```

---

## 11. Authentication Architecture

The JWT strategy is preserved but adapted for stateless Workers:

### Token Verification (api-worker)

```typescript
// api-worker verifies every incoming request
async function verifyJWT(token: string, env: Env): Promise<JWTPayload | null> {
  // 1. Check Upstash Redis cache (user:profile:{userId}) — avoids DB round-trip
  const cached = await redis.get(`user:profile:${userId}`);
  if (cached) return cached;

  // 2. Cache miss — call auth-worker via Service Binding
  const profile = await env.AUTH.validateToken(token);

  // 3. Cache result for 120s
  await redis.set(`user:profile:${profile.userId}`, profile, { ex: 120 });
  return profile;
}
```

### Cookies

Same cookie names preserved: `kz_at` (access token, 15m) and `kz_rt` (refresh token, 7d).

Workers set cookies via `Set-Cookie` response headers — no change in client behavior.

### MFA (TOTP)

`otplib` (pure JS) works in Workers. No Node-specific dependencies.

### Google OAuth

Google OAuth callback (`/api/auth/google/callback`) continues to work as an HTTP redirect handled by `auth-worker`.

---

## 12. Free-Tier Resource Budget

All limits are as of 2026. Workers free tier is on the **Workers Free plan**.

### Cloudflare Workers Free Plan

| Resource | Free Limit | Projected Usage | Headroom |
|---|---|---|---|
| Worker Requests | 100,000/day | ~5,000–20,000/day (dev/early prod) | ✅ 5–20x headroom |
| CPU time | 10ms per request | ~2–5ms average | ✅ Comfortable |
| Memory | 128 MB per isolate | ~30–50 MB | ✅ |
| Workers | Unlimited | 7 workers | ✅ |
| Cron triggers | 5 per account | 1–2 (metrics, cleanup) | ✅ |

### Cloudflare Queues Free Plan

| Resource | Free Limit | Projected Usage | Notes |
|---|---|---|---|
| Message operations | 1,000,000/month | ~100K–300K/month | ✅ Each enqueue + delivery = 2 ops |
| Message retention | 4 days | N/A | ✅ |
| Max message size | 128 KB | ~1–5 KB per job | ✅ |

### Cloudflare R2 Free Plan

| Resource | Free Limit | Projected Usage |
|---|---|---|
| Storage | 10 GB | <1 GB (avatars only) ✅ |
| Class A ops (write) | 1M/month | ~10K–50K/month ✅ |
| Class B ops (read) | 10M/month | ~100K–500K/month ✅ |
| Egress | Free (always) | N/A ✅ |

### Cloudflare Durable Objects Free Plan

| Resource | Free Limit | Projected Usage |
|---|---|---|
| Requests | 1M/month | ~50K–200K/month ✅ |
| Storage | 1 GB | <10 MB ✅ |
| Duration | 400,000 GB-s/month | Low (notification hubs only active while user connected) ✅ |

### Upstash Redis Free Plan

| Resource | Free Limit | Projected Usage |
|---|---|---|
| Commands/day | 10,000 | ~2,000–5,000/day ✅ |
| Max data size | 256 MB | <10 MB ✅ |
| Bandwidth | 200 MB/day | <20 MB/day ✅ |

> ⚠️ **Upstash is the tightest constraint.** At 10K commands/day, each authenticated request uses ~1 command (cache get). 10K requests/day = 10K cache reads. Heavy usage will require upgrading to Upstash pay-as-you-go (~$0.2/100K commands). Plan for upgrade at >8K req/day.

### Neon PostgreSQL Free Plan

| Resource | Free Limit | Projected Usage |
|---|---|---|
| Storage | 512 MB | <100 MB (early stage) ✅ |
| Compute | 0.25 vCPU, auto-suspend | Scales with use ✅ |
| Branches | 10 | 1 prod + dev branches ✅ |
| Connections (via Hyperdrive) | Pooled by CF | N/A ✅ |

### Total Monthly Cost Estimate

| Service | Cost |
|---|---|
| Cloudflare Workers | $0 |
| Cloudflare Queues | $0 |
| Cloudflare R2 | $0 |
| Cloudflare Durable Objects | $0 |
| Upstash Redis | $0 (within 10K/day) |
| Neon PostgreSQL | $0 (within 512 MB) |
| **Total** | **$0** |

---

## 13. wrangler.toml Structure

Each worker has its own `wrangler.toml`. The monorepo layout will be:

```
workers/
├── api-worker/
│   └── wrangler.toml
├── auth-worker/
│   └── wrangler.toml
├── finance-worker/
│   └── wrangler.toml
├── habit-worker/
│   └── wrangler.toml
├── productivity-worker/
│   └── wrangler.toml
├── notification-worker/
│   └── wrangler.toml
└── insight-worker/
    └── wrangler.toml
```

### api-worker/wrangler.toml (representative)

```toml
name = "klenzo-api"
main = "src/index.ts"
compatibility_date = "2024-09-23"

[vars]
ENVIRONMENT = "production"

[[hyperdrive]]
binding    = "HYPERDRIVE"
id         = "<hyperdrive-config-id>"

[[r2_buckets]]
binding     = "STORAGE"
bucket_name = "klenzo-storage"

[[durable_objects.bindings]]
name       = "NOTIFICATION_HUB"
class_name = "NotificationHub"
script_name = "klenzo-notification"

[[durable_objects.bindings]]
name       = "RATE_LIMITER"
class_name = "RateLimiter"
script_name = "klenzo-notification"

[[queues.producers]]
queue   = "klenzo-notifications"
binding = "NOTIFICATIONS_QUEUE"

# Service bindings to domain workers
[[services]]
binding = "AUTH"
service = "klenzo-auth"

[[services]]
binding = "FINANCE"
service = "klenzo-finance"

[[services]]
binding = "HABIT"
service = "klenzo-habit"

[[services]]
binding = "PRODUCTIVITY"
service = "klenzo-productivity"

[[services]]
binding = "NOTIFICATION"
service = "klenzo-notification"

[[services]]
binding = "INSIGHT"
service = "klenzo-insight"

[secrets]
# Set via: wrangler secret put JWT_SECRET
# JWT_SECRET
# UPSTASH_REDIS_REST_URL
# UPSTASH_REDIS_REST_TOKEN
```

---

## 14. Deployment Topology

```
GitHub Actions CI
    │
    │  wrangler deploy --env production
    ▼
Cloudflare Zones
    ├── api.klenzo.app  → api-worker (Worker Route)
    └── assets.klenzo.app → R2 bucket (Custom Domain)

Internal (Service Bindings — no public routes)
    ├── klenzo-auth
    ├── klenzo-finance
    ├── klenzo-habit
    ├── klenzo-productivity
    ├── klenzo-notification
    └── klenzo-insight
```

Workers are deployed globally to Cloudflare's 300+ PoPs automatically. No region selection needed.

### Environments

```
workers/{name}/wrangler.toml

[env.staging]
name = "klenzo-{name}-staging"
vars = { ENVIRONMENT = "staging" }

[env.production]
name = "klenzo-{name}"
vars = { ENVIRONMENT = "production" }
```

---

## 15. Key Differences from NestJS Architecture

| Aspect | Current (NestJS) | Target (Workers) | Impact |
|---|---|---|---|
| HTTP framework | Express via NestJS | Web Fetch API | Rewrite controllers as fetch handlers |
| Dependency injection | NestJS `@Injectable()` | Manual / Hono.js | No DI container; use function composition |
| gRPC | `@nestjs/microservices` + protobuf | Service Bindings (RPC class) | Remove proto files; use TypeScript interfaces |
| Queues | BullMQ + Redis | Cloudflare Queues | Same model, different SDK |
| WebSockets | Socket.IO + Gateway class | Durable Objects + WebSocket API | Rewrite gateway; same event names preserved |
| Database client | Prisma + PgBouncer | Prisma + Hyperdrive binding | Minimal change; adapter swap |
| Object storage | `@aws-sdk/client-s3` | `env.STORAGE` R2 binding | Remove SDK; use native R2 API |
| Redis client | `ioredis` | `@upstash/redis` (HTTP) | Swap client; same key/TTL design |
| Rate limiting | Nginx + ThrottlerModule | Durable Object RateLimiter | Same limits, different implementation |
| Session persistence | Redis cache (120s TTL) | Upstash Redis (same TTL) | No change |
| Audit logging | DB trigger + AuditInterceptor | DB trigger preserved; AuditInterceptor → middleware | Triggers require no migration |
| CORS | NestJS `enableCors()` | `Access-Control-Allow-Origin` headers in api-worker | Same origins |
| Env vars | `.env` file | `wrangler secret` + `[vars]` | Migrate all `.env.example` keys |
| Health checks | `/healthz` HTTP endpoints | `/healthz` on each worker | Same contract |
| Logging | Pino JSON | `console.log` + CF Workers Logs | Logpush to external sink for production |
| Monorepo tooling | Nx + Webpack | Wrangler + esbuild | Replace nx.json targets with wrangler commands |
