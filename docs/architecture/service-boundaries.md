# Service Boundaries

> **Status:** Phase 0 — Design  
> **Updated:** 2026-10-01  
> **Purpose:** Defines the exact ownership boundaries of each Cloudflare Worker — what tables it owns, what routes it handles, and the contracts it exposes to other workers.

---

## Table of Contents

1. [Ownership Model](#1-ownership-model)
2. [api-worker](#2-api-worker)
3. [auth-worker](#3-auth-worker)
4. [finance-worker](#4-finance-worker)
5. [habit-worker](#5-habit-worker)
6. [productivity-worker](#6-productivity-worker)
7. [notification-worker](#7-notification-worker)
8. [insight-worker](#8-insight-worker)
9. [Cross-Service Communication Contracts](#9-cross-service-communication-contracts)
10. [Data Flow Diagrams](#10-data-flow-diagrams)
11. [Boundary Rules](#11-boundary-rules)

---

## 1. Ownership Model

**"Owner" means:**
- The worker is the **only** entity that writes to those tables.
- Other workers that need data from those tables must call the owning worker via a **Service Binding**, never query the DB directly.
- The owner exposes a stable **RPC contract** for cross-worker calls.

**One exception: shared read-only tables.**  
`public.audit_logs`, `public.finance_events`, and `public.system_metrics` are populated by DB triggers (immutable after INSERT) and read only by `insight-worker`. Writers are the DB triggers themselves, not application code.

```
┌────────────────────────────────────────────────────────────────────────────┐
│  SCHEMA OWNERSHIP MAP                                                      │
│                                                                            │
│  auth schema        ──────▶  auth-worker                                  │
│  finance schema     ──────▶  finance-worker                               │
│  habit schema       ──────▶  habit-worker                                 │
│  productivity schema ─────▶  productivity-worker                          │
│  notifications schema ────▶  notification-worker                          │
│  platform schema    ──────▶  insight-worker (feature flags)               │
│  public schema      ──────▶  insight-worker (read) / DB triggers (write)  │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. api-worker

### Domain
Edge gateway, JWT middleware, request routing, rate limiting.

### Tables Owned
**None.** `api-worker` owns no database tables. It is a pure routing and authentication layer.

### Database Access
**None.** All DB access is delegated to domain workers via Service Bindings.

### Routes Handled Directly

| Method | Path | Action |
|---|---|---|
| GET | `/healthz` | Returns `{ status: 'ok', workers: […] }` — polls all workers |
| OPTIONS | `*` | CORS preflight response |
| WebSocket | `/ws/notifications` | Upgrades to WebSocket, routes to `NotificationHub` Durable Object |

### Routes Proxied to Domain Workers

| Path Prefix | Service Binding | Target Worker |
|---|---|---|
| `/api/auth/*` | `AUTH` | auth-worker |
| `/api/kyc*` | `AUTH` | auth-worker |
| `/api/finance/*` | `FINANCE` | finance-worker |
| `/api/wallets*` | `FINANCE` | finance-worker |
| `/api/transfers*` | `FINANCE` | finance-worker |
| `/api/payroll*` | `FINANCE` | finance-worker |
| `/api/habits*` | `HABIT` | habit-worker |
| `/api/productivity/*` | `PRODUCTIVITY` | productivity-worker |
| `/api/notifications*` | `NOTIFICATION` | notification-worker |
| `/api/insights/*` | `INSIGHT` | insight-worker |
| `/api/admin/*` | `INSIGHT` | insight-worker |
| `/api/metrics*` | `INSIGHT` | insight-worker |

### Middleware Applied in api-worker

1. **CORS** — `Access-Control-Allow-Origin: ${FRONTEND_URL}` with credentials
2. **JWT verification** — Extracts `kz_at` cookie or `Authorization: Bearer` header; validates via Upstash cache → auth-worker fallback
3. **Rate limiting** — `RateLimiter` Durable Object (10 req/s auth, 50 req/s api)
4. **Correlation ID** — Injects `X-Correlation-ID` header into every forwarded request
5. **Request logging** — Structured log per request (method, path, status, duration)

### What api-worker Does NOT Do

- No business logic
- No database queries
- No direct queue publishing (delegates to domain workers)

---

## 3. auth-worker

### Domain
User identity, authentication tokens, sessions, KYC verification, MFA (TOTP), Google OAuth, RBAC consent.

### Tables Owned

**Schema: `auth`**

| Table | Ownership | Access Pattern |
|---|---|---|
| `users` | Owned | R/W — every auth operation |
| `kyc_records` | Owned | R/W — KYC submission and verification |
| `admin_roles` | Owned | R — seed data, rarely changed |
| `permissions` | Owned | R — seed data, rarely changed |
| `admin_role_permissions` | Owned | R/W — admin role management |
| `admin_user_roles` | Owned | R/W — role assignment |
| `consent_records` | Owned | R/W — GDPR consent |
| `policy_versions` | Owned | R/W — policy version management |

### Exposed Routes

All routes are internal — accessed only via `AUTH` Service Binding from `api-worker`, or via RPC from `finance-worker` and `insight-worker`.

| Method | Internal Path | Auth Required | Description |
|---|---|---|---|
| POST | `/api/auth/register` | No | Email/password registration |
| POST | `/api/auth/login` | No | Password login |
| POST | `/api/auth/login/mfa` | No (temp token) | TOTP second factor |
| POST | `/api/auth/logout` | JWT | Invalidate refresh token |
| POST | `/api/auth/refresh` | Cookie | Rotate tokens |
| POST | `/api/auth/forgot-password` | No | Send reset email |
| POST | `/api/auth/reset-password` | Reset token | Apply reset |
| GET | `/api/auth/profile` | JWT | Current user profile |
| POST | `/api/auth/profile` | JWT | Update profile |
| POST | `/api/auth/profile/avatar` | JWT | Upload avatar to R2 |
| POST | `/api/auth/change-password` | JWT | Change password |
| GET | `/api/auth/sessions` | JWT | List sessions |
| POST | `/api/auth/sessions/:id/revoke` | JWT | Revoke session |
| GET | `/api/auth/google/url` | No | OAuth URL |
| GET | `/api/auth/google/callback` | No | OAuth callback |
| POST | `/api/auth/google/token` | No | Mobile OAuth |
| GET/POST | `/api/auth/mfa/*` | JWT | MFA management |
| GET/POST | `/api/kyc*` | JWT | KYC operations |

### RPC Contract (Service Binding)

Other workers call auth-worker via these RPC methods:

```typescript
interface AuthWorkerRPC {
  // Validate JWT and return user info (replaces auth.proto ValidateToken)
  validateToken(token: string): Promise<{
    isValid: boolean;
    userId: string;
    email: string;
    role: 'USER' | 'ADMIN' | 'SUPERADMIN';
    isActive: boolean;
  }>;

  // Get user profile by ID (replaces auth.proto GetUserProfile)
  getUserProfile(userId: string): Promise<{
    id: string;
    email: string;
    name: string | null;
    phone: string | null;
    avatar: string | null;
    role: string;
    isActive: boolean;
    createdAt: string;
  } | null>;

  // Check if user has a specific role (replaces auth.proto CheckRole)
  checkRole(userId: string, requiredRole: string): Promise<{
    hasRole: boolean;
    actualRole: string;
  }>;
}
```

**Called by:** `finance-worker` (token validation), `insight-worker` (user profile), `api-worker` (all JWT checks)

### Events Published

| Queue | Event | Trigger |
|---|---|---|
| `klenzo-notifications` | `send-email` (welcome) | User registration |
| `klenzo-notifications` | `send-email` (reset) | Password reset request |
| `klenzo-notifications` | `send-notification` (kyc-update) | KYC status change |

### R2 Usage

- Writes: `klenzo/avatars/{uuid}.{ext}` on avatar upload
- Reads: URL is stored in `users.avatar`, served directly from R2 CDN

---

## 4. finance-worker

### Domain
Transactions, accounts, budgets, groups, wallets, transfers, payroll, ledger entries, reconciliation records, AML risk assessments, approval workflows.

### Tables Owned

**Schema: `finance`**

| Table | Ownership | Access Pattern |
|---|---|---|
| `wallets` | Owned | R/W — wallet creation, balance updates |
| `transactions` | Owned | R/W — CRUD + status mutations |
| `transfers` | Owned | R/W — initiation, completion |
| `accounts` | Owned | R/W — account management |
| `budgets` | Owned | R/W — budget CRUD, spent updates |
| `groups` | Owned | R/W — group management |
| `group_members` | Owned | R/W — member add/remove |
| `payroll_runs` | Owned | R/W — payroll processing |
| `payroll_employees` | Owned | R/W — employee management |
| `ledger_entries` | Owned | W (append-only by convention), R for wallet history |
| `reconciliation_records` | Owned | R/W — reconciliation workflow |
| `risk_assessments` | Owned | W (created per transaction), R for admin review |
| `approval_requests` | Owned | R/W — approval lifecycle |

### Exposed Routes

| Method | Path | Guard | Description |
|---|---|---|---|
| GET/POST | `/api/finance/transactions*` | JWT | Transaction CRUD |
| GET/POST/DELETE | `/api/finance/accounts*` | JWT | Account management |
| GET/POST/PATCH/DELETE | `/api/finance/budgets*` | JWT | Budget management |
| GET/POST | `/api/finance/groups*` | JWT | Group management |
| GET/POST | `/api/wallets*` | JWT | Wallet management |
| GET | `/api/wallets/:id/ledger` | JWT | Wallet ledger |
| POST/GET | `/api/transfers*` | JWT | Transfer operations |
| GET/POST | `/api/payroll/*` | JWT + ADMIN | Payroll operations |

### RPC Contract (Service Binding)

```typescript
interface FinanceWorkerRPC {
  // Get primary wallet balance (replaces finance.proto GetUserWalletBalance)
  getUserWalletBalance(userId: string): Promise<{
    userId: string;
    mainWalletBalance: number;
    currency: string;
    hasWallet: boolean;
  }>;

  // Validate sufficient funds (replaces finance.proto ValidateSufficientFunds)
  validateSufficientFunds(
    userId: string,
    amount: number,
    currency: string
  ): Promise<{
    isSufficient: boolean;
    currentBalance: number;
    requestedAmount: number;
    currency: string;
  }>;

  // Get transaction summary for date range (replaces finance.proto GetTransactionSummary)
  getTransactionSummary(
    userId: string,
    startDate: string,
    endDate: string
  ): Promise<{
    totalIncome: number;
    totalExpenses: number;
    netBalance: number;
    transactionCount: number;
    currency: string;
  }>;
}
```

**Called by:** `insight-worker` (dashboard aggregates), `api-worker` (pre-flight balance checks)

### Service Binding Dependencies

| Binding | Worker | Used For |
|---|---|---|
| `AUTH` | auth-worker | Validate JWT on protected routes |

### Events Published

| Queue | Event | Trigger | Consumer |
|---|---|---|---|
| `klenzo-finance-events` | `transaction-event` | Transaction created/updated/deleted | notification-worker, insight-worker |
| `klenzo-finance-events` | `wallet-event` | Wallet balance changed | notification-worker |
| `klenzo-finance-events` | `transfer-event` | Transfer completed/failed | notification-worker |
| `klenzo-notifications` | `send-notification` | Transfer confirmation | notification-worker |
| `klenzo-analytics` | `track-event` | Finance activity | insight-worker |

### Idempotency

Finance mutation routes check `Idempotency-Key` header. Key stored in Upstash Redis with 24h TTL:

```
idempotency:{key} → { requestHash, responseBody, createdAt }
```

---

## 5. habit-worker

### Domain
Habit tracking, daily/weekly completion logs, streak calculations.

### Tables Owned

**Schema: `habit`**

| Table | Ownership | Access Pattern |
|---|---|---|
| `habits` | Owned | R/W — habit CRUD, streak updates |
| `habit_logs` | Owned | W (append-only), R for history |

### Exposed Routes

| Method | Path | Guard | Description |
|---|---|---|---|
| GET | `/api/habits` | JWT | List user's habits |
| POST | `/api/habits` | JWT | Create habit |
| GET | `/api/habits/:id` | JWT | Single habit + recent logs |
| PATCH | `/api/habits/:id` | JWT | Update habit |
| DELETE | `/api/habits/:id` | JWT | Delete habit + logs |
| POST | `/api/habits/:id/complete` | JWT | Log completion, recalculate streak |
| GET | `/api/habits/:id/logs` | JWT | Completion history (paginated) |

### RPC Contract

`habit-worker` does not currently expose RPC methods to other workers. It is a leaf service in the service graph.

### Service Binding Dependencies

| Binding | Worker | Used For |
|---|---|---|
| `AUTH` | auth-worker | JWT validation (delegated from api-worker context) |

### Events Published

| Queue | Event | Trigger | Consumer |
|---|---|---|---|
| `klenzo-notifications` | `send-notification` | Habit streak milestone (7, 14, 30, 100 days) | notification-worker |
| `klenzo-analytics` | `track-event` | Habit completion | insight-worker |

### Streak Logic

Streak recalculation happens synchronously in `habit-worker` on each completion call:

```
POST /api/habits/:id/complete
  → Insert habit_log row
  → Recalculate currentStreak:
      - Check last completedAt vs. today (DAILY) or this week (WEEKLY)
      - If consecutive: increment streak
      - If broken: reset to 1
  → Update longestStreak if currentStreak > longestStreak
  → If streak hits milestone: publish notification job
```

---

## 6. productivity-worker

### Domain
Task management, task status tracking, priority scoring.

### Tables Owned

**Schema: `productivity`**

| Table | Ownership | Access Pattern |
|---|---|---|
| `tasks` | Owned | R/W — full CRUD |

### Exposed Routes

| Method | Path | Guard | Description |
|---|---|---|---|
| GET | `/api/productivity/tasks` | JWT | Paginated task list (filter by status, dueDate, priority) |
| POST | `/api/productivity/tasks` | JWT | Create task |
| GET | `/api/productivity/tasks/:id` | JWT | Single task |
| PATCH | `/api/productivity/tasks/:id` | JWT | Update task |
| DELETE | `/api/productivity/tasks/:id` | JWT | Delete task |
| GET | `/api/productivity/stats` | JWT | Completion stats (counts by status, overdue count) |

### RPC Contract

`productivity-worker` does not currently expose RPC methods. It is a leaf service.

### Service Binding Dependencies

| Binding | Worker | Used For |
|---|---|---|
| `AUTH` | auth-worker | JWT validation |

### Events Published

| Queue | Event | Trigger | Consumer |
|---|---|---|---|
| `klenzo-notifications` | `send-notification` | Task marked DONE | notification-worker |
| `klenzo-analytics` | `track-event` | Task creation/completion | insight-worker |

---

## 7. notification-worker

### Domain
Notification persistence, real-time WebSocket delivery (via Durable Objects), email dispatch, bulk broadcasts, system banners.

### Tables Owned

**Schema: `notifications`**

| Table | Ownership | Access Pattern |
|---|---|---|
| `notifications` | Owned | R/W — create, read, mark read/dismissed |

### Exposed Routes

| Method | Path | Guard | Description |
|---|---|---|---|
| GET | `/api/notifications` | JWT | User's notification inbox (paginated) |
| GET | `/api/notifications/unread-count` | JWT | Unread count |
| POST | `/api/notifications/:id/read` | JWT | Mark single notification read |
| POST | `/api/notifications/read-all` | JWT | Mark all as read |
| DELETE | `/api/notifications/:id` | JWT | Dismiss notification |
| GET | `/api/notifications/banners` | No | Active system banners (cached) |
| POST | `/api/notifications/admin/broadcast` | JWT + ADMIN | Create global notification |
| POST | `/api/notifications/admin/banner` | JWT + ADMIN | Create/update system banner |

### Durable Object: NotificationHub

- One DO instance per user (`userId` as DO name)
- Manages all WebSocket connections for a user (multiple tabs/devices)
- When notification-worker creates a new notification, it calls the user's `NotificationHub` DO to push it over WebSocket

```
notification-worker.createNotification(userId, payload)
    │
    ├── INSERT into notifications table (Hyperdrive → Neon)
    ├── Invalidate Upstash cache key: notif:user:{userId}
    └── env.NOTIFICATION_HUB.get(doId).push(payload)
                │
            NotificationHub DO
                │
            ws.send(JSON.stringify({ event: 'notification', data: payload }))
```

### Queue Consumer: `klenzo-notifications`

notification-worker is the primary consumer of the `klenzo-notifications` queue:

| Job Type | Handler |
|---|---|
| `send-notification` | Create DB row + push to NotificationHub DO |
| `send-email` | Send via Cloudflare Email Worker or SMTP relay |
| `send-bulk` | Fan-out: create one notification row per userId in batch |

### Queue Consumer: `klenzo-finance-events`

notification-worker co-consumes `klenzo-finance-events`:

| Job Type | Handler |
|---|---|
| `transaction-event:created` | Push "New transaction" notification |
| `wallet-event:balance_changed` | Push low-balance alert if threshold crossed |
| `transfer-event:completed` | Push transfer confirmation |
| `transfer-event:failed` | Push failure alert |

### Service Binding Dependencies

| Binding | Worker | Used For |
|---|---|---|
| `AUTH` | auth-worker | WebSocket JWT validation |

### Redis Keys

| Key | TTL | Usage |
|---|---|---|
| `banners:active` | 300s | System banner cache |
| `notif:user:{userId}` | 30s | Notification inbox cache |

---

## 8. insight-worker

### Domain
Financial analytics/insights, admin panel, audit log access, RBAC management, feature flag administration, system metrics, consent management, approval workflows.

### Tables Owned (Read-heavy domain)

**Schema: `public`** (read-only from application; written only by DB triggers)

| Table | Access | Notes |
|---|---|---|
| `audit_logs` | R — query + filter | Tamper-evident chain; app never writes |
| `system_metrics` | R/W — write metrics, read aggregates | Metrics worker inserts periodically |
| `finance_events` | R — query + filter | DB trigger writes; insight queries |

**Schema: `platform`**

| Table | Access | Notes |
|---|---|---|
| `feature_flags` | R/W | Full CRUD for admin flag management |

**Cross-schema reads** (reads only, writes owned by respective workers):

| Schema | Tables Read | Purpose |
|---|---|---|
| `auth` | `users`, `admin_user_roles`, `admin_roles` | Admin user management views |
| `finance` | `transactions`, `wallets`, `risk_assessments`, `approval_requests` | Finance analytics + admin |
| `notifications` | `notifications` | Global notification admin |

> **Note:** insight-worker is the **only** worker with cross-schema read access. This is a deliberate design decision — it's the analytics layer, so it needs a global view. It **never writes** to schemas it doesn't own.

### Exposed Routes

| Method | Path | Guard | Description |
|---|---|---|---|
| GET | `/api/insights/dashboard` | JWT | User financial dashboard summary |
| GET | `/api/insights/spending` | JWT | Spending by category (chart data) |
| GET | `/api/insights/trends` | JWT | Monthly income/expense trends |
| GET | `/api/insights/budgets` | JWT | Budget vs. actual |
| GET | `/api/admin/users` | JWT + ADMIN | Platform user list |
| GET | `/api/admin/users/:id` | JWT + ADMIN | User detail |
| PATCH | `/api/admin/users/:id` | JWT + ADMIN | Suspend/activate user |
| GET | `/api/admin/stats` | JWT + ADMIN | Platform statistics |
| GET | `/api/admin/audit-logs` | JWT + ADMIN | Audit log viewer |
| GET | `/api/admin/finance-events` | JWT + ADMIN | Finance event log |
| GET/POST/DELETE | `/api/admin/rbac/*` | JWT + SUPERADMIN | RBAC management |
| GET/POST/PATCH | `/api/admin/feature-flags*` | JWT + ADMIN | Feature flag management |
| GET/POST | `/api/admin/approvals*` | JWT + ADMIN | Approval workflow |
| GET/POST | `/api/admin/consent*` | JWT + ADMIN | Consent management |
| GET | `/api/metrics` | Internal | Prometheus-compatible metrics |

### RPC Contract

insight-worker does not currently expose RPC methods. It consumes data from other workers.

### Service Binding Dependencies

| Binding | Worker | Used For |
|---|---|---|
| `AUTH` | auth-worker | User profile lookup, role check for admin routes |
| `FINANCE` | finance-worker | Transaction summary for dashboard |

### Queue Consumer: `klenzo-finance-events`

| Job Type | Handler |
|---|---|
| `transaction-event` | Invalidate `insights:dashboard:{userId}` cache key |
| `wallet-event` | Invalidate `insights:dashboard:{userId}` cache key |

### Queue Consumer: `klenzo-analytics`

| Job Type | Handler |
|---|---|
| `track-event` | Aggregate analytics data, write `system_metrics` rows |

### Redis Keys

| Key | TTL | Usage |
|---|---|---|
| `insights:dashboard:{userId}` | 120s | Dashboard aggregate cache |
| `klenzo:feature-flags:{name}` | 300s | Feature flag cache (supplement to DB) |

---

## 9. Cross-Service Communication Contracts

### Summary: Who Calls Whom

```
api-worker
    ├──── AUTH         ──▶  auth-worker
    ├──── FINANCE      ──▶  finance-worker
    ├──── HABIT        ──▶  habit-worker
    ├──── PRODUCTIVITY ──▶  productivity-worker
    ├──── NOTIFICATION ──▶  notification-worker
    └──── INSIGHT      ──▶  insight-worker

finance-worker
    └──── AUTH         ──▶  auth-worker (validateToken)

insight-worker
    ├──── AUTH         ──▶  auth-worker (getUserProfile)
    └──── FINANCE      ──▶  finance-worker (getTransactionSummary)

notification-worker
    └──── AUTH         ──▶  auth-worker (WebSocket JWT)
```

### RPC Method Directory

| Method | Owner | Callers | Replaces |
|---|---|---|---|
| `AUTH.validateToken(token)` | auth-worker | api-worker, finance-worker, notification-worker | `AuthService.ValidateToken` gRPC |
| `AUTH.getUserProfile(userId)` | auth-worker | insight-worker | `AuthService.GetUserProfile` gRPC |
| `AUTH.checkRole(userId, role)` | auth-worker | insight-worker, api-worker | `AuthService.CheckRole` gRPC |
| `FINANCE.getUserWalletBalance(userId)` | finance-worker | insight-worker | `FinanceService.GetUserWalletBalance` gRPC |
| `FINANCE.validateSufficientFunds(userId, amount, currency)` | finance-worker | (future: payment flow) | `FinanceService.ValidateSufficientFunds` gRPC |
| `FINANCE.getTransactionSummary(userId, start, end)` | finance-worker | insight-worker | `FinanceService.GetTransactionSummary` gRPC |

### Queue Event Directory

| Queue | Producers | Consumers | Events |
|---|---|---|---|
| `klenzo-notifications` | auth, finance, habit, productivity | notification-worker | send-notification, send-email, send-bulk |
| `klenzo-finance-events` | finance-worker | notification-worker, insight-worker | transaction-event, wallet-event, transfer-event |
| `klenzo-analytics` | all workers | insight-worker | track-event |

---

## 10. Data Flow Diagrams

### Flow 1: User Login

```
Client
  │ POST /api/auth/login
  ▼
api-worker
  │ (no JWT check — public route)
  │ env.AUTH.fetch(request)
  ▼
auth-worker
  │ Verify password (bcrypt)
  │ Prisma → auth.users
  │ Generate JWT (15m) + refresh token (7d)
  │ Cache user:profile:{userId} in Upstash Redis (120s)
  │ Publish klenzo-notifications: send-email (welcome if new)
  ▼
Response: { accessToken, refreshToken, user }
  │ Set-Cookie: kz_at; kz_rt
  ▼
Client
```

### Flow 2: Create Transaction

```
Client
  │ POST /api/finance/transactions
  │ Authorization: kz_at cookie
  ▼
api-worker
  │ Extract JWT from cookie
  │ Upstash get(user:profile:{userId}) → hit (120s cache)
  │ env.FINANCE.fetch(request, { userId in header })
  ▼
finance-worker
  │ Validate idempotency key (Upstash)
  │ Prisma INSERT → finance.transactions
  │ Prisma INSERT → finance.ledger_entries
  │ (DB trigger fires: INSERT → public.finance_events)
  │ env.FINANCE_EVENTS_QUEUE.send({ event: 'transaction-event', ... })
  │ env.NOTIFICATIONS_QUEUE.send({ event: 'send-notification', ... })
  ▼
Cloudflare Queue: klenzo-finance-events
  │
  ├─▶ notification-worker (consumer)
  │       │ Prisma INSERT → notifications.notifications
  │       │ NotificationHub DO.push(userId, payload)
  │       │    └─▶ WebSocket emit to client
  │
  └─▶ insight-worker (consumer)
          │ Upstash del(insights:dashboard:{userId})
```

### Flow 3: Real-Time Notification Delivery

```
Client
  │ WSS /ws/notifications?token=<jwt>
  ▼
api-worker
  │ Upgrade: websocket
  │ Verify JWT
  │ env.NOTIFICATION_HUB.get(userId).fetch(upgradeRequest)
  ▼
NotificationHub DO (per-user)
  │ acceptWebSocket(client)
  │ Store ws in Map<deviceId, WebSocket>
  │ (connection open — hibernation-compatible)
  │
  │   (Later: notification-worker calls DO via Service Binding)
  │
  ◀── env.NOTIFICATION_HUB.get(userId).push(notificationPayload)
  │
  │ ws.send(JSON.stringify({ event: 'notification', data: payload }))
  ▼
Client receives real-time push
```

### Flow 4: Finance Dashboard (with cache)

```
Client
  │ GET /api/insights/dashboard
  ▼
api-worker
  │ JWT check (Upstash cache hit)
  │ env.INSIGHT.fetch(request)
  ▼
insight-worker
  │ Upstash get(insights:dashboard:{userId}) → miss
  │ env.FINANCE.getTransactionSummary(userId, 30d)
  │     └─▶ finance-worker: Prisma query → finance.transactions
  │ env.AUTH.getUserProfile(userId)
  │     └─▶ auth-worker: Prisma query → auth.users
  │ Aggregate dashboard data
  │ Upstash set(insights:dashboard:{userId}, data, 120s)
  ▼
Response: { balance, income, expenses, budgets, recentTransactions }
```

### Flow 5: Admin Creates Broadcast Notification

```
Admin Client
  │ POST /api/notifications/admin/broadcast
  ▼
api-worker
  │ JWT check
  │ Role check: ADMIN (via auth-worker.checkRole)
  │ env.NOTIFICATION.fetch(request)
  ▼
notification-worker
  │ Verify admin role (re-check)
  │ Fetch all user IDs (query auth.users — cross-schema read via Hyperdrive)
  │ Fan-out: env.NOTIFICATIONS_QUEUE.send({ type: 'send-bulk', userIds: [...] })
  ▼
Queue consumer (notification-worker):
  │ For each userId:
  │   Prisma INSERT → notifications.notifications (isGlobal=true)
  │   NotificationHub DO.push(userId, payload)
  ▼
All online users receive WebSocket push
```

---

## 11. Boundary Rules

These rules are **enforced during code review** and validated in architecture phases:

1. **No cross-schema writes.** A worker only writes to tables in its owned schema. Cross-schema writes must go through the owning worker's Service Binding.

2. **insight-worker reads across schemas, writes only to `platform` and `public`.** This is the only exception to rule #1, and it is read-only for foreign schemas.

3. **api-worker has no DB connection.** All data access happens in domain workers. api-worker is stateless.

4. **No direct Redis Pub/Sub subscriptions.** Workers are stateless; pub/sub requires persistent connections. Use Queues for async and Service Bindings for sync.

5. **Queue consumers are idempotent.** Because Queues deliver at-least-once, every queue consumer must handle duplicate messages gracefully (e.g., `INSERT ... ON CONFLICT DO NOTHING`).

6. **Service Binding calls are synchronous; Queue messages are async.** If the caller needs the result immediately, use a Service Binding. If the caller doesn't need the result, use a Queue.

7. **JWT verification is always delegated to api-worker via Service Binding.** Domain workers trust the `X-User-ID`, `X-User-Role` headers injected by api-worker. They may perform a secondary check for sensitive operations.

8. **Durable Objects are owned by notification-worker.** `NotificationHub` and `RateLimiter` are defined in `notification-worker`'s wrangler.toml. Other workers access them via binding in their own wrangler.toml with `script_name = "klenzo-notification"`.
