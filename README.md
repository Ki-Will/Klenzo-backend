# Klenzo Backend — Enterprise-Grade Distributed Financial & Productivity Platform

An enterprise-grade, high-performance microservice architecture built with NestJS, Prisma ORM (PostgreSQL), Redis, gRPC, and Nginx. Designed to demonstrate distributed systems, backend engineering, security, and infrastructure practices at scale.

---

## Architecture Overview

```
                         ┌───────────────────────┐
                         │   Frontend & Mobile   │
                         └───────────┬───────────┘
                                     │ HTTPS / WebSockets
                                     ▼
                         ┌───────────────────────┐
                         │  Nginx Reverse Proxy  │
                         │     (Port 80/443)     │
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

### Inter-Service Communication

- **gRPC (HTTP/2 Protocol Buffers)**: Synchronous RPC calls between services (e.g., Finance → Auth for token validation)
- **Redis Pub/Sub Event Bus**: Asynchronous background event broadcasting (e.g., transaction creation → notification delivery & budget recalculation)
- **Database Triggers**: Enterprise-grade audit logging at the database level for all finance operations

---

## Microservice Domains

| Service | HTTP Port | gRPC Port | Description |
|---------|-----------|-----------|-------------|
| **Auth Service** | 3001 | 5001 | Authentication, user registration, JWT management, and multi-tier KYC verification |
| **Finance Service** | 3002 | 5002 | Financial transactions, budget auto-recalculation, wallets, transfers, and payroll runs |
| **Productivity Service** | 3003 | — | Task priority tracking and productivity management |
| **Habit Service** | 3004 | — | Habit tracking, frequency schedules, and completion logs |
| **Notification Service** | 3005 | — | Real-time alerts, email delivery, and global broadcast banners |
| **Insight Service** | 3006 | — | Financial analytics, category spending metrics, and platform admin operations |

---

## Database Architecture

Klenzo uses a consolidated multi-schema PostgreSQL database managed via **Prisma ORM**, with **database-level triggers and stored procedures** for enterprise-grade audit logging:

```
                PostgreSQL
                    │
       ┌────────────┼────────────┐
       ▼            ▼            ▼
     auth         finance      habit
     schema       schema       schema
       │            │            │
     users       wallets       habits
     kyc         transactions  entries
     roles       transfers     completions
                 budgets
                 payroll
       
       ┌────────────────────────────────┐
       │         public schema          │
       │  ┌──────────────────────────┐  │
       │  │   audit_logs (triggers)  │  │
       │  │   finance_events         │  │
       │  │   system_metrics         │  │
       │  └──────────────────────────┘  │
       └────────────────────────────────┘
```

### Database-Level Audit Triggers

For critical finance operations, Klenzo uses **PostgreSQL triggers and stored procedures** to ensure every mutation is logged at the database level, regardless of the application layer:

```sql
-- Automatic logging on INSERT/UPDATE/DELETE for:
--   finance.transactions
--   finance.wallets
--   finance.transfers
--   finance.budgets

-- Each trigger fires a stored procedure that writes to:
--   public.finance_events (immutable audit trail)
```

---

## Quick Start

### Prerequisites
- Node.js 20+
- Docker & Docker Compose
- PostgreSQL (or use Docker)

### Local Development

```bash
# 1. Clone the repository
git clone https://github.com/Ki-Will/Klenzo-backend.git
cd Klenzo-backend

# 2. Install dependencies
npm install

# 3. Start infrastructure
docker-compose up -d postgres redis mailpit minio

# 4. Set up environment
cp .env.example .env
# Edit .env with your configuration

# 5. Run migrations (includes database triggers)
npx prisma migrate deploy

# 6. Generate Prisma Client
npx prisma generate

# 7. Seed database (optional)
npm run seed

# 8. Start development server (runs all microservices)
npm run dev

# Or start individual services:
npm run dev:auth
npm run dev:finance
```

### Docker Compose (Full Stack)

```bash
# Build and run all microservices
docker-compose up --build -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f nginx
```

---

## API Documentation

### Swagger/OpenAPI

When running in development mode, interactive API documentation is available at:

```
http://localhost:3000/api/docs
```

### Health Checks

Every service exposes health check endpoints:

```
GET /healthz         → Full health check (database, Redis, uptime)
GET /healthz/live    → Liveness probe (always returns OK if process is running)
GET /healthz/ready   → Readiness probe (checks database connectivity)
```

---

## Security Features

- **JWT Authentication** with refresh token rotation
- **RBAC** (USER, ADMIN, SUPERADMIN roles)
- **Global Validation** with `whitelist: true` and `forbidNonWhitelisted: true`
- **Rate Limiting** via `@nestjs/throttler`
- **CORS** with explicit origin allowlisting
- **Audit Logging** — Application-level (NestJS interceptor) + Database-level (PostgreSQL triggers)
- **Password Hashing** with bcrypt (10 rounds)
- **Account Lockout** after 5 failed login attempts
- **Cookie-based** JWT storage with httpOnly, secure, sameSite flags

---

## Enterprise Audit Logging

Klenzo implements a **dual-layer audit logging system** for maximum reliability:

### Layer 1: Application-Level (NestJS)
- `AuditInterceptor` captures all HTTP mutations (POST, PUT, PATCH, DELETE)
- Logs actor, action, target, metadata, IP address, request path
- Stored in `public.audit_logs` table

### Layer 2: Database-Level (PostgreSQL Triggers)
- **Finance events**: Automatically logged on every INSERT/UPDATE/DELETE to finance tables
- **Immutable audit trail**: `public.finance_events` table records all changes
- **Timestamp precision**: Microsecond-level timestamps for forensic analysis
- **Diff tracking**: Old and new values captured for UPDATE operations

```
finance_events table:
├── id              (UUID)
├── event_type      (INSERT | UPDATE | DELETE)
├── table_name      (transactions | wallets | transfers | budgets)
├── record_id       (UUID of affected row)
├── user_id         (Who performed the action)
├── old_values      (JSONB - previous state)
├── new_values      (JSONB - new state)
├── changed_fields  (JSONB - which fields changed)
├── ip_address      (Client IP)
├── created_at      (Timestamp with timezone)
```

---

## Inter-Service Communication

### gRPC (Synchronous)

Services communicate synchronously via gRPC for operations like:

- **Finance → Auth**: Token validation and user profile retrieval
- **Finance → Auth**: Role-based access control checks

Proto definitions are located in `libs/proto/`:

```protobuf
// auth.proto
service AuthService {
  rpc ValidateToken (ValidateTokenRequest) returns (ValidateTokenResponse);
  rpc GetUserProfile (GetUserProfileRequest) returns (GetUserProfileResponse);
  rpc CheckRole (CheckRoleRequest) returns (CheckRoleResponse);
}

// finance.proto
service FinanceService {
  rpc GetUserWalletBalance (GetUserWalletBalanceRequest) returns (GetUserWalletBalanceResponse);
  rpc ValidateSufficientFunds (ValidateSufficientFundsRequest) returns (ValidateSufficientFundsResponse);
}
```

### Redis Pub/Sub (Asynchronous)

Events are published for background processing:

```
transaction.created
    ├──→ notification-service (send transaction alert)
    └──→ finance-service (recalculate budget)

habit.completed
    └──→ notification-service (send streak notification)

user.registered
    └──→ notification-service (send welcome email)
```

### Database Triggers (Automatic)

Every finance mutation is automatically logged:

```
INSERT INTO finance.transactions
    → trigger: log_finance_event()
    → writes to: public.finance_events

UPDATE finance.wallets SET balance = ...
    → trigger: log_finance_event()
    → captures: old_balance, new_balance, diff

DELETE FROM finance.budgets
    → trigger: log_finance_event()
    → captures: deleted record snapshot
```

---

## Testing

```bash
# Unit tests
npm run test

# E2E integration tests
npm run test:e2e

# Test coverage
npx nx test klenzo --coverage
```

---

## CI/CD

GitHub Actions pipeline with:

- **Lint & Type Check** — ESLint + TypeScript compilation
- **Unit Tests** — Jest with coverage reporting
- **Build** — Production build verification
- **Docker Build** — Multi-service container builds (on main branch)

See `.github/workflows/ci.yml` for the full pipeline configuration.

---

## Deployment

### Local (Docker Compose)
```bash
docker-compose up --build -d
```

### Production (Render / Railway / etc.)

Each service is built independently using its own Dockerfile:

```bash
# Build individual service
docker build -f apps/auth-service/Dockerfile -t klenzo/auth-service .

# Or use npm scripts
npm run docker:build:auth
npm run docker:build:finance
npm run docker:build:all  # Builds all services
```

Required environment variables:

```env
NODE_ENV=production
DATABASE_URL=postgresql://...
REDIS_HOST=...
REDIS_PORT=6379
JWT_SECRET=your_secure_random_secret
AUTH_GRPC_URL=auth-service:5001
FINANCE_GRPC_URL=finance-service:5002
```

---

## Project Structure

```
Klenzo-backend/
├── apps/
│   ├── klenzo/                    # Shared kernel / library (all modules)
│   │   └── Dockerfile             # Monolith-specific Dockerfile (legacy)
│   ├── auth-service/              # Auth microservice (gRPC + HTTP)
│   │   └── Dockerfile             # Independent microservice build
│   ├── finance-service/           # Finance microservice (gRPC + HTTP)
│   │   └── Dockerfile             # Independent microservice build
│   ├── productivity-service/      # Productivity microservice
│   │   └── Dockerfile             # Independent microservice build
│   ├── habit-service/             # Habit tracking microservice
│   │   └── Dockerfile             # Independent microservice build
│   ├── notification-service/      # Notification microservice
│   │   └── Dockerfile             # Independent microservice build
│   └── insight-service/           # Analytics & admin microservice
│       └── Dockerfile             # Independent microservice build
├── libs/
│   └── proto/                     # gRPC Protocol Buffer definitions
├── prisma/
│   ├── schema.prisma              # Multi-schema database definition
│   └── migrations/                # Database migrations + triggers
├── scripts/
│   └── build-services.sh          # Build all microservices script
├── nginx/                         # Reverse proxy configuration
├── docker-compose.yml             # Full stack orchestration (uses per-service Dockerfiles)
├── Dockerfile.microservice        # Legacy monolith Dockerfile (deprecated)
├── nx.json                        # Nx workspace configuration (microservice-optimized)
└── .github/workflows/ci.yml       # CI/CD pipeline
```

---

## License

MIT
