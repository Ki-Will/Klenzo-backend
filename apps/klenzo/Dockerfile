# ─────────────────────────────────────────────────────────────────────────────
# Klenzo — Production image  (multi-stage)
#
# Stage 1 (builder): installs all deps and compiles with webpack.
# Stage 2 (runtime): copies only the compiled output + prod deps.
# ─────────────────────────────────────────────────────────────────────────────

# ── Stage 1: build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Copy package descriptors
COPY package.json package-lock.json nx.json tsconfig*.json ./

# Install ALL dependencies (dev included — needed for nx/webpack)
RUN npm ci

# Copy Prisma schema and generate client
COPY prisma ./prisma/
RUN npx prisma generate

# Copy monolith source (main.ts + app.module.ts + all shared/feature modules)
COPY apps/klenzo ./apps/klenzo

# Copy proto files for gRPC
COPY libs/proto ./libs/proto

# Compile
RUN npx nx build klenzo --configuration=production

# ── Stage 2: runtime ──────────────────────────────────────────────────────────
FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV APP_NAME=klenzo
ENV PORT=3000

# Security: Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001

# Copy build artifacts (+ generated package.json for the app)
COPY --from=builder /app/dist/apps/klenzo/package.json ./package.json
COPY --from=builder /app/dist/apps/klenzo/package-lock.json* ./
COPY --from=builder /app/prisma ./prisma

# Install production dependencies (retry to plain install if the generated
# lockfile is not available in the dist output)
RUN npm ci --omit=dev --ignore-scripts 2>/dev/null || npm install --omit=dev --ignore-scripts
RUN npm cache clean --force

# Copy compiled application bundle
COPY --from=builder /app/dist/apps/klenzo ./

# Set user context
USER nestjs

EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/healthz', (res) => { process.exit(res.statusCode === 200 ? 0 : 1); });"

CMD ["node", "main.js"]