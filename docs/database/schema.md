# Database Schema

## Overview

Klenzo uses a **shared PostgreSQL database with schema isolation**. Each microservice has its own schema, preventing accidental cross-service queries while maintaining ACID transaction support.

## Architecture

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
       │  │   audit_logs             │  │
       │  │   finance_events         │  │
       │  │   system_metrics         │  │
       │  └──────────────────────────┘  │
       └────────────────────────────────┘
```

## Auth Schema

### users

```sql
CREATE TABLE auth.users (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email                VARCHAR UNIQUE NOT NULL,
  password_hash        VARCHAR NOT NULL,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW(),
  last_login           TIMESTAMPTZ,
  is_active            BOOLEAN DEFAULT TRUE,
  refresh_token        VARCHAR,
  refresh_token_expires TIMESTAMPTZ,
  password_reset_token VARCHAR,
  password_reset_expires TIMESTAMPTZ,
  failed_login_attempts INT DEFAULT 0,
  role                 VARCHAR DEFAULT 'USER',
  name                 VARCHAR,
  phone                VARCHAR,
  avatar               VARCHAR,
  notification_settings JSONB
);

CREATE INDEX idx_users_email_active ON auth.users (email, is_active);
CREATE INDEX idx_users_created_at ON auth.users (created_at);
```

### kyc_records

```sql
CREATE TABLE auth.kyc_records (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tier            VARCHAR DEFAULT 'TIER_0',
  status          VARCHAR DEFAULT 'NOT_SUBMITTED',
  document_type   VARCHAR,
  document_number VARCHAR,
  verified_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_kyc_status ON auth.kyc_records (status);
```

## Finance Schema

### wallets

```sql
CREATE TABLE finance.wallets (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name           VARCHAR DEFAULT 'Main Wallet',
  currency       VARCHAR DEFAULT 'USD',
  balance        DECIMAL DEFAULT 0,
  account_number VARCHAR UNIQUE NOT NULL,
  is_primary     BOOLEAN DEFAULT FALSE,
  status         VARCHAR DEFAULT 'ACTIVE',
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_wallets_user_primary ON finance.wallets (user_id, is_primary);
```

### transactions

```sql
CREATE TABLE finance.transactions (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  group_id             UUID REFERENCES finance.groups(id) ON DELETE SET NULL,
  account_id           UUID REFERENCES finance.accounts(id) ON DELETE SET NULL,
  parent_transaction_id UUID REFERENCES finance.transactions(id) ON DELETE SET NULL,
  status               VARCHAR DEFAULT 'APPROVED',
  transaction_type     VARCHAR DEFAULT 'EXPENSE',
  amount               DECIMAL NOT NULL,
  description          VARCHAR,
  category             VARCHAR,
  budget_id            UUID REFERENCES finance.budgets(id),
  date                 TIMESTAMPTZ NOT NULL,
  created_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_transactions_user_date ON finance.transactions (user_id, date);
CREATE INDEX idx_transactions_group_date ON finance.transactions (group_id, date);
CREATE INDEX idx_transactions_status ON finance.transactions (status);
CREATE INDEX idx_transactions_budget ON finance.transactions (budget_id);
CREATE INDEX idx_transactions_account ON finance.transactions (account_id);
```

### transfers

```sql
CREATE TABLE finance.transfers (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id    UUID NOT NULL REFERENCES auth.users(id),
  recipient    VARCHAR NOT NULL,
  amount       DECIMAL NOT NULL,
  currency     VARCHAR DEFAULT 'USD',
  type         VARCHAR DEFAULT 'P2P',
  status       VARCHAR DEFAULT 'COMPLETED',
  reference    VARCHAR UNIQUE NOT NULL,
  date         TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_transfers_sender_date ON finance.transfers (sender_id, date);
CREATE INDEX idx_transfers_status ON finance.transfers (status);
```

### budgets

```sql
CREATE TABLE finance.budgets (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name         VARCHAR DEFAULT 'General Budget',
  category     VARCHAR,
  type         VARCHAR DEFAULT 'expense',
  limit_amount DECIMAL NOT NULL,
  spent        DECIMAL DEFAULT 0,
  period       VARCHAR DEFAULT 'MONTHLY',
  color        VARCHAR,
  icon         VARCHAR,
  start_date   TIMESTAMPTZ,
  end_date     TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_budgets_user_category ON finance.budgets (user_id, category);
```

### payroll_runs

```sql
CREATE TABLE finance.payroll_runs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period       VARCHAR NOT NULL,
  total_amount DECIMAL NOT NULL,
  status       VARCHAR DEFAULT 'READY',
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_payroll_runs_created ON finance.payroll_runs (created_at);
```

### payroll_employees

```sql
CREATE TABLE finance.payroll_employees (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name       VARCHAR NOT NULL,
  role       VARCHAR NOT NULL,
  salary     DECIMAL NOT NULL,
  status     VARCHAR DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_payroll_employees_user ON finance.payroll_employees (user_id);
```

### groups

```sql
CREATE TABLE finance.groups (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       VARCHAR NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_groups_created_by ON finance.groups (created_by);
```

### group_members

```sql
CREATE TABLE finance.group_members (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL,
  email      VARCHAR NOT NULL,
  group_id   UUID NOT NULL REFERENCES finance.groups(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_group_members_group_user ON finance.group_members (group_id, user_id);
```

### accounts

```sql
CREATE TABLE finance.accounts (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name       VARCHAR NOT NULL,
  balance    DECIMAL DEFAULT 0,
  currency   VARCHAR DEFAULT 'USD',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_accounts_user ON finance.accounts (user_id);
```

## Productivity Schema

### tasks

```sql
CREATE TABLE productivity.tasks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       VARCHAR NOT NULL,
  description VARCHAR,
  status      VARCHAR DEFAULT 'TODO',
  due_date    TIMESTAMPTZ,
  priority    INT DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tasks_user_status ON productivity.tasks (user_id, status);
CREATE INDEX idx_tasks_due_date ON productivity.tasks (due_date);
```

## Habit Schema

### habits

```sql
CREATE TABLE habit.habits (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name                VARCHAR NOT NULL,
  description         VARCHAR,
  frequency           VARCHAR NOT NULL,
  current_streak      INT DEFAULT 0,
  longest_streak      INT DEFAULT 0,
  last_completed_date TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_habits_user ON habit.habits (user_id);
```

### habit_logs

```sql
CREATE TABLE habit.habit_logs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  habit_id     UUID NOT NULL REFERENCES habit.habits(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_habit_logs_habit_date ON habit.habit_logs (habit_id, completed_at);
```

## Notifications Schema

### notifications

```sql
CREATE TABLE notifications.notifications (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID REFERENCES auth.users(id),
  type         VARCHAR DEFAULT 'INFO',
  category     VARCHAR DEFAULT 'NOTIFICATION',
  title        VARCHAR NOT NULL,
  message      VARCHAR,
  is_read      BOOLEAN DEFAULT FALSE,
  is_dismissed BOOLEAN DEFAULT FALSE,
  is_global    BOOLEAN DEFAULT FALSE,
  color        VARCHAR,
  priority     VARCHAR DEFAULT 'normal',
  dismissible  BOOLEAN DEFAULT TRUE,
  link         VARCHAR,
  link_text    VARCHAR,
  start_date   TIMESTAMPTZ,
  end_date     TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_user_read ON notifications.notifications (user_id, is_read);
CREATE INDEX idx_notifications_category ON notifications.notifications (category);
```

## Public Schema (Observability)

### audit_logs

```sql
CREATE TABLE public.audit_logs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id     UUID REFERENCES auth.users(id),
  actor_role   VARCHAR NOT NULL,
  action       VARCHAR NOT NULL,
  target_type  VARCHAR,
  target_id    UUID,
  metadata     JSONB,
  ip_address   VARCHAR,
  request_path TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_actor_created ON public.audit_logs (actor_id, created_at);
CREATE INDEX idx_audit_logs_action ON public.audit_logs (action);
```

### finance_events

```sql
CREATE TABLE public.finance_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type      VARCHAR(10) NOT NULL,
  table_name      VARCHAR(50) NOT NULL,
  record_id       UUID NOT NULL,
  user_id         UUID,
  old_values      JSONB,
  new_values      JSONB,
  changed_fields  JSONB,
  ip_address      VARCHAR(45),
  request_path    TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_finance_events_table_name ON public.finance_events (table_name);
CREATE INDEX idx_finance_events_record_id ON public.finance_events (record_id);
CREATE INDEX idx_finance_events_user_id ON public.finance_events (user_id);
CREATE INDEX idx_finance_events_event_type ON public.finance_events (event_type);
CREATE INDEX idx_finance_events_created_at ON public.finance_events (created_at);
```

### system_metrics

```sql
CREATE TABLE public.system_metrics (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_name  VARCHAR NOT NULL,
  value        DECIMAL NOT NULL,
  labels       JSONB,
  recorded_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_system_metrics_name_date ON public.system_metrics (metric_name, recorded_at);
```

## Prisma Schema

The full schema is defined in `prisma/schema.prisma` with multi-schema support:

```prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["multiSchema"]
}

datasource db {
  provider = "postgresql"
  schemas  = ["auth", "productivity", "habit", "finance", "notifications", "public"]
}
```

## Migrations

| Migration | Description |
|-----------|-------------|
| `20260909000000_0_init_v1` | Initial schema |
| `20260909010000_1_v2_optimized_fintech_engine` | V2 optimized schema |
| `20260909020000_2_finance_audit_triggers` | Database triggers & procedures |
