# Finance Service

## Overview

The Finance Service handles all financial operations including transactions, wallets, transfers, budgets, and payroll. It is the core business domain for the Klenzo platform and implements enterprise-grade audit logging via database triggers.

## Ports

| Protocol | Port | Purpose |
|----------|------|---------|
| HTTP | 3002 | External API (Nginx routing) |
| gRPC | 5002 | Internal service-to-service calls |

## Responsibilities

- Transaction management (CRUD)
- Wallet operations and balance tracking
- Peer-to-peer (P2P) transfers
- Mobile money transfers
- Bank transfers
- Budget creation and auto-recalculation
- Payroll management
- Financial analytics

## API Endpoints

### Transactions

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/finance/` | Create transaction | Yes |
| GET | `/api/finance/` | List user transactions | Yes |
| GET | `/api/finance/:id` | Get transaction by ID | Yes |
| PATCH | `/api/finance/:id` | Update transaction | Yes |
| DELETE | `/api/finance/:id` | Delete transaction | Yes |

### Wallets

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/wallets` | Create wallet | Yes |
| GET | `/api/wallets` | List user wallets | Yes |
| GET | `/api/wallets/:id` | Get wallet by ID | Yes |
| PATCH | `/api/wallets/:id` | Update wallet | Yes |

### Transfers

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/transfers` | Create transfer | Yes |
| GET | `/api/transfers` | List user transfers | Yes |
| GET | `/api/transfers/:id` | Get transfer by ID | Yes |

### Budgets

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/finance/budgets` | Create budget | Yes |
| GET | `/api/finance/budgets` | List user budgets | Yes |
| GET | `/api/finance/budgets/:id` | Get budget by ID | Yes |
| PATCH | `/api/finance/budgets/:id` | Update budget | Yes |
| DELETE | `/api/finance/budgets/:id` | Delete budget | Yes |

### Payroll

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/payroll/runs` | Create payroll run | Yes (ADMIN) |
| GET | `/api/payroll/runs` | List payroll runs | Yes (ADMIN) |
| POST | `/api/payroll/employees` | Add employee | Yes (ADMIN) |

## Request/Response Examples

### Create Transaction

**Request:**
```json
POST /api/finance/
Content-Type: application/json
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...

{
  "amount": 45.00,
  "description": "Grocery shopping",
  "category": "food",
  "transactionType": "EXPENSE",
  "date": "2026-01-01"
}
```

**Response:**
```json
{
  "id": "uuid",
  "userId": "user-uuid",
  "amount": 45.00,
  "description": "Grocery shopping",
  "category": "food",
  "transactionType": "EXPENSE",
  "status": "APPROVED",
  "date": "2026-01-01T00:00:00.000Z",
  "createdAt": "2026-01-01T12:00:00.000Z"
}
```

### Create Transfer

**Request:**
```json
POST /api/transfers
Content-Type: application/json
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...

{
  "recipient": "recipient@example.com",
  "amount": 100.00,
  "currency": "USD",
  "type": "P2P"
}
```

**Response:**
```json
{
  "id": "uuid",
  "senderId": "sender-uuid",
  "recipient": "recipient@example.com",
  "amount": 100.00,
  "currency": "USD",
  "type": "P2P",
  "status": "COMPLETED",
  "reference": "REF-ABC1234",
  "date": "2026-01-01T12:00:00.000Z"
}
```

### gRPC: Get Wallet Balance

**Proto Definition:**
```protobuf
service FinanceService {
  rpc GetUserWalletBalance (GetUserWalletBalanceRequest) returns (GetUserWalletBalanceResponse);
  rpc ValidateSufficientFunds (ValidateSufficientFundsRequest) returns (ValidateSufficientFundsResponse);
  rpc GetTransactionSummary (GetTransactionSummaryRequest) returns (GetTransactionSummaryResponse);
}

message GetUserWalletBalanceRequest {
  string userId = 1;
}

message GetUserWalletBalanceResponse {
  string userId = 1;
  double mainWalletBalance = 2;
  string currency = 3;
  bool hasWallet = 4;
}
```

## Audit Logging

### Dual-Layer Audit System

The Finance Service implements a **dual-layer audit logging system**:

#### Layer 1: Application-Level (NestJS)

The `AuditInterceptor` captures all HTTP mutations:

```json
{
  "actorId": "user-uuid",
  "actorRole": "user",
  "action": "FinanceController.create",
  "targetType": "finance",
  "targetId": "transaction-uuid",
  "metadata": {
    "body": {
      "amount": 45.00,
      "category": "food"
    }
  },
  "ipAddress": "192.168.1.1",
  "requestPath": "/api/finance/"
}
```

#### Layer 2: Database-Level (PostgreSQL Triggers)

Every INSERT/UPDATE/DELETE on finance tables is automatically logged to `public.finance_events`:

```sql
-- Automatically triggered on finance.transactions mutations
CREATE TRIGGER trg_audit_transactions
    AFTER INSERT OR UPDATE OR DELETE ON finance.transactions
    FOR EACH ROW
    EXECUTE FUNCTION public.log_finance_event();
```

**Finance Events Table:**
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Unique event ID |
| event_type | VARCHAR | INSERT, UPDATE, or DELETE |
| table_name | VARCHAR | transactions, wallets, transfers, etc. |
| record_id | UUID | ID of affected record |
| user_id | UUID | Who performed the action |
| old_values | JSONB | Previous state (NULL for INSERT) |
| new_values | JSONB | New state (NULL for DELETE) |
| changed_fields | JSONB | Which fields changed (UPDATE only) |
| created_at | TIMESTAMPTZ | Microsecond-precision timestamp |

### Querying Audit Events

```typescript
// Get audit trail for a transaction
GET /api/audit/finance/events/record/transactions/{transactionId}

// Get all events for a user
GET /api/audit/finance/events/user/{userId}?limit=100

// Get recent events (admin only)
GET /api/audit/finance/events?table=transactions&limit=50
```

## Event Publishing

The Finance Service publishes events to Redis Pub/Sub:

| Event | Payload | Subscriber(s) |
|-------|---------|---------------|
| `transaction.created` | `{ userId, transactionId, amount, type }` | Notification, Insight |
| `transaction.updated` | `{ userId, transactionId, oldStatus, newStatus }` | Notification |
| `wallet.balance_changed` | `{ userId, walletId, oldBalance, newBalance }` | Notification |
| `transfer.completed` | `{ senderId, recipientId, amount, reference }` | Notification |

## Budget Auto-Recalculation

When a transaction is created or updated, the budget auto-recalculation logic:

1. Find the budget matching the transaction's category
2. Recalculate the `spent` field by summing all transactions in the period
3. Update the budget record
4. Publish `budget.updated` event if threshold exceeded

## Environment Variables

```env
# Service Configuration
FINANCE_SERVICE_PORT=3002
FINANCE_GRPC_PORT=5002

# Database
DATABASE_URL=postgresql://user:pass@host:5432/klenzo_db?schema=finance

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Auth Service (for gRPC)
AUTH_GRPC_URL=auth-service:5001
AUTH_GRPC_PORT=5001

# JWT
JWT_SECRET=your_secure_random_secret
```

## Health Checks

| Endpoint | Description |
|----------|-------------|
| `GET /healthz` | Full health check |
| `GET /healthz/live` | Liveness probe |
| `GET /healthz/ready` | Readiness probe |

## Dependencies

- **Prisma**: Database access (finance schema)
- **Redis**: Cache, event publishing
- **Auth Service (gRPC)**: Token validation, user profiles
- **Notification Service**: Event-driven alerts

## Error Codes

| Code | Description |
|------|-------------|
| 400 | Invalid request body |
| 401 | Unauthorized |
| 404 | Transaction/Wallet/Transfer not found |
| 409 | Insufficient funds |
| 422 | Invalid amount or currency |
| 429 | Rate limit exceeded |
