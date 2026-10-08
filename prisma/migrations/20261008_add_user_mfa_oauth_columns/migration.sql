-- ── USER MFA + OAUTH COLUMNS ─────────────────────────────────────────────────
-- Discovered by the Phase 3 vertical slice test: prisma/schema.prisma declares
-- Google OAuth (`googleId`) and TOTP MFA (`mfaSecret`, `mfaEnabled`) on
-- auth.users, and the legacy runtime (mfa.service.ts, Google strategy) reads
-- them, but no prior migration ever created them.
-- Forward migration only: existing rows get mfaEnabled = false (column default).
-- Prisma's `migrate diff` also reports index/defaults/finance_events type drift
-- that is intentionally NOT applied (legacy DB objects must be preserved —
-- see docs/migration/status.md).

ALTER TABLE "auth"."users"
    ADD COLUMN IF NOT EXISTS "googleId" TEXT,
    ADD COLUMN IF NOT EXISTS "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS "mfaSecret" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "users_googleId_key" ON "auth"."users"("googleId");
