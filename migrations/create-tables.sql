-- =============================================================================
-- Klenzo — create-tables.sql
-- Run after init-schemas.sql (which creates the schemas).
-- Safe to re-run: all statements use IF NOT EXISTS / DO NOTHING guards.
-- =============================================================================

-- ── Auth ──────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS auth.users (
    id                    SERIAL PRIMARY KEY,
    email                 VARCHAR(255) UNIQUE NOT NULL,
    "passwordHash"        VARCHAR(255) NOT NULL,
    "createdAt"           TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt"           TIMESTAMPTZ DEFAULT NOW(),
    "lastLogin"           TIMESTAMPTZ,
    "isActive"            BOOLEAN DEFAULT TRUE,
    "refreshToken"        TEXT,
    "refreshTokenExpires" TIMESTAMPTZ,
    "passwordResetToken"  VARCHAR(255),
    "passwordResetExpires" TIMESTAMPTZ,
    "failedLoginAttempts" INTEGER DEFAULT 0,
    role                  VARCHAR(20) DEFAULT 'user' CHECK (role IN ('user', 'admin', 'superadmin')),
    name                  VARCHAR(255),
    phone                 VARCHAR(50),
    avatar                VARCHAR(500)
);

-- ── Productivity ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS productivity.tasks (
    id          SERIAL PRIMARY KEY,
    "userId"    INTEGER NOT NULL,
    title       VARCHAR(255) NOT NULL,
    description TEXT,
    status      VARCHAR(20) DEFAULT 'todo'
                    CHECK (status IN ('todo', 'in_progress', 'done', 'cancelled')),
    "dueDate"   TIMESTAMPTZ,
    priority    INTEGER DEFAULT 0,
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

-- ── Habits ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS habit.habits (
    id                  SERIAL PRIMARY KEY,
    "userId"            INTEGER NOT NULL,
    name                VARCHAR(255) NOT NULL,
    description         TEXT,
    frequency           VARCHAR(50) NOT NULL,
    "currentStreak"     INTEGER DEFAULT 0,
    "longestStreak"     INTEGER DEFAULT 0,
    "lastCompletedDate" DATE,
    "createdAt"         TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt"         TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS habit.habit_logs (
    id            SERIAL PRIMARY KEY,
    "habitId"     INTEGER NOT NULL REFERENCES habit.habits(id) ON DELETE CASCADE,
    "completedAt" DATE NOT NULL,
    "createdAt"   TIMESTAMPTZ DEFAULT NOW()
);

-- ── Finance ───────────────────────────────────────────────────────────────────

-- Groups must exist before group_members and transactions reference them
CREATE TABLE IF NOT EXISTS finance.groups (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(255) NOT NULL,
    "createdBy" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

-- Each member row belongs to exactly one group (OneToMany on Group entity)
CREATE TABLE IF NOT EXISTS finance.group_members (
    id          SERIAL PRIMARY KEY,
    "userId"    INTEGER NOT NULL DEFAULT 0,   -- 0 = invited, not yet registered
    email       VARCHAR(255) NOT NULL,
    "groupId"   INTEGER NOT NULL REFERENCES finance.groups(id) ON DELETE CASCADE,
    "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS finance.accounts (
    id          SERIAL PRIMARY KEY,
    "userId"    INTEGER NOT NULL,
    name        VARCHAR(255) NOT NULL,
    balance     DECIMAL(15,2) DEFAULT 0,
    currency    VARCHAR(10) DEFAULT 'USD',
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS finance.budgets (
    id            SERIAL PRIMARY KEY,
    "userId"      INTEGER NOT NULL,
    category      VARCHAR(100) NOT NULL,
    "limitAmount" DECIMAL(15,2) NOT NULL,
    spent         DECIMAL(15,2) DEFAULT 0,
    period        VARCHAR(20) DEFAULT 'monthly',
    "createdAt"   TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt"   TIMESTAMPTZ DEFAULT NOW()
);

-- status and parentTransactionId support the split-expense approval flow
CREATE TABLE IF NOT EXISTS finance.transactions (
    id                    SERIAL PRIMARY KEY,
    "userId"              INTEGER NOT NULL,
    "groupId"             INTEGER REFERENCES finance.groups(id) ON DELETE SET NULL,
    "accountId"           INTEGER REFERENCES finance.accounts(id) ON DELETE SET NULL,
    "parentTransactionId" INTEGER,   -- FK to transactions.id (self-ref, added below)
    status                VARCHAR(10) DEFAULT 'approved'
                              CHECK (status IN ('pending', 'approved')),
    amount                DECIMAL(15,2) NOT NULL,
    description           TEXT,
    category              VARCHAR(100),
    "transactionType"     VARCHAR(10) NOT NULL CHECK ("transactionType" IN ('income', 'expense')),
    date                  TIMESTAMPTZ NOT NULL,
    "createdAt"           TIMESTAMPTZ DEFAULT NOW()
);

-- Self-referencing FK for split transactions (added separately to avoid forward-ref)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_transactions_parent'
          AND table_schema = 'finance'
    ) THEN
        ALTER TABLE finance.transactions
            ADD CONSTRAINT fk_transactions_parent
            FOREIGN KEY ("parentTransactionId")
            REFERENCES finance.transactions(id)
            ON DELETE SET NULL;
    END IF;
END $$;

-- ── Notifications ─────────────────────────────────────────────────────────────

CREATE TYPE IF NOT EXISTS notifications.notif_type AS ENUM ('info','success','warning','error');
CREATE TYPE IF NOT EXISTS notifications.notif_category AS ENUM ('notification','banner');

-- Wrap in DO block so re-runs don't fail if types already exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notif_type'
                   AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'notifications')) THEN
        CREATE TYPE notifications.notif_type AS ENUM ('info','success','warning','error');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notif_category'
                   AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'notifications')) THEN
        CREATE TYPE notifications.notif_category AS ENUM ('notification','banner');
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS notifications.notifications (
    id          SERIAL PRIMARY KEY,
    "userId"    INTEGER,                          -- NULL = global banner
    type        VARCHAR(10) DEFAULT 'info'
                    CHECK (type IN ('info','success','warning','error')),
    category    VARCHAR(15) DEFAULT 'notification'
                    CHECK (category IN ('notification','banner')),
    title       VARCHAR(255) NOT NULL,
    message     TEXT,
    "isRead"    BOOLEAN DEFAULT FALSE,
    "isDismissed" BOOLEAN DEFAULT FALSE,
    "isGlobal"  BOOLEAN DEFAULT FALSE,
    color       VARCHAR(7),                       -- hex e.g. '#6366f1', NULL for regular notifs
    priority    VARCHAR(10) DEFAULT 'normal'
                    CHECK (priority IN ('low','normal','high')),
    dismissible BOOLEAN DEFAULT TRUE,
    link        VARCHAR(500),
    "linkText"  VARCHAR(255),
    "startDate" TIMESTAMPTZ,
    "endDate"   TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_users_email
    ON auth.users(email);

CREATE INDEX IF NOT EXISTS idx_tasks_user
    ON productivity.tasks("userId");
CREATE INDEX IF NOT EXISTS idx_tasks_status
    ON productivity.tasks(status);

CREATE INDEX IF NOT EXISTS idx_habits_user
    ON habit.habits("userId");
CREATE INDEX IF NOT EXISTS idx_habit_logs_habit
    ON habit.habit_logs("habitId");

CREATE INDEX IF NOT EXISTS idx_groups_created_by
    ON finance.groups("createdBy");
CREATE INDEX IF NOT EXISTS idx_group_members_group
    ON finance.group_members("groupId");
CREATE INDEX IF NOT EXISTS idx_group_members_user
    ON finance.group_members("userId");

CREATE INDEX IF NOT EXISTS idx_transactions_user
    ON finance.transactions("userId");
CREATE INDEX IF NOT EXISTS idx_transactions_group
    ON finance.transactions("groupId");
CREATE INDEX IF NOT EXISTS idx_transactions_status
    ON finance.transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_parent
    ON finance.transactions("parentTransactionId");

CREATE INDEX IF NOT EXISTS idx_notifications_user
    ON notifications.notifications("userId");
CREATE INDEX IF NOT EXISTS idx_notifications_category
    ON notifications.notifications(category);
CREATE INDEX IF NOT EXISTS idx_notifications_read
    ON notifications.notifications("isRead");

-- ── Observability ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.audit_logs (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "actorId"     INTEGER,
    "actorRole"   VARCHAR(32) NOT NULL,
    action        VARCHAR(128) NOT NULL,
    "targetType"  VARCHAR(64),
    "targetId"    VARCHAR(64),
    metadata      JSONB,
    "ipAddress"   VARCHAR(45),
    "requestPath" VARCHAR(512),
    "createdAt"   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.system_metrics (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "metricName"  VARCHAR(128) NOT NULL,
    value         DECIMAL(18,4) NOT NULL,
    labels        JSONB,
    "recordedAt"  TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for Observability
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor
    ON public.audit_logs("actorId");
CREATE INDEX IF NOT EXISTS idx_audit_logs_action
    ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created
    ON public.audit_logs("createdAt");

CREATE INDEX IF NOT EXISTS idx_system_metrics_name_date
    ON public.system_metrics("metricName", "recordedAt");

