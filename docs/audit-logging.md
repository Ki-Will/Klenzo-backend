# Enterprise Audit Logging System

## Overview

Klenzo implements a **dual-layer audit logging system** that captures every significant action at both the application and database levels, providing a complete, immutable audit trail for compliance and forensic analysis.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Application Layer                         │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    AuditInterceptor                       │   │
│  │  - Captures HTTP mutations (POST, PUT, PATCH, DELETE)     │   │
│  │  - Records actor, action, target, metadata, IP            │   │
│  │  - Sanitizes sensitive fields                             │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              │                                   │
│                              ▼                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    AuditLogService                         │   │
│  │  - Writes to: public.audit_logs                           │   │
│  │  - Fire-and-forget (non-blocking)                         │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                       Database Layer                             │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                   PostgreSQL Triggers                      │   │
│  │  - Fires on INSERT/UPDATE/DELETE to finance tables        │   │
│  │  - Captures old/new values, changed fields               │   │
│  │  - Atomic with the triggering transaction                 │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              │                                   │
│                              ▼                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              public.finance_events                         │   │
│  │  - Immutable audit trail                                  │   │
│  │  - Microsecond-precision timestamps                       │   │
│  │  - Complete change history                                │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## Layer 1: Application-Level (NestJS)

### AuditInterceptor

Automatically captures all HTTP mutations:

```typescript
// Captures:
{
  actorId: "user-uuid",
  actorRole: "user",
  action: "FinanceController.create",
  targetType: "finance",
  targetId: "transaction-uuid",
  metadata: {
    body: { amount: 45.00, category: "food" },
    query: {}
  },
  ipAddress: "192.168.1.1",
  requestPath: "/api/finance/"
}
```

### Sensitive Data Sanitization

```typescript
const sensitiveKeys = [
  'password', 'token', 'accessToken',
  'refreshToken', 'oldPassword', 'newPassword'
];

// All sensitive fields are replaced with '[REDACTED]'
```

### Database Table: `public.audit_logs`

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Unique identifier |
| actorId | UUID | User who performed the action |
| actorRole | VARCHAR | Role of the actor |
| action | VARCHAR | Controller.method format |
| targetType | VARCHAR | Entity type affected |
| targetId | UUID | ID of affected entity |
| metadata | JSONB | Request body, query params |
| ipAddress | VARCHAR | Client IP address |
| requestPath | TEXT | API endpoint path |
| createdAt | TIMESTAMPTZ | Timestamp |

## Layer 2: Database-Level (PostgreSQL Triggers)

### Finance Events Table: `public.finance_events`

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Unique identifier |
| event_type | VARCHAR | INSERT, UPDATE, or DELETE |
| table_name | VARCHAR | Name of finance table |
| record_id | UUID | ID of affected record |
| user_id | UUID | User who performed action |
| old_values | JSONB | Previous state (NULL for INSERT) |
| new_values | JSONB | New state (NULL for DELETE) |
| changed_fields | JSONB | Which fields changed (UPDATE only) |
| ip_address | VARCHAR | Client IP (enriched post-insert) |
| request_path | TEXT | API endpoint (enriched post-insert) |
| created_at | TIMESTAMPTZ | Microsecond precision |

### Triggered Tables

| Table | Trigger Name |
|-------|--------------|
| `finance.transactions` | `trg_audit_transactions` |
| `finance.wallets` | `trg_audit_wallets` |
| `finance.transfers` | `trg_audit_transfers` |
| `finance.budgets` | `trg_audit_budgets` |
| `finance.payroll_runs` | `trg_audit_payroll_runs` |
| `finance.payroll_employees` | `trg_audit_payroll_employees` |

### Trigger Logic

```sql
CREATE OR REPLACE FUNCTION public.log_finance_event()
RETURNS TRIGGER AS $$
BEGIN
  -- INSERT: captures new state
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.finance_events (event_type, table_name, record_id, new_values)
    VALUES ('INSERT', TG_TABLE_NAME, NEW.id, to_jsonb(NEW));
  END IF;

  -- UPDATE: captures old state, new state, and changed fields
  IF TG_OP = 'UPDATE' THEN
    INSERT INTO public.finance_events (event_type, table_name, record_id, old_values, new_values, changed_fields)
    VALUES ('UPDATE', TG_TABLE_NAME, NEW.id, to_jsonb(OLD), to_jsonb(NEW), ...);
  END IF;

  -- DELETE: captures old state
  IF TG_OP = 'DELETE' THEN
    INSERT INTO public.finance_events (event_type, table_name, record_id, old_values)
    VALUES ('DELETE', TG_TABLE_NAME, OLD.id, to_jsonb(OLD));
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

## Querying Audit Events

### REST API

```bash
# Get audit trail for a record
GET /api/audit/finance/events/record/transactions/{txId}

# Get all events for a user
GET /api/audit/finance/events/user/{userId}?limit=100

# Get recent events (admin only)
GET /api/audit/finance/events?table=transactions&limit=50

# Get event statistics
GET /api/audit/finance/events/stats?startDate=2026-01-01&endDate=2026-01-31
```

### Direct SQL

```sql
-- Get full audit trail for a transaction
SELECT * FROM public.finance_events
WHERE table_name = 'transactions' AND record_id = 'tx-uuid'
ORDER BY created_at ASC;

-- Get all events for a user
SELECT * FROM public.finance_events
WHERE user_id = 'user-uuid'
ORDER BY created_at DESC
LIMIT 100;

-- Get events by type
SELECT * FROM public.finance_events
WHERE event_type = 'UPDATE' AND table_name = 'wallets'
ORDER BY created_at DESC;

-- Detect suspicious activity (rapid updates)
SELECT record_id, COUNT(*) as update_count
FROM public.finance_events
WHERE event_type = 'UPDATE'
  AND table_name = 'transactions'
  AND created_at > NOW() - INTERVAL '5 minutes'
GROUP BY record_id
HAVING COUNT(*) > 10;
```

### Prisma Client

```typescript
// Get audit trail for a record
const events = await prisma.financeEvent.findMany({
  where: {
    tableName: 'transactions',
    recordId: 'tx-uuid',
  },
  orderBy: { createdAt: 'asc' },
});

// Get user events
const userEvents = await prisma.financeEvent.findMany({
  where: { userId: 'user-uuid' },
  orderBy: { createdAt: 'desc' },
  take: 100,
});

// Get event statistics
const stats = await prisma.financeEvent.groupBy({
  by: ['tableName', 'eventType'],
  where: {
    createdAt: { gte: startDate, lte: endDate },
  },
  _count: { id: true },
});
```

## Use Cases

### Compliance Reporting

```sql
-- Generate compliance report for a user
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

### Forensic Analysis

```sql
-- Track complete history of a transaction
SELECT 
  event_type,
  old_values,
  new_values,
  changed_fields,
  created_at
FROM public.finance_events
WHERE table_name = 'transactions' AND record_id = 'tx-uuid'
ORDER BY created_at;
```

### Anomaly Detection

```sql
-- Detect unusual patterns
SELECT 
  user_id,
  DATE(created_at) as day,
  COUNT(*) as events,
  COUNT(DISTINCT table_name) as tables_affected
FROM public.finance_events
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY user_id, DATE(created_at)
HAVING COUNT(*) > 100
ORDER BY events DESC;
```

## Event Enrichment

The `FinanceEventEnricherService` adds HTTP context to database-triggered events:

```typescript
// After a finance mutation
await financeEventEnricher.enrichRecentEvent({
  tableName: 'transactions',
  recordId: transaction.id,
  eventType: 'INSERT',
  ipAddress: request.ip,
  requestPath: request.url,
});
```

## Retention Policy

- **audit_logs**: Retain for 2 years
- **finance_events**: Retain indefinitely (immutable)
- Implement via PostgreSQL partitioning or cron job

## Performance Considerations

- Triggers fire synchronously within the transaction
- No additional network calls
- Indexed columns for fast queries
- JSONB storage for flexible schema
