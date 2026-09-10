# System Architecture

## Overview

Klenzo Backend is an enterprise-grade distributed financial and productivity platform built on a microservices architecture. The system demonstrates advanced backend engineering practices including service isolation, inter-service communication via gRPC, asynchronous event processing via Redis Pub/Sub, and database-level audit logging.

## High-Level Architecture

```
                         ┌───────────────────────┐
                         │   Frontend & Mobile   │
                         └───────────┬───────────┘
                                     │ HTTPS / WebSockets
                                     ▼
                         ┌───────────────────────┐
                         │  Nginx Reverse Proxy  │
                         │     (Port 80/443)     │
                         │   Rate Limiting       │
                         │   Load Balancing      │
                         │   Security Headers    │
                         └───────────┬───────────┘
                                     │
      ┌────────────────┬─────────────┼─────────────┬──────────────┬────────────────┐
      │                │             │             │              │                │
      ▼                ▼             ▼             ▼              ▼                ▼
┌───────────┐    ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐
│   Auth    │    │  Finance  │  │Productiv. │  │  Habits   │  │Notificat. │  │ Insights  │
│  Service  │    │  Service  │  │  Service  │  │  Service  │  │  Service  │  │  Service  │
│(HTTP:3001)│    │(HTTP:3002)│  │(HTTP:3003)│  │(HTTP:3004)│  │(HTTP:3005)│  │(HTTP:3006)│
│(gRPC:5001)│    │(gRPC:5002)│  │           │  │           │  │           │  │           │
└─────┬─────┘    └─────┬─────┘  └─────┬─────┘  └─────┬─────┘  └─────┬─────┘  └─────┬─────┘
      │                │             │             │              │                │
      └────────────────┴─────────────┴──────┬──────┴──────────────┴────────────────┘
                                            │
                                   ┌────────┴────────┐
                                   │                  │
                                   ▼                  ▼
                            ┌────────────┐    ┌────────────┐
                            │ PostgreSQL │    │   Redis    │
                            │  (Schemas) │    │   Cache    │
                            │  Triggers  │    │ Event Bus  │
                            │  Procedures│    │ Pub/Sub    │
                            └────────────┘    └────────────┘
```

## Service Decomposition

### Service Boundaries

Each microservice owns a specific business domain and has its own:

- **HTTP endpoint** (port 3001-3006) for external API access
- **gRPC endpoint** (port 5001-5002) for internal service-to-service communication
- **Database schema** for data isolation
- **Health check endpoints** for monitoring

| Service | HTTP Port | gRPC Port | Database Schema | Domain |
|---------|-----------|-----------|-----------------|--------|
| Auth Service | 3001 | 5001 | `auth` | User management, JWT, KYC |
| Finance Service | 3002 | 5002 | `finance` | Transactions, wallets, transfers |
| Productivity Service | 3003 | — | `productivity` | Tasks, priorities |
| Habit Service | 3004 | — | `habit` | Habit tracking, completions |
| Notification Service | 3005 | — | `notifications` | Alerts, emails, broadcasts |
| Insight Service | 3006 | — | `public` | Analytics, admin, audit |

### Data Isolation

Klenzo uses a **shared database with schema isolation** pattern:

- Single PostgreSQL instance
- Each service has its own schema (`auth`, `finance`, `productivity`, `habit`, `notifications`)
- Cross-schema queries are avoided; services communicate via gRPC/Redis
- Shared `public` schema for observability (audit logs, metrics)

## Inter-Service Communication

### Synchronous: gRPC

Services use gRPC for synchronous, low-latency RPC calls:

```
Finance Service                    Auth Service
      │                                │
      │  ──── ValidateToken ────────▶  │
      │                                │
      │  ◀──── TokenValid ──────────  │
      │                                │
      │  ──── GetUserProfile ───────▶  │
      │                                │
      │  ◀──── UserProfile ─────────  │
```

**Proto definitions** in `libs/proto/`:

- `auth.proto` — Token validation, user profiles, role checks
- `finance.proto` — Wallet balances, fund validation, transaction summaries

### Asynchronous: Redis Pub/Sub

Services use Redis Pub/Sub for event-driven communication:

```
Finance Service                 Redis                    Notification Service
      │                           │                              │
      │  ── transaction.created ──▶                              │
      │                           │                              │
      │                           │  ── transaction.created ──▶ │
      │                           │                              │
      │                           │  (Background: send email)   │
```

**Event Catalog**:

| Event | Publisher | Subscriber(s) | Purpose |
|-------|-----------|---------------|---------|
| `transaction.created` | Finance | Notification, Insight | Alert user, update analytics |
| `transaction.updated` | Finance | Notification, Insight | Status change notification |
| `wallet.balance_changed` | Finance | Notification | Low balance warning |
| `transfer.completed` | Finance | Notification | Transfer confirmation |
| `user.registered` | Auth | Notification | Welcome email |
| `user.kyc_verified` | Auth | Notification | KYC approval |
| `habit.completed` | Habit | Notification | Streak milestone |
| `task.completed` | Productivity | Notification | Achievement |

### Database-Level: Triggers

Critical finance operations are logged at the database level via PostgreSQL triggers:

```
INSERT/UPDATE/DELETE on finance.transactions
        │
        ▼
Trigger: trg_audit_transactions
        │
        ▼
Function: log_finance_event()
        │
        ▼
Inserts into: public.finance_events (immutable audit trail)
```

## Technology Stack

### Backend Framework
- **NestJS 11** — Progressive Node.js framework
- **TypeScript 5.9** — Type safety and developer experience
- **Nx 22** — Monorepo tooling

### Database
- **PostgreSQL 15** — Primary data store
- **Prisma 7** — Type-safe ORM with multi-schema support
- **Redis 7** — Caching, session store, event bus

### Communication
- **gRPC** — Inter-service synchronous communication
- **Protocol Buffers** — Service contract definitions
- **Redis Pub/Sub** — Asynchronous event processing

### Infrastructure
- **Nginx** — Reverse proxy, rate limiting, load balancing
- **Docker** — Containerization
- **Docker Compose** — Local development orchestration

### Security
- **JWT** — Stateless authentication
- **Passport.js** — Authentication strategies
- **bcrypt** — Password hashing
- **Helmet** — Security headers

### Monitoring
- **Pino** — Structured JSON logging
- **Prometheus** — Metrics collection
- **Custom Audit System** — Dual-layer (application + database)

## Request Flow

### External Request (HTTP)

```
Client → Nginx → Service → Controller → Service → Prisma → PostgreSQL
                        ↓
                    Redis Cache (optional)
```

### Internal Request (gRPC)

```
Service A → gRPC Client → Service B → gRPC Controller → Service → Prisma → PostgreSQL
```

### Event Processing (Async)

```
Service A → Redis Pub/Sub → Service B → Process Event → Prisma → PostgreSQL
                              ↓
                          Notification (optional)
```

## Deployment Architecture

### Local Development

```yaml
services:
  nginx          # Port 80
  auth-service   # Port 3001 (HTTP), 5001 (gRPC)
  finance-service # Port 3002 (HTTP), 5002 (gRPC)
  productivity-service  # Port 3003
  habit-service  # Port 3004
  notification-service  # Port 3005
  insight-service  # Port 3006
  postgres       # Port 5432
  redis          # Port 6379
  mailpit        # Port 8025 (email testing)
  minio          # Port 9000/9001 (object storage)
```

### Production

```
Render / Railway / AWS ECS
├── auth-service
├── finance-service
├── productivity-service
├── habit-service
├── notification-service
├── insight-service
└── nginx

External Services
├── Neon (PostgreSQL)
├── Redis Cloud
├── Cloudflare R2 (Object Storage)
└── SMTP Provider
```

## Design Decisions

### Why Shared Database with Schema Isolation?

1. **Simplified deployment** — Single database to manage
2. **ACID transactions** — Can still use distributed transactions if needed
3. **Schema isolation** — Prevents accidental cross-service queries
4. **Prisma multi-schema** — Native support for schema-per-service

### Why gRPC for Synchronous Calls?

1. **Performance** — HTTP/2, binary protocol, smaller payload
2. **Type safety** — Proto files generate TypeScript types
3. **Service contracts** — Explicit API boundaries
4. **Streaming support** — Bidirectional streaming available

### Why Redis Pub/Sub for Events?

1. **Decoupling** — Publishers don't know about subscribers
2. **Simplicity** — No message broker to manage
3. **Performance** — In-memory, sub-millisecond latency
4. **Redis already in stack** — No additional infrastructure

### Why Database Triggers for Audit?

1. **Guaranteed logging** — Cannot be bypassed by application bugs
2. **Atomicity** — Part of the same transaction
3. **Performance** — No additional network calls
4. **Forensic analysis** — Complete change history
