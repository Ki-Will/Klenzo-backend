# ── Stage 1: Build & Dependencies ──────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-linux-headers --no-cache python3 make g++

# Copy package descriptors
COPY package.json package-lock.json tsconfig.base.json nx.json ./
COPY prisma ./prisma/
COPY apps/klenzo/src/app/config ./apps/klenzo/src/app/config
COPY apps/klenzo/src/app/prisma ./apps/klenzo/src/app/prisma
COPY apps/klenzo/src/app/redis ./apps/klenzo/src/app/redis
COPY apps/klenzo/src/app/logger ./apps/klenzo/src/app/logger
COPY apps/klenzo/src/app/insight ./apps/klenzo/src/app/insight
COPY libs/proto ./libs/proto

# Install dependencies
RUN npm ci

# Generate Prisma Client
RUN npx prisma generate

# Copy insight-service source
COPY apps/insight-service ./apps/insight-service

# Build insight-service
RUN npx nx build insight-service --configuration=production

# ── Stage 2: Production Minimal Runtime ────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV APP_NAME=insight-service
ENV PORT=3006

# Security: Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001

# Copy build artifacts
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

# Install production dependencies only
COPY --from=builder /app/package.json /app/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Set user context
USER nestjs

EXPOSE 3006

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3006/healthz', (res) => { process.exit(res.statusCode === 200 ? 0 : 1); });"

CMD ["node", "dist/apps/insight-service/main.js"]
