# Current Architecture — Klenzo Backend (NestJS Microservices)

> **Status:** Production-equivalent (as of 2026-10-01)  
> **Purpose:** Authoritative reference for the system being migrated to Cloudflare Workers.  
> **Source of truth:** `apps/`, `libs/proto/`, `prisma/schema.prisma`, `docker-compose.yml`, `nginx/nginx.conf`, `.env.example`

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Runtime Topology](#2-runtime-topology)
3. [Service Inventory](#3-service-inventory)
4. [API Routing (Nginx)](#4-api-routing-nginx)
5. [gRPC Contracts](#5-grpc-contracts)
6. [BullMQ Job Queues](#6-bullmq-job-queues)
7. [Redis Usage](#7-redis-usage)
8. [Socket.IO (WebSocket Gateway)](#8-socketio-websocket-gateway)
9. [Database Schema Map](#9-database-schema-map)
10. [Object Storage (R2 / MinIO)](#10-object-storage-r2--minio)
11. [Environment Variables](#11-environment-variables)
12. [CI/CD Pipeline](#12-cicd-pipeline)
13. [Operational Notes](#13-operational-notes)

---

## 1. System Overview

Klenzo Backend is an NX monorepo containing a **NestJS monolith** (`apps/klenzo`) and six independently deployable **NestJS microservices** (`apps/auth-service`, `apps/finance-service`, `apps/productivity-service`, `apps/habit-service`, `apps/notification-service`, `apps/insight-service`).

Both modes share code from `apps/klenzo/src/app/` — all domain logic, controllers, services, and guards live there. The microservices are thin wrappers that import domain modules and layer on gRPC transports.

```
Internet
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│  Nginx (port 80)                                                │
│  Rate limiting: auth=10r/s, api=50r/s                          │
│  Path-based routing to 6 upstream services                     │
└──────┬──────┬──────┬──────┬──────┬──────────────────────────────┘
       │      │      │      │      │
       ▼      ▼      ▼      ▼      ▼
    :3001  :3002  :3003  :3004  :3005  :3006
    auth   finance prod  habit  notif insight
    +gRPC  +gRPC
    :5001  :5002
       │      │
       └──────┴──────── intra-service gRPC calls
                                │
                        ┌───────┴───────┐
                        │               │
                    PostgreSQL       Redis
                    :5432            :6379
                    (shared,         (cache +
                    multi-schema)    BullMQ +
                                     Pub/Sub)
                                        │
                                    MinIO/R2
                                    :9000
```

**Two deployment modes** (mutually exclusive, controlled by Docker Compose profiles):

| Mode | Command | Use Case |
|---|---|---|
| Monolith | `docker compose --profile monolith up` | Development, simpler deployments |
| Microservices | `docker compose --profile microservices up` | Production, independent scaling |

---

## 2. Runtime Topology

### Port Map

| Service | HTTP Port | gRPC Port | Profile |
|---|---|---|---|
| klenzo (monolith) | 3000 | — | `monolith` |
| auth-service | 3001 | 5001 | `microservices` |
| finance-service | 3002 | 5002 | `microservices` |
| productivity-service | 3003 | — | `microservices` |
| habit-service | 3004 | — | `microservices` |
| notification-service | 3005 | — | `microservices` |
| insight-service | 3006 | — | `microservices` |
| Nginx gateway | 80 | — | both |
| PostgreSQL | 5432 | — | infra |
| Redis | 6379 | — | infra |
| MinIO (S3-compat) | 9000 / 9001 | — | infra |
| Mailpit (SMTP dev) | 1025 / 8025 | — | infra |

### Health Checks

Every service exposes three health endpoints (no `/api` prefix):

- `GET /healthz` — composite health (DB + Redis)
- `GET /healthz/live` — liveness (process alive)
- `GET /healthz/ready` — readiness (dependencies reachable)

Nginx aggregates them at:

```
/healthz           → auth-service
/healthz/auth      → auth-service
/healthz/finance   → finance-service
/healthz/productivity → productivity-service
/healthz/habits    → habit-service
/healthz/notifications → notification-service
/healthz/insights  → insight-service
```

---

## 3. Service Inventory

### 3.1 auth-service (HTTP :3001, gRPC :5001)

**Domain:** User identity, authentication, session management, KYC, MFA, Google OAuth.

**Modules loaded:** `AuthModule`, `KycModule`, `PrismaModule`, `RedisModule`, `LoggerModule`

**HTTP Routes (prefix: `/api/auth/`):**

| Method | Path | Guard | Description |
|---|---|---|---|
| POST | `/api/auth/register` | — | Email/password registration, sets `kz_at` + `kz_rt` cookies |
| POST | `/api/auth/login` | — | Password login, sets cookies |
| POST | `/api/auth/login/mfa` | — | TOTP second-factor login |
| POST | `/api/auth/logout` | JwtAuth | Invalidates refresh token, clears cookies |
| POST | `/api/auth/refresh` | — | Rotates tokens using `kz_rt` cookie |
| POST | `/api/auth/forgot-password` | — | Sends reset email |
| POST | `/api/auth/reset-password` | — | Applies password reset |
| GET | `/api/auth/profile` | JwtAuth | Returns current user |
| POST | `/api/auth/profile` | JwtAuth | Updates name/phone/avatar |
| POST | `/api/auth/profile/avatar` | JwtAuth | Uploads avatar to R2 (multipart) |
| POST | `/api/auth/change-password` | JwtAuth | Requires current password |
| GET | `/api/auth/sessions` | JwtAuth | Lists active sessions |
| POST | `/api/auth/sessions/:id/revoke` | JwtAuth | Revokes a specific session |
| GET | `/api/auth/google/url` | — | Returns Google OAuth redirect URL |
| GET | `/api/auth/google/callback` | — | OAuth callback, sets cookies, redirects |
| POST | `/api/auth/google/token` | — | Mobile: exchange Google ID token |
| GET | `/api/auth/mfa/status` | JwtAuth | Returns MFA enabled state |
| POST | `/api/auth/mfa/setup` | JwtAuth | Generates TOTP secret + QR code |
| POST | `/api/auth/mfa/enable` | JwtAuth | Activates MFA (requires valid TOTP) |
| POST | `/api/auth/mfa/disable` | JwtAuth | Deactivates MFA |

**KYC Routes (prefix: `/api/kyc`):**

| Method | Path | Guard | Description |
|---|---|---|---|
| GET | `/api/kyc` | JwtAuth | Get own KYC record |
| POST | `/api/kyc/submit` | JwtAuth | Submit KYC documents |
| GET | `/api/kyc/admin` | JwtAuth + ADMIN | List all pending KYC |
| POST | `/api/kyc/admin/:id/verify` | JwtAuth + ADMIN | Approve KYC record |
| POST | `/api/kyc/admin/:id/reject` | JwtAuth + ADMIN | Reject KYC record |

**gRPC Methods (proto package: `auth`, port 5001):**

| Method | Request | Response | Implemented |
|---|---|---|---|
| `ValidateToken` | `{ token: string }` | `{ isValid, userId, email, role, isActive }` | ✓ AuthGrpcService |
| `GetUserProfile` | `{ userId: string }` | `{ id, email, name, phone, avatar, role, isActive, createdAt, updatedAt }` | ✓ AuthGrpcService |
| `CheckRole` | `{ userId, requiredRole }` | `{ hasRole, actualRole }` | Defined in proto, not yet implemented |

**Redis keys used:**

| Key | TTL | Purpose |
|---|---|---|
| `user:profile:{uid}` | 120s | JWT validation cache (avoids DB hit per request) |
| BullMQ `notifications:*` | persistent | Queues welcome email on registration |

---

### 3.2 finance-service (HTTP :3002, gRPC :5002)

**Domain:** Transactions, wallets, transfers, groups, budgets, payroll, ledger, reconciliation, AML/risk, approval workflows.

**Modules loaded:** `FinanceModule`, `WalletModule`, `TransfersModule`, `PayrollModule`, `NotificationModule`, `PrismaModule`, `RedisModule`, `ClientsModule[AUTH_GRPC]`

**HTTP Routes (prefix: `/api/finance/`, `/api/wallets`, `/api/transfers`, `/api/payroll`):**

| Method | Path | Guard | Description |
|---|---|---|---|
| GET | `/api/finance/transactions` | JwtAuth | Paginated transaction list |
| POST | `/api/finance/transactions` | JwtAuth | Create transaction |
| GET | `/api/finance/transactions/:id` | JwtAuth | Single transaction |
| PATCH | `/api/finance/transactions/:id` | JwtAuth | Update transaction |
| DELETE | `/api/finance/transactions/:id` | JwtAuth | Soft-delete |
| GET | `/api/finance/accounts` | JwtAuth | User's accounts |
| POST | `/api/finance/accounts` | JwtAuth | Create account |
| GET | `/api/finance/budgets` | JwtAuth | User's budgets |
| POST | `/api/finance/budgets` | JwtAuth | Create budget |
| PATCH | `/api/finance/budgets/:id` | JwtAuth | Update budget |
| DELETE | `/api/finance/budgets/:id` | JwtAuth | Delete budget |
| GET | `/api/finance/groups` | JwtAuth | User's expense groups |
| POST | `/api/finance/groups` | JwtAuth | Create group |
| POST | `/api/finance/groups/:id/members` | JwtAuth | Add member |
| DELETE | `/api/finance/groups/:id/members/:uid` | JwtAuth | Remove member |
| GET | `/api/wallets` | JwtAuth | User's wallets |
| POST | `/api/wallets` | JwtAuth | Create wallet |
| GET | `/api/wallets/:id/ledger` | JwtAuth | Wallet ledger entries |
| POST | `/api/transfers` | JwtAuth | Initiate transfer |
| GET | `/api/transfers` | JwtAuth | Transfer history |
| GET | `/api/transfers/:id` | JwtAuth | Single transfer |
| GET | `/api/payroll/runs` | JwtAuth + ADMIN | Payroll run list |
| POST | `/api/payroll/runs` | JwtAuth + ADMIN | Create payroll run |
| GET | `/api/payroll/employees` | JwtAuth + ADMIN | Employee list |
| POST | `/api/payroll/employees` | JwtAuth + ADMIN | Add employee |

**gRPC Methods (proto package: `finance`, port 5002):**

| Method | Request | Response | Implemented |
|---|---|---|---|
| `GetUserWalletBalance` | `{ userId }` | `{ userId, mainWalletBalance, currency, hasWallet }` | ✓ FinanceGrpcService |
| `ValidateSufficientFunds` | `{ userId, amount, currency }` | `{ isSufficient, currentBalance, requestedAmount, currency }` | Defined in proto |
| `GetTransactionSummary` | `{ userId, startDate, endDate }` | `{ totalIncome, totalExpenses, netBalance, transactionCount, currency }` | Defined in proto |

**gRPC Dependency:** Calls `auth-service:5001` → `AuthService.ValidateToken` and `AuthService.GetUserProfile` to verify tokens for protected operations.

**Idempotency:** Finance mutation routes accept `Idempotency-Key` header (checked via `IdempotencyGuard`).

**BullMQ events published:**

| Queue | Job | Trigger |
|---|---|---|
| `finance-events` | `transaction-event` (created/updated/deleted) | Every transaction mutation |
| `finance-events` | `wallet-event` (balance_changed/created) | Wallet balance update |
| `finance-events` | `transfer-event` (completed/failed) | Transfer completion |
| `notifications` | `send-notification` | Transfer + transaction events → user alerts |

---

### 3.3 productivity-service (HTTP :3003)

**Domain:** Task management, priority tracking.

**Modules loaded:** `ProductivityModule`, `NotificationModule`, `PrismaModule`, `RedisModule`

**HTTP Routes (prefix: `/api/productivity/`):**

| Method | Path | Guard | Description |
|---|---|---|---|
| GET | `/api/productivity/tasks` | JwtAuth | Paginated task list with filters |
| POST | `/api/productivity/tasks` | JwtAuth | Create task |
| GET | `/api/productivity/tasks/:id` | JwtAuth | Single task |
| PATCH | `/api/productivity/tasks/:id` | JwtAuth | Update task (status, title, etc.) |
| DELETE | `/api/productivity/tasks/:id` | JwtAuth | Delete task |
| GET | `/api/productivity/stats` | JwtAuth | Task completion statistics |

---

### 3.4 habit-service (HTTP :3004)

**Domain:** Habit tracking, completion logging, streak calculation.

**Modules loaded:** `HabitModule`, `NotificationModule`, `PrismaModule`, `RedisModule`

**HTTP Routes (prefix: `/api/habits`):**

| Method | Path | Guard | Description |
|---|---|---|---|
| GET | `/api/habits` | JwtAuth | User's habits list |
| POST | `/api/habits` | JwtAuth | Create habit |
| GET | `/api/habits/:id` | JwtAuth | Single habit with logs |
| PATCH | `/api/habits/:id` | JwtAuth | Update habit |
| DELETE | `/api/habits/:id` | JwtAuth | Delete habit |
| POST | `/api/habits/:id/complete` | JwtAuth | Log completion, updates streak |
| GET | `/api/habits/:id/logs` | JwtAuth | Completion history |

---

### 3.5 notification-service (HTTP :3005)

**Domain:** Notification persistence, real-time delivery via Socket.IO, email via SMTP, bulk broadcasts.

**Modules loaded:** `NotificationModule`, `PrismaModule`, `RedisModule`

**HTTP Routes (prefix: `/api/notifications`):**

| Method | Path | Guard | Description |
|---|---|---|---|
| GET | `/api/notifications` | JwtAuth | User's notifications (paginated) |
| GET | `/api/notifications/unread-count` | JwtAuth | Count of unread notifications |
| POST | `/api/notifications/:id/read` | JwtAuth | Mark single as read |
| POST | `/api/notifications/read-all` | JwtAuth | Mark all as read |
| DELETE | `/api/notifications/:id` | JwtAuth | Dismiss notification |
| GET | `/api/notifications/banners` | — | Active system banners (public) |
| POST | `/api/notifications/admin/broadcast` | JwtAuth + ADMIN | Broadcast to all users |
| POST | `/api/notifications/admin/banner` | JwtAuth + ADMIN | Create/update system banner |

**Socket.IO Gateway:**

- Namespace: `/notifications`
- Authentication: JWT from query `?token=` or `kz_at` cookie
- CORS origin: `CORS_ORIGIN` env var

| Event (client→server) | Description |
|---|---|
| `markAsRead` | Mark notification as read |
| `heartbeat` | Keep-alive ping, returns `{ status: 'ok' }` |

| Event (server→client) | Description |
|---|---|
| `notification` | New notification for the user |
| `notification:read` | Notification marked read |
| `banner:updated` | Global banner changed |

**Email (SMTP via Nodemailer):** Sends transactional emails for registration welcome, password reset, KYC status changes, and transfer confirmations. Uses `SMTP_HOST:SMTP_PORT` with optional `SMTP_USER`/`SMTP_PASSWORD`.

---

### 3.6 insight-service (HTTP :3006)

**Domain:** Financial analytics, spending metrics, admin panel, audit log viewing, RBAC management, feature flags, metrics, consent management, approval workflows.

**Modules loaded:** `InsightModule`, `AdminModule`, `AuditModule`, `MetricsModule`, `PrismaModule`, `RedisModule`

**HTTP Routes:**

| Method | Path | Guard | Description |
|---|---|---|---|
| GET | `/api/insights/dashboard` | JwtAuth | User dashboard summary |
| GET | `/api/insights/spending` | JwtAuth | Spending by category |
| GET | `/api/insights/trends` | JwtAuth | Monthly income/expense trends |
| GET | `/api/insights/budgets` | JwtAuth | Budget vs. actual comparison |
| GET | `/api/admin/users` | JwtAuth + ADMIN | User list with filters |
| GET | `/api/admin/users/:id` | JwtAuth + ADMIN | User details |
| PATCH | `/api/admin/users/:id` | JwtAuth + ADMIN | Suspend/activate user |
| GET | `/api/admin/stats` | JwtAuth + ADMIN | Platform-wide statistics |
| GET | `/api/admin/audit-logs` | JwtAuth + ADMIN | Tamper-evident audit trail |
| GET | `/api/admin/finance-events` | JwtAuth + ADMIN | DB-level finance event log |
| GET | `/api/admin/rbac/roles` | JwtAuth + SUPERADMIN | List admin roles |
| POST | `/api/admin/rbac/roles/:role/users/:userId` | JwtAuth + SUPERADMIN | Assign role |
| DELETE | `/api/admin/rbac/roles/:role/users/:userId` | JwtAuth + SUPERADMIN | Revoke role |
| GET | `/api/admin/feature-flags` | JwtAuth + ADMIN | List feature flags |
| POST | `/api/admin/feature-flags` | JwtAuth + ADMIN | Create flag |
| PATCH | `/api/admin/feature-flags/:id` | JwtAuth + ADMIN | Update flag |
| GET | `/api/admin/approvals` | JwtAuth + ADMIN | Pending approvals |
| POST | `/api/admin/approvals/:id/approve` | JwtAuth + ADMIN | Approve request |
| POST | `/api/admin/approvals/:id/reject` | JwtAuth + ADMIN | Reject request |
| GET | `/api/admin/consent` | JwtAuth + ADMIN | User consent records |
| GET | `/api/metrics` | Internal | Prometheus-style metrics |

---

## 4. API Routing (Nginx)

Nginx (`nginx/nginx.conf`) listens on port 80 and routes by path prefix. All upstreams use Docker internal hostnames.

```
Location                     Upstream              Rate Limit Zone
──────────────────────────────────────────────────────────────────
/api/auth/                   auth_service:3001     auth_limit (10r/s)
/api/kyc                     auth_service:3001     api_limit (50r/s)
/api/finance/                finance_service:3002  api_limit (50r/s)
/api/wallets                 finance_service:3002  api_limit (50r/s)
/api/transfers               finance_service:3002  api_limit (50r/s)
/api/payroll                 finance_service:3002  api_limit (50r/s)
/api/productivity/           productivity_service  api_limit (50r/s)
/api/habits                  habit_service:3004    api_limit (50r/s)
/api/notifications           notification_service  api_limit (50r/s)
/api/insights/               insight_service:3006  api_limit (50r/s)
/api/admin/                  insight_service:3006  api_limit (50r/s)
/api/docs                    auth_service:3001     —
/healthz                     auth_service:3001     —
```

WebSocket upgrade is passed for `/api/auth/` and `/api/notifications` via `Upgrade: $http_upgrade` / `Connection: upgrade` headers.

---

## 5. gRPC Contracts

**Proto files:** `libs/proto/auth.proto`, `libs/proto/finance.proto`

### auth.proto (package: `auth`, service: `AuthService`)

```protobuf
rpc ValidateToken(ValidateTokenRequest) returns (ValidateTokenResponse)
rpc GetUserProfile(GetUserProfileRequest) returns (GetUserProfileResponse)
rpc CheckRole(CheckRoleRequest) returns (CheckRoleResponse)
```

**Used by:** finance-service, any future service needing token validation.

**Implementation:** `apps/auth-service/src/grpc/auth-grpc.service.ts` → `AuthGrpcService`

### finance.proto (package: `finance`, service: `FinanceService`)

```protobuf
rpc GetUserWalletBalance(GetUserWalletBalanceRequest) returns (GetUserWalletBalanceResponse)
rpc ValidateSufficientFunds(ValidateSufficientFundsRequest) returns (ValidateSufficientFundsResponse)
rpc GetTransactionSummary(GetTransactionSummaryRequest) returns (GetTransactionSummaryResponse)
```

**Used by:** klenzo monolith (insight calculations), potential future payroll pre-checks.

**Implementation:** `apps/finance-service/src/grpc/finance-grpc.service.ts` → `FinanceGrpcService`

---

## 6. BullMQ Job Queues

**Module:** `apps/klenzo/src/app/job-queue/` (global, available to all modules)

**Connection:** `REDIS_HOST:REDIS_PORT` (same Redis instance as cache)

**Retry policy:** 3 attempts, exponential backoff from 1s. Keep last 100 completed, 500 failed.

### Queue: `notifications`

| Job Name | Priority | Payload | Consumer Purpose |
|---|---|---|---|
| `send-notification` | 1 (security) / 5 (normal) | `{ userId, type, title, body, category, metadata }` | Persist + deliver via Socket.IO |
| `send-email` | 3 | `{ to, subject, html, template? }` | Send via Nodemailer SMTP |
| `send-bulk` | 7 | `{ userIds[], type, title, body }` | Batch notification fan-out |

### Queue: `finance-events`

| Job Name | Priority | Payload | Consumer Purpose |
|---|---|---|---|
| `transaction-event` | 2 | `{ userId, transactionId, event, data }` | Trigger insight cache invalidation + user notification |
| `wallet-event` | 1 | `{ userId, walletId, event, data }` | Low-balance alerts |
| `transfer-event` | 1 | `{ senderId, recipientId, transferId, event, data }` | Transfer confirmation notifications |

### Queue: `analytics`

| Job Name | Priority | Payload | Consumer Purpose |
|---|---|---|---|
| `track-event` | 10 (low) | `{ userId, event, properties? }` | Async analytics ingestion, insight aggregation |

---

## 7. Redis Usage

**Client:** `ioredis` v5 (`apps/klenzo/src/app/redis/redis.service.ts`)

**Connection:** `REDIS_HOST:REDIS_PORT` (defaults: `localhost:6379`)

**TLS:** Enabled in production via `REDIS_TLS=true` (maps to ioredis `tls` option)

### Cache Keys (TTL in seconds)

| Key Pattern | TTL | Data |
|---|---|---|
| `banners:active` | 300 | Active system banners array |
| `notif:user:{userId}` | 30 | User notification inbox |
| `user:profile:{userId}` | 120 | User profile for JWT validation bypass |
| `insights:dashboard:{userId}` | 120 | Aggregated dashboard metrics |

### Pub/Sub Channels (EventBusService)

Used for loose coupling between modules within the monolith. In microservices mode this is the primary intra-service event channel.

| Channel | Publisher | Subscriber(s) | Payload |
|---|---|---|---|
| `transaction.created` | FinanceService | NotificationService, InsightService | `{ userId, transactionId, amount, type }` |
| `transaction.updated` | FinanceService | NotificationService, InsightService | `{ userId, transactionId, changes }` |
| `wallet.balance_changed` | WalletService | NotificationService | `{ userId, walletId, balance, currency }` |
| `transfer.completed` | TransfersService | NotificationService | `{ senderId, recipientId, amount, currency }` |
| `user.registered` | AuthService | NotificationService | `{ userId, email, name }` |
| `user.kyc_verified` | KycService | NotificationService | `{ userId, tier }` |
| `habit.completed` | HabitService | NotificationService | `{ userId, habitId, streak }` |
| `task.completed` | ProductivityService | NotificationService | `{ userId, taskId }` |

### BullMQ (via `@nestjs/bullmq`)

BullMQ uses Redis as its backing store. Bull jobs are stored in Redis sorted sets under keys like `bull:{queue-name}:waiting`, `bull:{queue-name}:active`, etc. These co-exist with the cache keys on the same Redis instance.

---

## 8. Socket.IO (WebSocket Gateway)

**File:** `apps/klenzo/src/app/notification/notification.gateway.ts`

**Framework:** `@nestjs/websockets` + `socket.io`

**Namespace:** `/notifications`

**Authentication:** JWT extracted from:
1. Query parameter `?token=<accessToken>`
2. `kz_at` HTTP-only cookie (parsed from `handshake.headers.cookie`)

Unauthenticated connections are allowed (for public banner events) but `userId` is not set so they only receive broadcast events.

**Server-side socket tracking:**

```
userSockets: Map<userId, Set<socketId>>
```

Multiple socket IDs per user supported (multiple browser tabs / devices). When sending `sendToUser(userId, event, data)`, all sockets for that user receive the event.

**Client Events (received by server):**

| Event | Data | Behavior |
|---|---|---|
| `markAsRead` | `{ notificationId }` | Logged; actual DB write delegated to HTTP call |
| `heartbeat` | — | Returns `{ status: 'ok' }` |

**Server Events (emitted to client):**

| Event | Targeting | Trigger |
|---|---|---|
| `notification` | `sendToUser(userId, …)` | New notification created |
| `notification:read` | `sendToUser(userId, …)` | Notification marked read |
| `banner:updated` | `broadcastToAll(…)` | Admin creates/updates banner |

---

## 9. Database Schema Map

**Engine:** PostgreSQL 15  
**ORM:** Prisma 7 (`prisma/schema.prisma`) with `multiSchema` preview feature  
**Schemas:** `auth`, `productivity`, `habit`, `finance`, `notifications`, `platform`, `public`

### auth schema

| Table | Rows / Notes |
|---|---|
| `users` | Core identity: email, passwordHash, role (USER/ADMIN/SUPERADMIN), MFA secret, Google OAuth ID |
| `kyc_records` | KYC tier (TIER_0–TIER_3), status (NOT_SUBMITTED/PENDING/VERIFIED/REJECTED) |
| `admin_roles` | Code-based roles: SUPER_ADMIN, OPERATIONS_ADMIN, FINANCE_RISK_ADMIN, SUPPORT_ADMIN, ANALYTICS_ADMIN |
| `permissions` | Resource + action pairs (e.g. `users:read`, `finance:write`) |
| `admin_role_permissions` | Join: role ↔ permission |
| `admin_user_roles` | Join: user ↔ admin role |
| `consent_records` | GDPR consent per type (PRIVACY_POLICY, TERMS_OF_SERVICE, MARKETING, ANALYTICS, DATA_SHARING) |
| `policy_versions` | Policy document versions with effective dates |

### productivity schema

| Table | Rows / Notes |
|---|---|
| `tasks` | userId, title, description, status (TODO/IN_PROGRESS/DONE/CANCELLED), dueDate, priority (int) |

### habit schema

| Table | Rows / Notes |
|---|---|
| `habits` | userId, name, frequency (DAILY/WEEKLY), currentStreak, longestStreak |
| `habit_logs` | habitId, completedAt — one row per completion |

### finance schema

| Table | Rows / Notes |
|---|---|
| `wallets` | userId, balance (Decimal), currency, accountNumber (unique), isPrimary |
| `transactions` | userId, accountId, budgetId, groupId, amount, status, transactionType, category |
| `transfers` | senderId, recipient (email/phone), amount, type (P2P/MOBILE_MONEY/BANK_TRANSFER), reference (unique) |
| `accounts` | userId, name, balance, currency |
| `budgets` | userId, category, limitAmount, spent, period (MONTHLY/QUARTERLY/YEARLY/CUSTOM) |
| `groups` | createdBy, shared expense groups |
| `group_members` | userId, email, groupId |
| `payroll_runs` | period, totalAmount, status |
| `payroll_employees` | userId (nullable), name, role, salary |
| `ledger_entries` | walletId, transactionId, transferId, type (DEBIT/CREDIT), amount, balance, status (PENDING/POSTED/REVERSED) |
| `reconciliation_records` | providerName, providerRef, transactionId, ledgerEntryId, status |
| `risk_assessments` | transactionId, userId, riskScore (int), riskLevel (LOW/MEDIUM/HIGH/CRITICAL), signals (JSON), decision |
| `approval_requests` | type, requestedById, approvedById, targetType, targetId, payload (JSON), status, expiresAt |

### notifications schema

| Table | Rows / Notes |
|---|---|
| `notifications` | userId (nullable for global), type, category, title, message, isRead, isDismissed, isGlobal, priority |

### platform schema

| Table | Rows / Notes |
|---|---|
| `feature_flags` | name (unique), isEnabled, rolloutPercent, allowedUsers[], allowedRoles[], allowedCountries[], metadata (JSON) |

### public schema

| Table | Rows / Notes |
|---|---|
| `audit_logs` | actorId, actorRole, action, targetType, targetId, metadata (JSON), checksum (SHA-256), previousChecksum (chain hash) |
| `system_metrics` | metricName, value, labels (JSON), recordedAt |
| `finance_events` | Immutable append-only; populated by PostgreSQL triggers on finance tables; eventType, oldValues/newValues (JSON) |

### Database Triggers

Immutable finance audit trail is maintained by PostgreSQL triggers:

```
INSERT/UPDATE/DELETE on finance.transactions
  → trg_audit_transactions → log_finance_event() → public.finance_events

INSERT/UPDATE on finance.wallets
  → trg_audit_wallets → log_finance_event() → public.finance_events

INSERT on finance.transfers
  → trg_audit_transfers → log_finance_event() → public.finance_events
```

---

## 10. Object Storage (R2 / MinIO)

**Client:** `@aws-sdk/client-s3` (S3-compatible API)

**File:** `apps/klenzo/src/app/storage/r2.service.ts`

**Bucket:** `R2_BUCKET_NAME` (default: `klenzo-storage`)

**Usage:**

| Consumer | Folder Key | File Types |
|---|---|---|
| Auth — avatar upload | `klenzo/avatars/{uuid}.{ext}` | image/* |

**Key generation:** `{folder}/{randomUUID()}.{extension}`

**URL returned:** `${R2_PUBLIC_URL}/{key}` (stored in `users.avatar`)

**Bucket creation:** Service auto-creates bucket on startup if it doesn't exist (`HeadBucket` → `CreateBucket`).

**MinIO vs R2 difference:** ACL `public-read` is set for MinIO; skipped for Cloudflare R2 (which uses bucket policies instead).

---

## 11. Environment Variables

Full map from `.env.example`:

### Application

| Variable | Default | Required | Description |
|---|---|---|---|
| `NODE_ENV` | `development` | ✓ | `development` or `production` |
| `PORT` | `3000` | ✓ | HTTP port for monolith |
| `CORS_ORIGIN` | `http://localhost:5000` | ✓ | Allowed CORS origin |
| `FRONTEND_URL` | `http://localhost:5173` | ✓ | Frontend URL for OAuth redirects + CORS |

### Database

| Variable | Default | Required | Description |
|---|---|---|---|
| `DATABASE_URL` | `postgresql://user:password@host:5432/klenzo_db?schema=public` | ✓ | Prisma connection string. Each microservice appends `?schema={name}` |

### JWT

| Variable | Default | Required | Description |
|---|---|---|---|
| `JWT_SECRET` | — | ✓ | Must be ≥32 chars random string |
| `JWT_EXPIRES_IN` | `15m` | ✓ | Access token lifetime |

### Redis

| Variable | Default | Required | Description |
|---|---|---|---|
| `REDIS_HOST` | `localhost` | ✓ | Redis hostname |
| `REDIS_PORT` | `6379` | ✓ | Redis port |
| `REDIS_TLS` | `false` | — | Enable TLS for Redis Cloud / Upstash |
| `REDIS_URL` | `redis://localhost:6379` | — | Full URL alternative to HOST/PORT |

### Service Discovery (Microservices mode)

| Variable | Default | Description |
|---|---|---|
| `AUTH_SERVICE_PORT` | `3001` | Auth service HTTP port |
| `AUTH_GRPC_PORT` | `5001` | Auth service gRPC port |
| `AUTH_GRPC_URL` | `localhost:5001` | gRPC endpoint for auth (used by finance-service) |
| `FINANCE_SERVICE_PORT` | `3002` | Finance service HTTP port |
| `FINANCE_GRPC_PORT` | `5002` | Finance service gRPC port |
| `FINANCE_GRPC_URL` | `localhost:5002` | Finance service gRPC endpoint |
| `PRODUCTIVITY_SERVICE_PORT` | `3003` | Productivity service HTTP port |
| `HABIT_SERVICE_PORT` | `3004` | Habit service HTTP port |
| `NOTIFICATION_SERVICE_PORT` | `3005` | Notification service HTTP port |
| `INSIGHT_SERVICE_PORT` | `3006` | Insight service HTTP port |

### Email (SMTP)

| Variable | Default | Description |
|---|---|---|
| `SMTP_HOST` | `localhost` | SMTP server hostname |
| `SMTP_PORT` | `1025` | SMTP port (1025 = Mailpit dev) |
| `SMTP_USER` | — | SMTP username (blank for Mailpit) |
| `SMTP_PASSWORD` | — | SMTP password |
| `SMTP_FROM` | `noreply@localhost` | From address |

### Object Storage (R2 / MinIO)

| Variable | Default | Description |
|---|---|---|
| `R2_BUCKET_NAME` | — | Bucket name |
| `R2_PUBLIC_URL` | `/storage` | Public base URL for file links |
| `R2_ENDPOINT_URL` | `http://localhost:9000` | S3-compatible endpoint |
| `R2_ACCESS_KEY_ID` | — | Access key |
| `R2_SECRET_ACCESS_KEY` | — | Secret key |
| `R2_REGION` | `auto` | Region (`auto` for Cloudflare R2) |

### Google OAuth

| Variable | Description |
|---|---|
| `GOOGLE_CLIENT_ID` | OAuth 2.0 Client ID from Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | OAuth 2.0 Client Secret |
| `GOOGLE_REDIRECT_URI` | Must match exactly: `{API_URL}/api/auth/google/callback` |

### MFA / TOTP

| Variable | Default | Description |
|---|---|---|
| `MFA_ISSUER` | `Klenzo` | Display name in authenticator apps |

### Logging

| Variable | Default | Description |
|---|---|---|
| `LOG_LEVEL` | `info` | Pino log level (`debug`, `info`, `warn`, `error`) |

---

## 12. CI/CD Pipeline

**File:** `.github/workflows/ci.yml`  
**Triggers:** Push to `main`/`develop`, PRs to `main`/`develop`

### Jobs (in order)

```
lint  →  test  →  build  →  docker (main branch only)
```

| Job | Tool | What it does |
|---|---|---|
| `lint` | ESLint + TypeScript | Lints all NX projects; runs `tsc --noEmit` across all services |
| `test` | Jest (NX run-many) | Runs unit tests with coverage; uploads coverage artifact |
| `build` | Webpack (NX) | Builds all 7 apps to `dist/apps/` with `--configuration=production` |
| `docker` | Docker Buildx + GHCR | Builds and pushes Docker images for: monolith, auth-service, finance-service, productivity-service, habit-service, notification-service, insight-service |

**Registry:** `ghcr.io` (GitHub Container Registry)  
**Image tags:** `{branch}`, `{sha}`, `latest` (on main)

### Build scripts

`scripts/build-services.sh` — Manual multi-service build helper (used outside CI).

---

## 13. Operational Notes

### Security Headers (Nginx)

```
X-Frame-Options: SAMEORIGIN
X-XSS-Protection: 1; mode=block
X-Content-Type-Options: nosniff
Referrer-Policy: no-referrer-when-downgrade
Content-Security-Policy: default-src 'self' http: https: data: blob: 'unsafe-inline'
```

### Rate Limiting

```
auth endpoints:  10 requests/second  (burst: 20)
api endpoints:   50 requests/second  (burst: 30–50)
```

### Throttler (NestJS, production config)

```
short:  20 req / 1s window
medium: 100 req / 10s window
long:   300 req / 60s window
```

### Audit Logging (dual layer)

1. **Application layer (`AuditInterceptor`):** Every HTTP request triggers an `AuditLog` write (actor, action, target, IP, path, result, SHA-256 checksum chain).
2. **Database layer (PostgreSQL triggers):** Every `INSERT/UPDATE/DELETE` on finance tables writes to `public.finance_events` — cannot be bypassed by application code.

### Graceful Shutdown

All services listen for `SIGTERM` and `SIGINT` and call `app.close()` before exiting. Ensures open connections (DB, Redis, gRPC) are cleanly terminated.

### PgBouncer

`config/pgbouncer.ini` is present for connection pooling in production. Configured in `session` pooling mode, targets `klenzo_db` on `postgres:5432`.

### Swagger / OpenAPI

Available at `/api/docs` (non-production only). Proxied by Nginx from `auth_service:3001`.
