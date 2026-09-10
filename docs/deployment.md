# Deployment Guide

## Overview

This guide covers deploying the Klenzo Backend microservices architecture in various environments.

## Prerequisites

- Node.js 20+
- Docker & Docker Compose
- PostgreSQL 15+ (or use Docker)
- Redis 7+ (or use Docker)

## Local Development

### Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/Ki-Will/Klenzo-backend.git
cd Klenzo-backend

# 2. Install dependencies
npm install

# 3. Copy environment file
cp .env.example .env
# Edit .env with your configuration

# 4. Start infrastructure only
docker-compose up -d postgres redis mailpit minio

# 5. Run database migrations (including audit triggers)
npx prisma migrate deploy

# 6. Generate Prisma Client
npx prisma generate

# 7. Seed database (optional)
npm run seed

# 8. Start development server
npm run dev
```

### Full Docker Stack

```bash
# Build and run everything
docker-compose up --build -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f nginx
docker-compose logs -f auth-service
docker-compose logs -f finance-service
```

### Accessing Services

| Service | URL |
|---------|-----|
| API Gateway | http://localhost |
| Swagger Docs | http://localhost:3000/api/docs |
| Mailpit UI | http://localhost:8025 |
| MinIO Console | http://localhost:9001 |
| PostgreSQL | localhost:5432 |
| Redis | localhost:6379 |

## Production Deployment

### Option A: Render

Each service can be deployed as a separate Render service:

```yaml
# render.yaml (simplified)
services:
  - type: web
    name: klenzo-auth-service
    runtime: node
    buildCommand: npm ci && npx prisma generate && npx nx build auth-service --prod
    startCommand: node dist/apps/auth-service/main.js
    envVars:
      - key: NODE_ENV
        value: production
      - key: DATABASE_URL
        sync: false
      - key: JWT_SECRET
        generateValue: true
```

### Option B: Railway

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Create project
railway init

# Add PostgreSQL
railway add postgresql

# Add Redis
railway add redis

# Deploy
railway up
```

### Option C: Docker Compose (VPS)

```bash
# On your VPS
git clone https://github.com/Ki-Will/Klenzo-backend.git
cd Klenzo-backend

# Create production .env
cat > .env << EOF
NODE_ENV=production
DATABASE_URL=postgresql://user:pass@your-db-host:5432/klenzo_db
REDIS_HOST=your-redis-host
REDIS_PORT=6379
JWT_SECRET=$(openssl rand -hex 32)
AUTH_GRPC_URL=auth-service:5001
FINANCE_GRPC_URL=finance-service:5002
EOF

# Deploy
docker-compose -f docker-compose.yml up -d --build
```

## Environment Variables

### Required

| Variable | Description | Example |
|----------|-------------|---------|
| `NODE_ENV` | Environment | `production` |
| `DATABASE_URL` | PostgreSQL connection | `postgresql://user:pass@host:5432/db` |
| `JWT_SECRET` | Secret for JWT signing | `your-32-char-random-secret` |

### Service Discovery (gRPC)

| Variable | Description | Default |
|----------|-------------|---------|
| `AUTH_GRPC_URL` | Auth service gRPC endpoint | `localhost:5001` |
| `FINANCE_GRPC_URL` | Finance service gRPC endpoint | `localhost:5002` |
| `AUTH_GRPC_PORT` | Auth gRPC port | `5001` |
| `FINANCE_GRPC_PORT` | Finance gRPC port | `5002` |

### External Services

| Variable | Description |
|----------|-------------|
| `REDIS_HOST` | Redis host |
| `REDIS_PORT` | Redis port |
| `SMTP_HOST` | SMTP server host |
| `SMTP_PORT` | SMTP server port |
| `SMTP_USER` | SMTP username |
| `SMTP_PASSWORD` | SMTP password |
| `R2_BUCKET_NAME` | Object storage bucket |
| `R2_ACCESS_KEY_ID` | Object storage access key |
| `R2_SECRET_ACCESS_KEY` | Object storage secret key |

## Database Setup

### Initial Setup

```bash
# Run all migrations
npx prisma migrate deploy

# Generate client
npx prisma generate

# Verify triggers are created
psql $DATABASE_URL -c "\df public.*"
```

### Migration Structure

```
prisma/migrations/
├── 20260909000000_0_init_v1/
│   └── migration.sql              # Initial schema
├── 20260909010000_1_v2_optimized_fintech_engine/
│   └── migration.sql              # V2 optimized schema
└── 20260909020000_2_finance_audit_triggers/
    └── migration.sql              # Database triggers & procedures
```

### Creating New Migrations

```bash
# After schema changes
npx prisma migrate dev --name description

# Review the generated SQL
# Apply to production
npx prisma migrate deploy
```

## Health Checks

All services expose health check endpoints:

```bash
# Check individual service
curl http://localhost:3001/healthz
curl http://localhost:3002/healthz
curl http://localhost:3003/healthz

# Check via Nginx
curl http://localhost/healthz
curl http://localhost/healthz/auth
curl http://localhost/healthz/finance
```

## Monitoring

### Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f auth-service
docker-compose logs -f finance-service

# Last 100 lines
docker-compose logs --tail 100 nginx
```

### Metrics

Prometheus metrics available at `/metrics` endpoint (when enabled):

```
http://localhost:3000/metrics
```

### Audit Logs

```bash
# Query finance events via API
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost/api/audit/finance/events?limit=50

# Direct database query
psql $DATABASE_URL -c "
  SELECT * FROM public.finance_events 
  ORDER BY created_at DESC 
  LIMIT 10
"
```

## Scaling

### Horizontal Scaling

Each service can be scaled independently:

```bash
# Docker Compose
docker-compose up -d --scale auth-service=3

# Kubernetes
kubectl scale deployment auth-service --replicas=3
```

### Database

- Use connection pooling (PgBouncer)
- Read replicas for analytics queries
- Connection limits per service

### Redis

- Redis Cluster for high availability
- Separate instances for cache vs pub/sub

## Backup & Recovery

### Database Backup

```bash
# Full backup
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql

# Restore
psql $DATABASE_URL < backup_20260101.sql
```

### Redis Backup

```bash
# Save snapshot
docker-compose exec redis redis-cli BGSAVE

# Copy dump
docker cp klenzo_redis_1:/data/dump.rdb ./redis_backup.rdb
```

## Troubleshooting

### Common Issues

**Service won't start:**
```bash
# Check logs
docker-compose logs service-name

# Verify database connection
docker-compose exec postgres psql -U klenzo -d klenzo_db -c "SELECT 1"
```

**gRPC connection failed:**
```bash
# Verify service is running
docker-compose ps auth-service

# Check gRPC port
docker-compose exec auth-service netstat -tlnp
```

**Health check failing:**
```bash
# Test directly
curl -v http://localhost:3001/healthz

# Check database
docker-compose exec postgres pg_isready -U klenzo
```
