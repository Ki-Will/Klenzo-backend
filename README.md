# Klenzo Backend — Microservices Architecture & API Engine

The **Klenzo Backend** is an enterprise-grade, high-performance financial API backend built with NestJS, Prisma ORM (PostgreSQL), Redis, and Nginx. It operates on a **Modular Microservices Architecture** with **Nginx Edge Routing** and **gRPC / Redis Event Bus Inter-Service Communication**.

---

## 🏗️ Architecture Overview

```
                                 ┌───────────────────────┐
                                 │   Frontend & Mobile   │
                                 └───────────┬───────────┘
                                             │ HTTP / WebSockets
                                             ▼
                                 ┌───────────────────────┐
                                 │  Nginx Reverse Proxy  │
                                 │     (Port 80/443)     │
                                 └───────────┬───────────┘
                                             │
      ┌────────────────┬──────────────┬──────┴───────┬──────────────┬────────────────┐
      │                │              │              │              │                │
      ▼                ▼              ▼              ▼              ▼                ▼
┌───────────┐    ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐    ┌───────────┐
│   Auth    │    │  Finance  │  │Productiv. │  │  Habits   │  │Notificat. │    │ Insights  │
│  Service  │    │  Service  │  │  Service  │  │  Service  │  │  Service  │    │  Service  │
│(Port 3001)│    │(Port 3002)│  │(Port 3003)│  │(Port 3004)│  │(Port 3005)│    │(Port 3006)│
└─────┬─────┘    └─────┬─────┘  └─────┬─────┘  └─────┬─────┘  └─────┬─────┘    └─────┬─────┘
      │                │              │              │              │                │
      └────────────────┴──────────────┴──────┬───────┴──────────────┴────────────────┘
                                             │ gRPC & Redis Bus
                                             ▼
                               ┌──────────────────────────┐
                               │  PostgreSQL / Redis DB   │
                               └──────────────────────────┘
```

### Microservice Domains
1. **`auth-service`** (Port 3001): Authentication, user registration, JWT management, security, and multi-tier KYC verification.
2. **`finance-service`** (Port 3002): Financial transactions, budget auto-recalculation, wallets, transfers, and payroll runs.
3. **`productivity-service`** (Port 3003): Task priority tracking and productivity management.
4. **`habit-service`** (Port 3004): Habit tracking, frequency schedules, and completion logs.
5. **`notification-service`** (Port 3005): Real-time alerts, email delivery, and global broadcast banners.
6. **`insight-service`** (Port 3006): Financial analytics, category spending metrics, and platform admin operations.

---

## ⚡ Inter-Service Communication

- **gRPC (HTTP/2 Protocol Buffers)**: Located in `libs/proto/`, used for ultra-fast, strongly-typed synchronous RPC calls between microservices (e.g. Finance Service calling Auth Service to validate tokens/roles).
- **Redis Pub/Sub Event Bus**: Used for asynchronous background event broadcasting (e.g. transaction creation triggering notification delivery & budget recalculations).

---

## 🗄️ Database Setup & Prisma Migrations

Klenzo uses a consolidated multi-schema PostgreSQL database managed via **Prisma ORM**.

### Run Baseline & V2 Migrations
```bash
# 1. Ensure PostgreSQL is running
docker-compose up -d postgres redis

# 2. Deploy Prisma V2 Consolidated Migration
npx prisma migrate deploy

# 3. Generate Prisma Client Types
npx prisma generate
```

---

## 🚀 Production Deployment (Docker Compose)

The entire backend microservice ecosystem, Nginx edge router, and infrastructure can be built and launched with a single command:

```bash
# Build and run all microservices in production mode
docker-compose up --build -d

# Check running status of services
docker-compose ps

# View Nginx edge proxy logs
docker-compose logs -f nginx
```

### Services & Ports
- **Nginx Edge Reverse Proxy**: `http://localhost` (Port 80 / 443)
- **Auth & KYC Service**: `http://localhost:3001`
- **Finance, Wallets & Transfers Service**: `http://localhost:3002`
- **Productivity Service**: `http://localhost:3003`
- **Habits Service**: `http://localhost:3004`
- **Notification Service**: `http://localhost:3005`
- **Insight & Admin Service**: `http://localhost:3006`
- **Mailpit Email Console**: `http://localhost:8025`
- **MinIO Storage Console**: `http://localhost:9001`

---

## 🧪 Testing Suite

### Run Unit Tests
```bash
npm run test
```

### Run End-to-End (E2E) Integration Tests
```bash
npm run test:e2e
```
*(Runs NestJS Supertest suite against API endpoints across Auth, Finance, Wallets, Transfers, KYC, and Payroll).*
