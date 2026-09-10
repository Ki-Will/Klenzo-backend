# REST API Reference

## Overview

The Klenzo Backend exposes REST APIs through Nginx reverse proxy. All endpoints are prefixed with `/api/` and require JWT authentication unless noted.

## Base URL

```
http://localhost          # Docker Compose
http://localhost:3000     # Direct (main app)
```

## Authentication

### Bearer Token

```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

### Cookie (Browser)

```
kz_at=eyJhbGciOiJIUzI1NiIs...
```

## Swagger

Interactive API documentation available at:

```
GET /api/docs
```

---

## Auth Endpoints

### Register

```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecureP@ss123"
}
```

**Response** (201):
```json
{
  "message": "Registration successful",
  "accessToken": "...",
  "refreshToken": "...",
  "user": { "id": "...", "email": "...", "role": "USER" }
}
```

### Login

```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecureP@ss123"
}
```

**Response** (200):
```json
{
  "accessToken": "...",
  "refreshToken": "...",
  "user": { "id": "...", "email": "...", "role": "USER" }
}
```

### Refresh Token

```http
POST /api/auth/refresh
Content-Type: application/json

{
  "refreshToken": "..."
}
```

**Response** (200):
```json
{
  "accessToken": "...",
  "refreshToken": "..."
}
```

### Logout

```http
POST /api/auth/logout
Authorization: Bearer ...
```

**Response** (200):
```json
{ "message": "Logged out successfully" }
```

### Forgot Password

```http
POST /api/auth/forgot-password
Content-Type: application/json

{
  "email": "user@example.com"
}
```

**Response** (200):
```json
{ "message": "If that email exists, a reset link has been sent" }
```

### Reset Password

```http
POST /api/auth/reset-password
Content-Type: application/json

{
  "token": "...",
  "newPassword": "NewSecureP@ss"
}
```

**Response** (200):
```json
{ "message": "Password reset successful" }
```

### Get Profile

```http
GET /api/auth/profile
Authorization: Bearer ...
```

**Response** (200):
```json
{
  "id": "...",
  "email": "...",
  "name": null,
  "role": "USER",
  "isActive": true,
  "createdAt": "..."
}
```

### Update Profile

```http
PATCH /api/auth/profile
Authorization: Bearer ...
Content-Type: application/json

{
  "name": "John Doe",
  "phone": "+1234567890"
}
```

### Change Password

```http
POST /api/auth/change-password
Authorization: Bearer ...
Content-Type: application/json

{
  "oldPassword": "CurrentP@ss",
  "newPassword": "NewSecureP@ss"
}
```

---

## Finance Endpoints

### Create Transaction

```http
POST /api/finance/
Authorization: Bearer ...
Content-Type: application/json

{
  "amount": 45.00,
  "description": "Grocery shopping",
  "category": "food",
  "transactionType": "EXPENSE",
  "date": "2026-01-01"
}
```

**Response** (201):
```json
{
  "id": "...",
  "userId": "...",
  "amount": 45.00,
  "description": "Grocery shopping",
  "category": "food",
  "transactionType": "EXPENSE",
  "status": "APPROVED",
  "date": "2026-01-01T00:00:00.000Z"
}
```

### List Transactions

```http
GET /api/finance/?page=1&limit=20&category=food
Authorization: Bearer ...
```

### Create Wallet

```http
POST /api/wallets
Authorization: Bearer ...
Content-Type: application/json

{
  "name": "Main Wallet",
  "currency": "USD"
}
```

### Create Transfer

```http
POST /api/transfers
Authorization: Bearer ...
Content-Type: application/json

{
  "recipient": "recipient@example.com",
  "amount": 100.00,
  "currency": "USD",
  "type": "P2P"
}
```

### Create Budget

```http
POST /api/finance/budgets
Authorization: Bearer ...
Content-Type: application/json

{
  "name": "Food Budget",
  "category": "food",
  "limitAmount": 500.00,
  "period": "MONTHLY"
}
```

---

## Productivity Endpoints

### Create Task

```http
POST /api/productivity/
Authorization: Bearer ...
Content-Type: application/json

{
  "title": "Complete documentation",
  "description": "Write comprehensive docs",
  "priority": 3,
  "dueDate": "2026-01-15"
}
```

### Update Task

```http
PATCH /api/productivity/{taskId}
Authorization: Bearer ...
Content-Type: application/json

{
  "status": "DONE"
}
```

---

## Habit Endpoints

### Create Habit

```http
POST /api/habits
Authorization: Bearer ...
Content-Type: application/json

{
  "name": "Morning Meditation",
  "description": "10 minutes of mindfulness",
  "frequency": "DAILY"
}
```

### Log Completion

```http
POST /api/habits/{habitId}/complete
Authorization: Bearer ...
```

---

## Notification Endpoints

### List Notifications

```http
GET /api/notifications?page=1&limit=20
Authorization: Bearer ...
```

### Mark as Read

```http
PATCH /api/notifications/{notificationId}
Authorization: Bearer ...
Content-Type: application/json

{
  "isRead": true
}
```

---

## Insight Endpoints

### Financial Overview

```http
GET /api/insights/?period=30
Authorization: Bearer ...
```

### Category Spending

```http
GET /api/insights/category-spending?period=30
Authorization: Bearer ...
```

---

## Admin Endpoints

### List Users

```http
GET /api/admin/users?page=1&limit=50
Authorization: Bearer ... (ADMIN)
```

### Get Audit Logs

```http
GET /api/admin/audit-logs?page=1&limit=100
Authorization: Bearer ... (ADMIN)
```

### Get Finance Events

```http
GET /api/audit/finance/events?table=transactions&limit=50
Authorization: Bearer ... (ADMIN)
```

---

## Health Check Endpoints

### Gateway Health

```http
GET /healthz
```

### Service Health

```http
GET /healthz/auth
GET /healthz/finance
GET /healthz/productivity
GET /healthz/habits
GET /healthz/notifications
GET /healthz/insights
```

**Response** (200):
```json
{
  "service": "auth-service",
  "status": "ok",
  "timestamp": "2026-01-01T12:00:00.000Z",
  "database": "up",
  "redis": "up",
  "uptime": 3600.5
}
```

---

## Error Responses

### Standard Error Format

```json
{
  "statusCode": 400,
  "timestamp": "2026-01-01T12:00:00.000Z",
  "path": "/api/finance/",
  "message": "Validation failed"
}
```

### Common Error Codes

| Code | Description |
|------|-------------|
| 400 | Bad request / validation error |
| 401 | Unauthorized / invalid token |
| 403 | Forbidden / insufficient permissions |
| 404 | Resource not found |
| 409 | Conflict (e.g., duplicate email) |
| 422 | Unprocessable entity |
| 429 | Rate limit exceeded |
| 500 | Internal server error |

---

## Rate Limits

| Zone | Rate | Burst |
|------|------|-------|
| `auth_limit` | 10 req/s | 20 |
| `api_limit` | 50 req/s | 30-50 |

---

## Pagination

All list endpoints support pagination:

```http
GET /api/finance/?page=1&limit=20
```

**Response**:
```json
{
  "data": [...],
  "total": 150,
  "page": 1,
  "limit": 20
}
```
