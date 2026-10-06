# Migration Matrix — NestJS → Cloudflare Workers

> **Status:** Phase 0 — Complete  
> **Purpose:** Maps every current service, route surface, and infrastructure component to its target Worker, target technology, and migration phase.  
> **Companion docs:** [`current.md`](./current.md), [`target.md`](./target.md), [`service-boundaries.md`](./service-boundaries.md)  
> **Source of truth:** `KLENZOO_$0_FIRST_MICROSERVICE_MIGRATION.md` (implementation contract)

---

## Table of Contents

1. [Service Matrix](#1-service-matrix)
2. [Route Surface Matrix](#2-route-surface-matrix)
3. [Infrastructure Matrix](#3-infrastructure-matrix)
4. [Shared Code Matrix](#4-shared-code-matrix)
5. [Legend](#5-legend)

---

## 1. Service Matrix

| Current (NestJS) | Responsibility | Target Worker | Target Tech | Phase | Status |
|---|---|---|---|---|---|
| `apps/klenzo` (monolith) | Legacy all-in-one runtime, hosts all domain modules | — (split per domain) | Hono Workers | 4–7 | 🔲 Not started |
| `apps/auth-service` | Registration, login, tokens, identity, MFA, OAuth | `auth-worker` | Hono + Hyperdrive | 4 | 🔲 Not started |
| `apps/finance-service` | Wallets, accounts, transactions, budgets, transfers, payroll | `finance-worker` | Hono + Hyperdrive (transactions/triggers preserved) | 6 | 🔲 Not started |
| `apps/productivity-service` | Tasks, projects, productivity tracking | `productivity-worker` | Hono + Hyperdrive | 7 | 🔲 Not started |
| `apps/habit-service` | Habits, streaks, habit events | `habit-worker` | Hono + Hyperdrive | 7 | 🔲 Not started |
| `apps/notification-service` | Notification orchestration, FCM delivery | `notification-worker` | Hono + Queues + FCM | 9 | 🔲 Not started |
| `apps/insight-service` | Derived insights, analytics, aggregation | `insight-worker` | Hono + Queues (async) | 12 | 🔲 Not started |
| nginx front controller | Path-based public routing, rate limiting | `api-worker` | Hono middleware + Cloudflare routing | 1 | ✅ Scaffolded (`apps/api-worker`) |
| gRPC inter-service calls (`libs/proto`) | Service-to-service RPC | Service Bindings / RPC | Typed Worker bindings | 5 | 🔲 Not started |
| — | Cross-cutting: request ID, logging, errors, CORS, health | `api-worker` | Hono middleware | 1 | ✅ Done (14 tests passing) |

---

## 2. Route Surface Matrix

Route groups are owned per [`service-boundaries.md`](./service-boundaries.md). Migration order follows the contract's phase plan; each row switches only after contract/integration/parity tests pass.

| Route group (current) | Current handler | Target handler | Phase | Status |
|---|---|---|---|---|
| `GET /health`, `GET /version` | nginx / NestJS health modules | `api-worker` | 1 | ✅ Implemented + tested |
| `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`, `GET /auth/me` | auth-service | `api-worker` → `auth-worker` (service binding) | 4 | 🔲 Not started |
| `GET/PUT /auth/*` (profile, password, MFA, OAuth) | auth-service | `auth-worker` | 4 | 🔲 Not started |
| `/finance/*` (wallets, accounts, transactions, budgets, transfers) | finance-service | `finance-worker` via `api-worker` proxy | 6 | 🔲 Not started |
| `/habits/*` | habit-service | `habit-worker` | 7 | 🔲 Not started |
| `/productivity/*` (tasks, projects) | productivity-service | `productivity-worker` | 7 | 🔲 Not started |
| `/notifications/*` (preferences, device tokens, history) | notification-service | `notification-worker` | 9 | 🔲 Not started |
| `/insights/*`, `/analytics/*` | insight-service | `insight-worker` | 12 | 🔲 Not started |
| File upload/download (R2/MinIO routes) | klenzo monolith | `api-worker` → R2 binding | 10 | 🔲 Not started |
| WebSocket `/notifications` gateway | Socket.IO (klenzo) | Worker WebSocket + Durable Object (only if required) | 11 | 🔲 Not started |

---

## 3. Infrastructure Matrix

| Current component | Used for | Target | Phase | Status |
|---|---|---|---|---|
| NestJS runtime | HTTP/RPC server for 7 apps | Hono on Cloudflare Workers | 1–7 | 🟡 Partial (`api-worker` exists; NestJS still serves all traffic) |
| Nginx (`nginx/nginx.conf`) | Public routing, rate limits (auth 10 r/s, api 50 r/s) | Cloudflare routing + `api-worker` middleware | 1 | 🟡 Rate limiting not yet ported |
| gRPC (`libs/proto/*.proto`) | Inter-service RPC | Service Bindings with typed TS contracts | 5 | 🔲 Not started |
| BullMQ + Redis queues | Background jobs | Cloudflare Queues (`klenzo-notifications`, `klenzo-finance-events`, `klenzo-analytics`) | 8 | 🟡 Queue message contracts typed in `libs/contracts/src/queue-messages.ts` |
| Redis (ioredis) | Cache, rate limits, idempotency, short state | Upstash Redis (Redis-native workloads only) | 8 | 🔲 Not started |
| Socket.IO | Realtime notifications | Worker WebSocket + Durable Objects *only where coordination is required* | 11 | 🔲 Not started (evaluate necessity first) |
| Prisma + PostgreSQL | Source of truth (schemas, triggers, audit, finance transactions) | Same PostgreSQL via **Hyperdrive** (schema untouched) | 3 | 🟡 `libs/database` client/transaction/error layer written + tested (23 tests); no live Hyperdrive binding yet |
| Docker / Docker Compose | Dev + prod runtime | Workers deploy (`wrangler`); Compose kept for dev Postgres until Phase 13 | 1–13 | 🟡 `wrangler.jsonc` present; `docker-compose.yml` retained |
| R2 / MinIO | File storage | Cloudflare R2 (metadata stays in PostgreSQL) | 10 | 🔲 Not started |
| FCM (via notification-service) | Mobile push | FCM from `notification-worker` (unchanged provider) | 9 | 🔲 Not started |
| CI (`.github/workflows`) | Test/build pipelines | Extend with Worker typecheck/test/build targets | 1 | 🟡 Local targets exist; CI not yet extended |

---

## 4. Shared Code Matrix

Target: NestJS and Worker code both depend on framework-free shared libs under `libs/` (Phase 2 gate: *new Worker code must not import NestJS controllers/services/modules*).

| Shared lib | Contents | Consumers | Status |
|---|---|---|---|
| `libs/contracts` | RPC contracts, worker bindings, typed queue messages | Workers, NestJS (future) | ✅ Typechecks; 10 contract/serialization tests pass |
| `libs/validation` | Zod schemas for all domains + `validateOrThrow`/`validateSafe` | Workers, NestJS (future) | ✅ Typechecks; 51 schema tests pass |
| `libs/database` | Prisma/Hyperdrive client, transactions, error mapping, health | Workers | ✅ Typechecks; 23 unit tests pass |
| `libs/auth` | Worker JWT (Web Crypto), PBKDF2 password, claims, Hono middleware | `api-worker`, `auth-worker` | ✅ Typechecks (tests pending) |
| `libs/shared` | Errors, responses, pagination, request ID, logger | All Workers | ✅ Typechecks (tests pending) |
| `libs/config` | Worker env interfaces, app constants | All Workers | ✅ Typechecks (tests pending) |
| `libs/events` | Domain events, event type constants, queue publisher | Producers/consumers | ✅ Typechecks (tests pending) |
| `libs/proto` (legacy) | gRPC protobuf contracts | NestJS services only | ⚠️ Removed in Phase 13, not before |

Import rule (enforced by `tsconfig.base.json` path alias `@klenzo/*` → `libs/*/src`): Worker code imports `@klenzo/*` only — never `@nestjs/*`.

---

## 5. Legend

| Symbol | Meaning |
|---|---|
| ✅ | Implemented, typechecked, tests passing |
| 🟡 | Partially in place / scaffolded |
| 🔲 | Not started |
| ⚠️ | Scheduled for removal (not before its phase gate) |

Phase numbering refers to `KLENZOO_$0_FIRST_MICROSERVICE_MIGRATION.md` §8. Live progress is tracked in [`../migration/status.md`](../migration/status.md).
