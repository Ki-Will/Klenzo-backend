# Habit Service

## Overview

The Habit Service manages habit tracking, frequency schedules, and completion logs for the Klenzo platform.

## Port

| Protocol | Port | Purpose |
|----------|------|---------|
| HTTP | 3004 | External API (Nginx routing) |

## Responsibilities

- Habit CRUD operations
- Frequency tracking (DAILY, WEEKLY)
- Streak calculation and tracking
- Completion logging
- Habit statistics

## API Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/habits` | Create habit | Yes |
| GET | `/api/habits` | List user habits | Yes |
| GET | `/api/habits/:id` | Get habit by ID | Yes |
| PATCH | `/api/habits/:id` | Update habit | Yes |
| DELETE | `/api/habits/:id` | Delete habit | Yes |
| POST | `/api/habits/:id/complete` | Log completion | Yes |
| GET | `/api/habits/:id/logs` | Get completion logs | Yes |

## Request/Response Examples

### Create Habit

**Request:**
```json
POST /api/habits
Content-Type: application/json
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...

{
  "name": "Morning Meditation",
  "description": "10 minutes of mindfulness",
  "frequency": "DAILY"
}
```

**Response:**
```json
{
  "id": "uuid",
  "userId": "user-uuid",
  "name": "Morning Meditation",
  "description": "10 minutes of mindfulness",
  "frequency": "DAILY",
  "currentStreak": 0,
  "longestStreak": 0,
  "createdAt": "2026-01-01T12:00:00.000Z"
}
```

### Log Completion

**Request:**
```json
POST /api/habits/{habitId}/complete
Content-Type: application/json
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

**Response:**
```json
{
  "id": "uuid",
  "habitId": "habit-uuid",
  "completedAt": "2026-01-01T08:00:00.000Z",
  "currentStreak": 1,
  "message": "Habit completed! Streak: 1 day"
}
```

## Habit Frequencies

| Frequency | Description |
|-----------|-------------|
| `DAILY` | Habit should be done every day |
| `WEEKLY` | Habit should be done once per week |

## Streak Logic

- **Current Streak**: Consecutive completions ending today
- **Longest Streak**: Historical maximum
- Streak resets if a day/week is missed
- Multiple completions in the same period count as one

## Event Publishing

| Event | Payload | Subscriber(s) |
|-------|---------|---------------|
| `habit.completed` | `{ userId, habitId, streak }` | Notification |
| `habit.streak_milestone` | `{ userId, habitId, milestone }` | Notification |

## Environment Variables

```env
HABIT_SERVICE_PORT=3004
DATABASE_URL=postgresql://user:pass@host:5432/klenzo_db?schema=habit
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

- **Prisma**: Database access (habit schema)
- **Redis**: Cache
- **Auth Service**: Token validation (via gateway)
- **Notification Service**: Streak milestone alerts
