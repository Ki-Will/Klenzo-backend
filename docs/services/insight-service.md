# Insight Service

## Overview

The Insight Service provides financial analytics, category spending metrics, and platform admin operations for the Klenzo platform.

## Port

| Protocol | Port | Purpose |
|----------|------|---------|
| HTTP | 3006 | External API (Nginx routing) |

## Responsibilities

- Financial analytics and reporting
- Category spending breakdown
- Income vs expense analysis
- User management (admin)
- Platform administration
- Audit log management
- System metrics collection

## API Endpoints

### Analytics

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/insights/` | Get financial overview | Yes |
| GET | `/api/insights/category-spending` | Category breakdown | Yes |
| GET | `/api/insights/income-expense` | Income vs expense | Yes |
| GET | `/api/insights/monthly-trend` | Monthly trends | Yes |
| GET | `/api/insights/budget-status` | Budget utilization | Yes |

### Admin

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/admin/users` | List all users | Yes (ADMIN) |
| GET | `/api/admin/users/:id` | Get user details | Yes (ADMIN) |
| PATCH | `/api/admin/users/:id` | Update user | Yes (ADMIN) |
| DELETE | `/api/admin/users/:id` | Deactivate user | Yes (SUPERADMIN) |
| GET | `/api/admin/audit-logs` | Get audit logs | Yes (ADMIN) |
| GET | `/api/admin/metrics` | Get system metrics | Yes (ADMIN) |

### Audit (Finance Events)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/audit/finance/events` | Recent finance events | Yes (ADMIN) |
| GET | `/api/audit/finance/events/user/:userId` | User events | Yes |
| GET | `/api/audit/finance/events/record/:table/:id` | Record audit trail | Yes |
| GET | `/api/audit/finance/events/stats` | Event statistics | Yes (ADMIN) |

## Request/Response Examples

### Financial Overview

**Request:**
```json
GET /api/insights/?period=30
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

**Response:**
```json
{
  "totalIncome": 5000.00,
  "totalExpenses": 3200.00,
  "netBalance": 1800.00,
  "transactionCount": 45,
  "period": "30d",
  "currency": "USD"
}
```

### Category Spending

**Request:**
```json
GET /api/insights/category-spending?period=30
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

**Response:**
```json
{
  "categories": [
    { "name": "food", "total": 850.00, "percentage": 26.6, "count": 15 },
    { "name": "transport", "total": 420.00, "percentage": 13.1, "count": 8 },
    { "name": "entertainment", "total": 280.00, "percentage": 8.8, "count": 5 }
  ],
  "period": "30d"
}
```

### Audit Trail

**Request:**
```json
GET /api/audit/finance/events/record/transactions/tx-uuid
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

**Response:**
```json
{
  "events": [
    {
      "id": "uuid",
      "eventType": "INSERT",
      "tableName": "transactions",
      "recordId": "tx-uuid",
      "userId": "user-uuid",
      "oldValues": null,
      "newValues": {
        "id": "tx-uuid",
        "amount": 45.00,
        "category": "food",
        "status": "APPROVED"
      },
      "changedFields": null,
      "createdAt": "2026-01-01T12:00:00.000Z"
    },
    {
      "id": "uuid2",
      "eventType": "UPDATE",
      "tableName": "transactions",
      "recordId": "tx-uuid",
      "oldValues": { "status": "PENDING" },
      "newValues": { "status": "APPROVED" },
      "changedFields": { "status": "APPROVED" },
      "createdAt": "2026-01-01T12:01:00.000Z"
    }
  ]
}
```

## RBAC Roles

| Role | Access Level |
|------|-------------|
| `USER` | Own analytics, own audit events |
| `ADMIN` | All users, all audit events, system metrics |
| `SUPERADMIN` | Full access, user management, system config |

## System Metrics

The service collects and exposes:

| Metric | Description |
|--------|-------------|
| `requests_total` | Total HTTP requests |
| `response_time_ms` | Average response time |
| `error_rate` | Error percentage |
| `active_users` | Currently active users |
| `transactions_per_hour` | Transaction throughput |

## Environment Variables

```env
INSIGHT_SERVICE_PORT=3006
DATABASE_URL=postgresql://user:pass@host:5432/klenzo_db?schema=public
REDIS_HOST=localhost
REDIS_PORT=6379
JWT_SECRET=your_secure_random_secret
```

## Health Checks

| Endpoint | Description |
|----------|-------------|
| `GET /healthz` | Full health check |
| `GET /healthz/live` | Liveness probe |
| `GET /healthz/ready` | Readiness probe |

## Dependencies

- **Prisma**: Database access (public schema)
- **Redis**: Cache for analytics, metrics
- **Auth Service**: Token validation (via gateway)
- **Audit Module**: Finance event queries
