# Notification Service

## Overview

The Notification Service manages real-time alerts, email delivery, and global broadcast banners for the Klenzo platform.

## Port

| Protocol | Port | Purpose |
|----------|------|---------|
| HTTP | 3005 | External API (Nginx routing) |
| WebSocket | 3005 | Real-time notifications |

## Responsibilities

- In-app notification management
- Email delivery (SMTP)
- WebSocket push notifications
- Global broadcast banners
- Notification preferences
- Read/dismiss tracking

## API Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/notifications` | List user notifications | Yes |
| GET | `/api/notifications/:id` | Get notification by ID | Yes |
| PATCH | `/api/notifications/:id` | Update (read/dismiss) | Yes |
| DELETE | `/api/notifications/:id` | Delete notification | Yes |
| GET | `/api/notifications/banners` | Get active banners | Yes |
| POST | `/api/notifications/broadcast` | Admin: send broadcast | Yes (ADMIN) |

## Request/Response Examples

### List Notifications

**Request:**
```json
GET /api/notifications?page=1&limit=20
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

**Response:**
```json
{
  "notifications": [
    {
      "id": "uuid",
      "type": "INFO",
      "category": "TRANSACTION",
      "title": "Payment Received",
      "message": "You received $100.00 from john@example.com",
      "isRead": false,
      "isDismissed": false,
      "color": "#4CAF50",
      "link": "/transactions/tx-uuid",
      "createdAt": "2026-01-01T12:00:00.000Z"
    }
  ],
  "total": 45,
  "page": 1,
  "limit": 20
}
```

### Mark as Read

**Request:**
```json
PATCH /api/notifications/{notificationId}
Content-Type: application/json
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...

{
  "isRead": true
}
```

## Notification Types

| Type | Description |
|------|-------------|
| `INFO` | General information |
| `SUCCESS` | Positive action result |
| `WARNING` | Warning message |
| `ERROR` | Error or failure |

## Notification Categories

| Category | Description |
|----------|-------------|
| `NOTIFICATION` | General notification |
| `BANNER` | Global broadcast banner |
| `INSIGHT` | Analytics insight |
| `TRANSACTION` | Financial transaction alert |
| `SECURITY` | Security alert |
| `GROUP` | Group activity |

## WebSocket Events

```javascript
// Connect to WebSocket
const socket = io('http://localhost:3005', {
  auth: { token: 'your-jwt-token' }
});

// Listen for new notifications
socket.on('notification', (data) => {
  console.log('New notification:', data);
});

// Listen for banner broadcasts
socket.on('banner', (data) => {
  console.log('New banner:', data);
});

// Mark notification as read
socket.emit('markAsRead', { notificationId: 'uuid' });

// Heartbeat
socket.emit('heartbeat');
```

## Email Templates

The service sends emails for:

| Template | Trigger |
|----------|---------|
| Welcome | User registration |
| Password Reset | Forgot password request |
| Account Locked | 5 failed login attempts |
| Transfer Complete | P2P transfer success |
| KYC Verified | KYC approval |

## Event Subscriptions

| Event | Source | Action |
|-------|--------|--------|
| `transaction.created` | Finance | Send transaction alert |
| `wallet.balance_changed` | Finance | Low balance warning |
| `transfer.completed` | Finance | Transfer confirmation |
| `user.registered` | Auth | Welcome email |
| `user.kyc_verified` | Auth | KYC approval email |
| `habit.completed` | Habit | Streak notification |
| `task.completed` | Productivity | Achievement notification |

## Environment Variables

```env
NOTIFICATION_SERVICE_PORT=3005
DATABASE_URL=postgresql://user:pass@host:5432/klenzo_db?schema=notifications
REDIS_HOST=localhost
REDIS_PORT=6379

# Email (SMTP)
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM=noreply@localhost

# Frontend URL (for email links)
FRONTEND_URL=http://localhost:5173
```

## Health Checks

| Endpoint | Description |
|----------|-------------|
| `GET /healthz` | Full health check |
| `GET /healthz/live` | Liveness probe |
| `GET /healthz/ready` | Readiness probe |

## Dependencies

- **Prisma**: Database access (notifications schema)
- **Redis**: Pub/Sub for event subscription
- **NodeMailer**: Email delivery
- **Socket.IO**: WebSocket push notifications
