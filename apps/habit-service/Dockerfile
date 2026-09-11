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
COPY apps/klenzo/src/app/habit ./apps/klenzo/src/app/habit
COPY libs/proto ./libs/proto

# Install dependencies
RUN npm ci

# Generate Prisma Client
RUN npx prisma generate

# Copy habit-service source
COPY apps/habit-service ./apps/habit-service

# Build habit-service
RUN npx nx build habit-service --configuration=production

# ── Stage 2: Production Minimal Runtime ────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV APP_NAME=habit-service
ENV PORT=3004

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

EXPOSE 3004

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3004/healthz', (res) => { process.exit(res.statusCode === 200 ? 0 : 1); });"

CMD ["node", "dist/apps/habit-service/main.js"]
