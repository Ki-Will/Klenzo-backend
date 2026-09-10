# Database Triggers & Procedures

## Overview

Klenzo implements **PostgreSQL triggers and stored procedures** for enterprise-grade audit logging. These database-level mechanisms ensure that every mutation to critical finance tables is captured at the database level, providing a complete, immutable audit trail that cannot be bypassed by application bugs.

## Architecture

```
Application Layer                    Database Layer
      │                                    │
      │  INSERT/UPDATE/DELETE              │
      ▼                                    │
┌─────────────┐                           │
│   Prisma    │                           │
│   Client    │                           │
└──────┬──────┘                           │
       │                                   │
       ▼                                   │
┌─────────────┐    ┌──────────────────────┐│
│  PostgreSQL │───▶│      Trigger         ││
│   Table     │    │  trg_audit_*         ││
└─────────────┘    └──────────┬───────────┘│
                              │            │
                              ▼            │
                    ┌─────────────────────┐│
                    │   log_finance_event()││
                    │   (Stored Procedure) ││
                    └──────────┬──────────┘│
                               │           │
                               ▼           │
                    ┌─────────────────────┐│
                    │  finance_events     ││
                    │  (Immutable Table)  ││
                    └─────────────────────┘│
```

## Triggered Tables

| Schema | Table | Trigger Name | Operations |
|--------|-------|--------------|------------|
| `finance` | `transactions` | `trg_audit_transactions` | INSERT, UPDATE, DELETE |
| `finance` | `wallets` | `trg_audit_wallets` | INSERT, UPDATE, DELETE |
| `finance` | `transfers` | `trg_audit_transfers` | INSERT, UPDATE, DELETE |
| `finance` | `budgets` | `trg_audit_budgets` | INSERT, UPDATE, DELETE |
| `finance` | `payroll_runs` | `trg_audit_payroll_runs` | INSERT, UPDATE, DELETE |
| `finance` | `payroll_employees` | `trg_audit_payroll_employees` | INSERT, UPDATE, DELETE |

## Stored Procedure: `log_finance_event()`

### Definition

```sql
CREATE OR REPLACE FUNCTION public.log_finance_event()
RETURNS TRIGGER AS $$
DECLARE
    v_event_type VARCHAR(10);
    v_old_values JSONB;
    v_new_values JSONB;
    v_changed_fields JSONB;
    v_record_id UUID;
    v_user_id UUID;
BEGIN
    -- Determine event type
    IF TG_OP = 'INSERT' THEN
        v_event_type := 'INSERT';
        v_old_values := NULL;
        v_new_values := to_jsonb(NEW);
        v_record_id := NEW.id;
    ELSIF TG_OP = 'UPDATE' THEN
        v_event_type := 'UPDATE';
        v_old_values := to_jsonb(OLD);
        v_new_values := to_jsonb(NEW);
        v_record_id := NEW.id;
        
        -- Calculate changed fields
        SELECT jsonb_object_agg(key, value)
        INTO v_changed_fields
        FROM jsonb_each(v_new_values)
        WHERE NOT v_old_values @> jsonb_build_object(key, value);
        
    ELSIF TG_OP = 'DELETE' THEN
        v_event_type := 'DELETE';
        v_old_values := to_jsonb(OLD);
        v_new_values := NULL;
        v_record_id := OLD.id;
    END IF;

    -- Try to extract user_id from the record
    BEGIN
        IF TG_OP = 'DELETE' THEN
            v_user_id := (OLD->>'userId')::UUID;
        ELSE
            v_user_id := (NEW->>'userId')::UUID;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        v_user_id := NULL;
    END;

    -- Insert the audit event
    INSERT INTO public.finance_events (
        event_type,
        table_name,
        record_id,
        user_id,
        old_values,
        new_values,
        changed_fields,
        created_at
    ) VALUES (
        v_event_type,
        TG_TABLE_NAME,
        v_record_id,
        v_user_id,
        v_old_values,
        v_new_values,
        v_changed_fields,
        NOW()
    );

    -- Return appropriate record
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;
```

### Logic Flow

1. **Determine Event Type**: Check if INSERT, UPDATE, or DELETE
2. **Capture Values**:
   - INSERT: Capture NEW state
   - UPDATE: Capture OLD and NEW state, calculate changed fields
   - DELETE: Capture OLD state
3. **Extract User ID**: Try to get `userId` from the record
4. **Insert Audit Event**: Write to `finance_events` table
5. **Return Record**: Return NEW for INSERT/UPDATE, OLD for DELETE

## Trigger Definitions

### Create Triggers

```sql
-- Transactions trigger
CREATE TRIGGER trg_audit_transactions
    AFTER INSERT OR UPDATE OR DELETE ON finance.transactions
    FOR EACH ROW
    EXECUTE FUNCTION public.log_finance_event();

-- Wallets trigger
CREATE TRIGGER trg_audit_wallets
    AFTER INSERT OR UPDATE OR DELETE ON finance.wallets
    FOR EACH ROW
    EXECUTE FUNCTION public.log_finance_event();

-- Transfers trigger
CREATE TRIGGER trg_audit_transfers
    AFTER INSERT OR UPDATE OR DELETE ON finance.transfers
    FOR EACH ROW
    EXECUTE FUNCTION public.log_finance_event();

-- Budgets trigger
CREATE TRIGGER trg_audit_budgets
    AFTER INSERT OR UPDATE OR DELETE ON finance.budgets
    FOR EACH ROW
    EXECUTE FUNCTION public.log_finance_event();

-- Payroll Runs trigger
CREATE TRIGGER trg_audit_payroll_runs
    AFTER INSERT OR UPDATE OR DELETE ON finance.payroll_runs
    FOR EACH ROW
    EXECUTE FUNCTION public.log_finance_event();

-- Payroll Employees trigger
CREATE TRIGGER trg_audit_payroll_employees
    AFTER INSERT OR UPDATE OR DELETE ON finance.payroll_employees
    FOR EACH ROW
    EXECUTE FUNCTION public.log_finance_event();
```

### Drop Triggers

```sql
DROP TRIGGER IF EXISTS trg_audit_transactions ON finance.transactions;
DROP TRIGGER IF EXISTS trg_audit_wallets ON finance.wallets;
DROP TRIGGER IF EXISTS trg_audit_transfers ON finance.transfers;
DROP TRIGGER IF EXISTS trg_audit_budgets ON finance.budgets;
DROP TRIGGER IF EXISTS trg_audit_payroll_runs ON finance.payroll_runs;
DROP TRIGGER IF EXISTS trg_audit_payroll_employees ON finance.payroll_employees;
```

## Finance Events Table

### Schema

```sql
CREATE TABLE public.finance_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type      VARCHAR(10) NOT NULL,  -- INSERT, UPDATE, DELETE
    table_name      VARCHAR(50) NOT NULL,  -- transactions, wallets, etc.
    record_id       UUID NOT NULL,         -- ID of affected record
    user_id         UUID,                  -- Who performed the action
    old_values      JSONB,                 -- Previous state (NULL for INSERT)
    new_values      JSONB,                 -- New state (NULL for DELETE)
    changed_fields  JSONB,                 -- Which fields changed (UPDATE only)
    ip_address      VARCHAR(45),           -- Client IP (enriched post-insert)
    request_path    TEXT,                  -- API endpoint (enriched post-insert)
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for fast queries
CREATE INDEX idx_finance_events_table_name ON public.finance_events (table_name);
CREATE INDEX idx_finance_events_record_id ON public.finance_events (record_id);
CREATE INDEX idx_finance_events_user_id ON public.finance_events (user_id);
CREATE INDEX idx_finance_events_event_type ON public.finance_events (event_type);
CREATE INDEX idx_finance_events_created_at ON public.finance_events (created_at);
CREATE INDEX idx_finance_events_table_record ON public.finance_events (table_name, record_id);
```

### Column Descriptions

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Unique identifier for the event |
| `event_type` | VARCHAR(10) | `INSERT`, `UPDATE`, or `DELETE` |
| `table_name` | VARCHAR(50) | Name of the finance table that was modified |
| `record_id` | UUID | ID of the affected record |
| `user_id` | UUID | UUID of the user who performed the action |
| `old_values` | JSONB | Previous state of the record (NULL for INSERT) |
| `new_values` | JSONB | New state of the record (NULL for DELETE) |
| `changed_fields` | JSONB | Object of changed fields (UPDATE only) |
| `ip_address` | VARCHAR(45) | Client IP address (enriched post-insert) |
| `request_path` | TEXT | API endpoint path (enriched post-insert) |
| `created_at` | TIMESTAMPTZ | Microsecond-precision timestamp |

## Helper Functions

### `get_finance_audit_trail()`

Get the complete audit trail for a specific record:

```sql
CREATE OR REPLACE FUNCTION public.get_finance_audit_trail(
    p_table_name VARCHAR(50),
    p_record_id UUID
)
RETURNS TABLE (
    id UUID,
    event_type VARCHAR(10),
    table_name VARCHAR(50),
    record_id UUID,
    user_id UUID,
    old_values JSONB,
    new_values JSONB,
    changed_fields JSONB,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        fe.id,
        fe.event_type,
        fe.table_name,
        fe.record_id,
        fe.user_id,
        fe.old_values,
        fe.new_values,
        fe.changed_fields,
        fe.created_at
    FROM public.finance_events fe
    WHERE fe.table_name = p_table_name
      AND fe.record_id = p_record_id
    ORDER BY fe.created_at ASC;
END;
$$ LANGUAGE plpgsql;
```

**Usage:**
```sql
-- Get full history of a transaction
SELECT * FROM public.get_finance_audit_trail('transactions', 'tx-uuid');
```

### `get_user_finance_events()`

Get all finance events for a specific user:

```sql
CREATE OR REPLACE FUNCTION public.get_user_finance_events(
    p_user_id UUID,
    p_limit INTEGER DEFAULT 100
)
RETURNS TABLE (
    id UUID,
    event_type VARCHAR(10),
    table_name VARCHAR(50),
    record_id UUID,
    old_values JSONB,
    new_values JSONB,
    changed_fields JSONB,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        fe.id,
        fe.event_type,
        fe.table_name,
        fe.record_id,
        fe.old_values,
        fe.new_values,
        fe.changed_fields,
        fe.created_at
    FROM public.finance_events fe
    WHERE fe.user_id = p_user_id
    ORDER BY fe.created_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;
```

**Usage:**
```sql
-- Get all finance events for a user
SELECT * FROM public.get_user_finance_events('user-uuid', 50);
```

### `get_recent_finance_events()`

Get recent events across all finance tables:

```sql
CREATE OR REPLACE FUNCTION public.get_recent_finance_events(
    p_limit INTEGER DEFAULT 50,
    p_table_name VARCHAR(50) DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    event_type VARCHAR(10),
    table_name VARCHAR(50),
    record_id UUID,
    user_id UUID,
    old_values JSONB,
    new_values JSONB,
    changed_fields JSONB,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        fe.id,
        fe.event_type,
        fe.table_name,
        fe.record_id,
        fe.user_id,
        fe.old_values,
        fe.new_values,
        fe.changed_fields,
        fe.created_at
    FROM public.finance_events fe
    WHERE (p_table_name IS NULL OR fe.table_name = p_table_name)
    ORDER BY fe.created_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;
```

**Usage:**
```sql
-- Get 50 most recent events
SELECT * FROM public.get_recent_finance_events(50);

-- Get 50 most recent wallet events
SELECT * FROM public.get_recent_finance_events(50, 'wallets');
```

## Event Examples

### INSERT Event

```json
{
  "event_type": "INSERT",
  "table_name": "transactions",
  "record_id": "tx-uuid",
  "user_id": "user-uuid",
  "old_values": null,
  "new_values": {
    "id": "tx-uuid",
    "userId": "user-uuid",
    "amount": 45.00,
    "description": "Grocery shopping",
    "category": "food",
    "status": "APPROVED",
    "transactionType": "EXPENSE",
    "date": "2026-01-01T00:00:00.000Z",
    "createdAt": "2026-01-01T12:00:00.000Z"
  },
  "changed_fields": null,
  "created_at": "2026-01-01T12:00:00.000Z"
}
```

### UPDATE Event

```json
{
  "event_type": "UPDATE",
  "table_name": "wallets",
  "record_id": "wallet-uuid",
  "user_id": "user-uuid",
  "old_values": {
    "id": "wallet-uuid",
    "balance": 1000.00,
    "status": "ACTIVE"
  },
  "new_values": {
    "id": "wallet-uuid",
    "balance": 955.00,
    "status": "ACTIVE"
  },
  "changed_fields": {
    "balance": 955.00
  },
  "created_at": "2026-01-01T12:00:01.000Z"
}
```

### DELETE Event

```json
{
  "event_type": "DELETE",
  "table_name": "budgets",
  "record_id": "budget-uuid",
  "user_id": "user-uuid",
  "old_values": {
    "id": "budget-uuid",
    "name": "Food Budget",
    "limitAmount": 500.00,
    "spent": 350.00
  },
  "new_values": null,
  "changed_fields": null,
  "created_at": "2026-01-01T12:00:02.000Z"
}
```

## Query Examples

### Get Audit Trail for a Transaction

```sql
SELECT 
    event_type,
    old_values,
    new_values,
    changed_fields,
    created_at
FROM public.finance_events
WHERE table_name = 'transactions' AND record_id = 'tx-uuid'
ORDER BY created_at ASC;
```

### Detect Suspicious Activity

```sql
-- Find records with rapid successive updates
SELECT 
    record_id,
    COUNT(*) as update_count,
    MIN(created_at) as first_update,
    MAX(created_at) as last_update
FROM public.finance_events
WHERE event_type = 'UPDATE'
  AND table_name = 'transactions'
  AND created_at > NOW() - INTERVAL '5 minutes'
GROUP BY record_id
HAVING COUNT(*) > 10;
```

### Generate Compliance Report

```sql
SELECT 
    table_name,
    event_type,
    COUNT(*) as event_count,
    MIN(created_at) as first_event,
    MAX(created_at) as last_event
FROM public.finance_events
WHERE user_id = 'user-uuid'
  AND created_at BETWEEN '2026-01-01' AND '2026-12-31'
GROUP BY table_name, event_type
ORDER BY table_name, event_type;
```

## Performance Considerations

1. **Synchronous Execution**: Triggers fire within the same transaction
2. **Indexing**: All query columns are indexed for fast lookups
3. **JSONB Storage**: Flexible schema for capturing any record structure
4. **No Application Dependency**: Audit logging works even if application has bugs

## Troubleshooting

### Check if Triggers Exist

```sql
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table
FROM information_schema.triggers
WHERE trigger_schema = 'finance';
```

### Test Trigger Manually

```sql
-- Insert a test record
INSERT INTO finance.transactions (user_id, amount, description, category, transaction_type, date)
VALUES ('test-user-uuid', 100.00, 'Test', 'test', 'EXPENSE', NOW());

-- Check if event was logged
SELECT * FROM public.finance_events 
WHERE table_name = 'transactions' 
ORDER BY created_at DESC 
LIMIT 1;
```
