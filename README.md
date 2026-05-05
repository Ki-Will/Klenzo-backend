# Klenzo Backend

Klenzo is a personal productivity and financial management platform built as a single NestJS application with TypeORM and PostgreSQL.

## Architecture

Single NestJS application with feature modules:

| Module | Responsibility |
|--------|---------------|
| **Auth** | Registration, login, JWT tokens, password reset |
| **Productivity** | Task management with status and priority |
| **Habit** | Habit tracking, streak calculation, milestone notifications |
| **Finance** | Transactions, group expense splitting, budgets, analytics |
| **Notification** | In-app notifications + email via Nodemailer |
| **Insight** | Dashboard overview, productivity and spending trends |

## Getting Started

### Prerequisites

- Node.js 20+
- Docker & Docker Compose
- npm

---

### Option A — Full Docker with hot-reload (recommended)

Everything runs in containers. Edit any file on your machine and the app reloads automatically — no restart needed.

```bash
docker-compose --profile development up --build
```

How it works:
- Your workspace is bind-mounted into the container (`/app`)
- `node_modules` lives in a named Docker volume so it's never overwritten by your host
- Webpack runs in poll mode (1 s) — detects your file save → rebuilds → `@nx/js:node` restarts the process
- Typical reload time: **3–5 seconds** after saving a file

API → `http://localhost:3000/api`  
Mailpit UI → `http://localhost:8025`

To stop: `Ctrl+C`, then `docker-compose down`

---

### Option B — Local dev (no Docker for the app)

Run only infrastructure in Docker, the app directly on your machine:

```bash
# 1. Install dependencies
npm install

# 2. Start Postgres, Redis, and Mailpit
docker-compose --profile development up -d postgres redis mailpit

# 3. Start the app — webpack watch + auto-restart built in
npx nx serve klenzo
```

API → `http://localhost:3000/api`

---

### Option C — Production image

```bash
# Build
docker build -f apps/klenzo/Dockerfile -t klenzo:latest .

# Run
docker run -p 3000:3000 --env-file .env klenzo:latest
```

---

## API Reference

All authenticated endpoints require `Authorization: Bearer <accessToken>`.

### Auth — `/api/auth`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/register` | — | Register a new user |
| POST | `/login` | — | Login, returns access + refresh tokens |
| POST | `/refresh` | — | Rotate refresh token |
| POST | `/forgot-password` | — | Send password reset email |
| POST | `/reset-password` | — | Reset password with token |
| GET | `/profile` | ✓ | Get current user profile |
| POST | `/profile` | ✓ | Update profile |

### Tasks — `/api/productivity/tasks`

| Method | Path | Description |
|--------|------|-------------|
| POST | `/` | Create task |
| GET | `/` | List all tasks |
| GET | `/:id` | Get single task |
| PATCH | `/:id` | Update task |
| DELETE | `/:id` | Delete task |

Task statuses: `todo`, `in_progress`, `done`, `cancelled`

### Habits — `/api/habits`

| Method | Path | Description |
|--------|------|-------------|
| POST | `/` | Create habit |
| GET | `/` | List all habits |
| GET | `/:id` | Get habit |
| GET | `/:id/stats` | Streak and completion stats |
| PATCH | `/:id` | Update habit |
| POST | `/:id/complete` | Log a completion (updates streak) |
| DELETE | `/:id` | Delete habit |

Frequencies: `daily`, `weekly`. Milestone notifications fire at 7, 14, 30, 60, 100, 365 day streaks.

### Finance — `/api/finance`

**Transactions**

| Method | Path | Description |
|--------|------|-------------|
| POST | `/transactions` | Create transaction |
| GET | `/transactions` | List transactions |
| DELETE | `/transactions/:id` | Delete transaction |

**Groups**

| Method | Path | Description |
|--------|------|-------------|
| POST | `/groups` | Create group |
| GET | `/groups` | List groups |
| GET | `/groups/:id` | Group detail |
| POST | `/groups/:id/members` | Add member by email |
| GET | `/groups/:id/balances` | Who owes whom |
| POST | `/groups/:id/settle` | Record a settlement |

**Budgets**

| Method | Path | Description |
|--------|------|-------------|
| POST | `/budgets` | Create budget |
| GET | `/budgets` | List budgets |
| PATCH | `/budgets/:id` | Update budget |
| DELETE | `/budgets/:id` | Delete budget |

**Analytics**

| Method | Path | Description |
|--------|------|-------------|
| GET | `/analytics/summary` | Total income, expenses, net balance |
| GET | `/analytics/categories?from=&to=` | Spending by category with date range |
| GET | `/accounts` | List accounts |

### Notifications — `/api/notifications`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | List unread/undismissed notifications |
| POST | `/:id/read` | Mark as read |
| POST | `/read-all` | Mark all as read |
| POST | `/:id/dismiss` | Dismiss notification |

### Insights — `/api/insights`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/dashboard` | Combined task, habit, finance overview |
| GET | `/productivity/trends?days=30` | Task completion trends |
| GET | `/finance/trends?days=30` | Daily income/expense trends |

---

## Infrastructure

| Service | Port | Description |
|---------|------|-------------|
| **Klenzo API** | 3000 | Main application |
| **PostgreSQL** | 5432 | Primary database |
| **Redis** | 6379 | Caching |
| **MinIO** | 9000/9001 | Object storage |
| **Mailpit** | 1025/8025 | SMTP + web UI (dev only) |

## Database Schemas

All schemas live in a single PostgreSQL database (`klenzo_db`):

- `auth` — users, tokens
- `productivity` — tasks
- `habit` — habits, habit_logs
- `finance` — transactions, groups, group_members, group_members_mapping, budgets, accounts
- `notifications` — notifications

## Environment Variables

See `.env` for all available variables. Key ones:

```
PORT=3000
DB_HOST=localhost
DB_USER=klenzo
DB_PASSWORD=klenzo_password
DB_NAME=klenzo_db
JWT_SECRET=secret_key
SMTP_HOST=localhost
SMTP_PORT=1025
```

## License

MIT
