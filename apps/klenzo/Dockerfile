# ─────────────────────────────────────────────────────────────────────────────
# Klenzo — Production image  (multi-stage)
#
# Stage 1 (builder): installs all deps and compiles with webpack.
# Stage 2 (runtime): copies only the compiled output + prod deps.
# ─────────────────────────────────────────────────────────────────────────────

# ── Stage 1: build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Install ALL dependencies (dev included — needed for nx/webpack)
COPY package*.json nx.json tsconfig*.json ./
RUN npm ci --ignore-scripts

# Copy only the app source (not the whole monorepo)
COPY apps/klenzo ./apps/klenzo

# Compile
RUN npx nx build klenzo --configuration=production

# ── Stage 2: runtime ──────────────────────────────────────────────────────────
FROM node:20-alpine

WORKDIR /app

# The build output contains a generated package.json listing only runtime deps.
# Copy it and install production packages only.
COPY --from=builder /app/dist/apps/klenzo/package.json ./package.json
COPY --from=builder /app/dist/apps/klenzo/package-lock.json* ./
RUN npm ci --omit=dev --ignore-scripts 2>/dev/null || npm install --omit=dev --ignore-scripts

# Copy compiled application
COPY --from=builder /app/dist/apps/klenzo ./

EXPOSE 3000

CMD ["node", "main.js"]
