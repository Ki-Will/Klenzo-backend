# Docker Configuration Updates for Prisma

## Updated docker-compose.yml

Here's the complete updated docker-compose.yml with Prisma support:

```yaml
services:

  # ── Infrastructure ──────────────────────────────────────────────────────────

  postgres:
    image: postgres:15-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: klenzo
      POSTGRES_PASSWORD: klenzo_password
      POSTGRES_DB: klenzo_db
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./migrations/init-schemas.sql:/docker-entrypoint-initdb.d/01-init-schemas.sql
      - ./migrations/create-tables.sql:/docker-entrypoint-initdb.d/02-create-tables.sql
      - ./scripts/migrate.ts:/docker-entrypoint-initdb.d/03-migrate-prisma.ts:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U klenzo -d klenzo_db"]
      interval: 5s
      timeout: 5s
      retries: 10
    networks:
      - klenzo_network

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5
    networks:
      - klenzo_network

  minio:
    image: quay.io/minio/minio
    restart: unless-stopped
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: klenzo_admin
      MINIO_ROOT_PASSWORD: klenzo_password
    ports:
      - "9000:9000"   # S3 API
      - "9001:9001"   # Console → http://localhost:9001
    volumes:
      - minio_data:/data
    networks:
      - klenzo_network

  # Development-only email catcher — http://localhost:8025
  mailpit:
    image: axllent/mailpit:latest
    restart: unless-stopped
    ports:
      - "1025:1025"   # SMTP
      - "8025:8025"   # Web UI
    networks:
      - klenzo_network

  # Prisma Studio - Database GUI (Development only)
  prisma-studio:
    image: prismagraphql/prisma-studio:latest
    restart: unless-stopped
    ports:
      - "5555:5555"
    environment:
      - DATABASE_URL=postgresql://klenzo:klenzo_password@postgres:5432/klenzo_db
    depends_on:
      - postgres
    networks:
      - klenzo_network

  # ── Application ─────────────────────────────────────────────────────────────

  klenzo:
    build:
      context: .
      dockerfile: Dockerfile.dev
    restart: unless-stopped
    volumes:
      - .:/app                        # live source mount
      - node_modules_vol:/app/node_modules   # isolated node_modules
    ports:
      - "3000:3000"
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    environment:
      - NODE_ENV=development
      - PORT=3000
      # Database
      - DB_HOST=postgres
      - DB_PORT=5432
      - DB_USER=klenzo
      - DB_PASSWORD=klenzo_password
      - DB_NAME=klenzo_db
      - DATABASE_URL=postgresql://klenzo:klenzo_password@postgres:5432/klenzo_db
      # Auth
      - JWT_SECRET=secret_key
      # Email
      - SMTP_HOST=mailpit
      - SMTP_PORT=1025
      # Redis
      - REDIS_HOST=redis
      - REDIS_PORT=6379
      # Prisma
      - PRISMA_CLIENT_ENGINE_TYPE=dataproxy
      # CORS
      - CORS_ORIGIN=*
    networks:
      - klenzo_network

volumes:
  postgres_data:
  minio_data:
  node_modules_vol:

networks:
  klenzo_network:
    driver: bridge
```

## Updated Dockerfile.dev

Add this to your Dockerfile.dev:

```dockerfile
FROM node:20-alpine AS base

# Install dependencies
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma/ ./prisma/

# Install all dependencies (including dev)
RUN npm ci

# Build Prisma client
RUN npx prisma generate

# Build the application
FROM deps AS builder
WORKDIR /app

COPY . .

# Build the application
RUN npm run build

# Production image
FROM base AS runner
WORKDIR /app

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nestjs

# Copy built assets
COPY --from=builder --chown=nested:nestjs /app/dist /app/dist
COPY --from=builder --chown=nested:nestjs /app/node_modules /app/node_modules
COPY --from=builder --chown=nested:nestjs /app/prisma /app/prisma

USER nestjs

EXPOSE 3000

CMD ["node", "dist/apps/klenzo/main.js"]
```

## Prisma Schema Update for Docker

Update your prisma/schema.prisma to use environment variable:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

## Development Commands

### Start Development Environment

```bash
docker-compose up -d
```

### Run Migrations

```bash
# In container
docker exec -it klenzo-backend-1 npx prisma migrate deploy

# Or using docker-compose
docker-compose exec klenzo npx prisma migrate deploy
```

### Access Prisma Studio

```bash
# Access at http://localhost:5555
docker-compose up -d prisma-studio
```

### Check Database Connection

```bash
docker exec -it klenzo-backend-1 psql -U klenzo -d klenzo_db
```

## Production Deployment

For production, add these to your deployment:

```yaml
  klenzo:
    # ... other config
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
      # Generate Prisma client at runtime
      - PRISMA_GENERATE_AT_STARTUP=true
    command: >
      sh -c "npx prisma generate && npx prisma migrate deploy && node dist/apps/klenzo/main.js"
```