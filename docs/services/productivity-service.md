# Productivity Service

## Overview

The Productivity Service manages tasks, priorities, and productivity tracking for the Klenzo platform.

## Port

| Protocol | Port | Purpose |
|----------|------|---------|
| HTTP | 3003 | External API (Nginx routing) |

## Responsibilities

- Task CRUD operations
- Priority-based task tracking
- Task status management (TODO, IN_PROGRESS, DONE, CANCELLED)
- Due date tracking
- Productivity metrics

## API Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/productivity/` | Create task | Yes |
| GET | `/api/productivity/` | List user tasks | Yes |
| GET | `/api/productivity/:id` | Get task by ID | Yes |
| PATCH | `/api/productivity/:id` | Update task | Yes |
| DELETE | `/api/productivity/:id` | Delete task | Yes |
| GET | `/api/productivity/stats` | Get productivity stats | Yes |

## Request/Response Examples

### Create Task

**Request:**
```json
POST /api/productivity/
Content-Type: application/json
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...

{
  "title": "Complete project documentation",
  "description": "Write comprehensive docs for all services",
  "priority": 3,
  "dueDate": "2026-01-15"
}
```

**Response:**
```json
{
  "id": "uuid",
  "userId": "user-uuid",
  "title": "Complete project documentation",
  "description": "Write comprehensive docs for all services",
  "status": "TODO",
  "priority": 3,
  "dueDate": "2026-01-15T00:00:00.000Z",
  "createdAt": "2026-01-01T12:00:00.000Z"
}
```

### Update Task Status

**Request:**
```json
PATCH /api/productivity/{taskId}
Content-Type: application/json
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...

{
  "status": "DONE"
}
```

**Response:**
```json
{
  "id": "uuid",
  "title": "Complete project documentation",
  "status": "DONE",
  "updatedAt": "2026-01-10T15:30:00.000Z"
}
```

## Task Statuses

| Status | Description |
|--------|-------------|
| `TODO` | Task is pending |
| `IN_PROGRESS` | Task is being worked on |
| `DONE` | Task is completed |
| `CANCELLED` | Task is cancelled |

## Environment Variables

```env
PRODUCTIVITY_SERVICE_PORT=3003
DATABASE_URL=postgresql://user:pass@host:5432/klenzo_db?schema=productivity
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

- **Prisma**: Database access (productivity schema)
- **Redis**: Cache
- **Auth Service**: Token validation (via gateway)
