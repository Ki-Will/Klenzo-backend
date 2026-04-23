# Klenzo API Reference (v1.0.0)

Comprehensive documentation for all services and endpoints in the Klenzo platform.

## 📡 API Gateway (Base URL: `http://localhost:3000/api`)

All endpoints below are prefixed with `/api`. Global error responses follow the standard NestJS format: `{ "statusCode": number, "message": string, "error": string }`.

---

### 🔐 Authentication (`/auth`)

| Endpoint | Method | Auth | Description | Status Codes |
|----------|--------|------|-------------|--------------|
| `/auth/register` | POST | No | Create a new user account | 201, 400 |
| `/auth/login` | POST | No | Authenticate and get JWT tokens | 200, 401 |
| `/auth/refresh` | POST | No | Refresh access token | 200, 401 |
| `/auth/forgot-password` | POST | No | Request password reset email | 200, 404 |
| `/auth/reset-password` | POST | No | Reset password with token | 200, 400 |
| `/auth/profile` | GET | Yes | Get authenticated user data | 200, 401 |

#### **POST /auth/register**
- **Request Body**:
  ```json
  {
    "email": "user@example.com",
    "password": "password123"
  }
  ```
- **Response (201)**: `{ "message": "User registered" }`

#### **POST /auth/login**
- **Request Body**:
  ```json
  {
    "email": "user@example.com",
    "password": "password123"
  }
  ```
- **Response (200)**: 
  ```json
  {
    "accessToken": "eyJ...",
    "refreshToken": "abcdef..."
  }
  ```

#### **POST /auth/refresh**
- **Request Body**: `{ "refreshToken": "string" }`
- **Response (200)**: `{ "accessToken": "eyJ..." }`

#### **POST /auth/forgot-password**
- **Request Body**: `{ "email": "string" }`
- **Response (200)**: `{ "message": "Password reset email sent" }`

#### **POST /auth/reset-password**
- **Request Body**:
  ```json
  {
    "token": "reset_token_from_email",
    "password": "new_password123"
  }
  ```
- **Response (200)**: `{ "message": "Password has been reset" }`

#### **GET /auth/profile**
- **Headers**: `Authorization: Bearer <token>`
- **Response (200)**:
  ```json
  {
    "id": 1,
    "email": "user@example.com",
    "isActive": true,
    "lastLogin": "2024-03-12T..."
  }
  ```

---

### ✅ Productivity (`/productivity`)

| Endpoint | Method | Auth | Description | Status Codes |
|----------|--------|------|-------------|--------------|
| `/productivity/tasks` | POST | Yes | Create a new task | 201, 400 |
| `/productivity/tasks` | GET | Yes | Get all user tasks | 200 |
| `/productivity/tasks/:id/update` | POST | Yes | Update a task | 200, 404 |
| `/productivity/tasks/:id/delete` | POST | Yes | Delete a task | 200, 404 |

#### **POST /productivity/tasks**
- **Request Body**:
  ```json
  {
    "title": "Task Title",
    "description": "Optional description",
    "status": "todo",
    "dueDate": "2024-04-23T...",
    "priority": 1
  }
  ```
- **Response (201)**: `Task Object` (includes `id`, `createdAt`, etc.)

#### **POST /productivity/tasks/:id/update**
- **URL Parameter**: `id` (Task ID)
- **Request Body**:
  ```json
  {
    "title": "string (optional)",
    "description": "string (optional)",
    "status": "todo | in_progress | done | cancelled (optional)",
    "dueDate": "iso_date_string (optional)",
    "priority": "number (optional)"
  }
  ```
- **Response (200)**: `Updated Task Object`

#### **POST /productivity/tasks/:id/delete**
- **URL Parameter**: `id` (Task ID)
- **Response (200)**: `{ "success": true }`

---

### 🔥 Habits (`/habits`)

| Endpoint | Method | Auth | Description | Status Codes |
|----------|--------|------|-------------|--------------|
| `/habits` | POST | Yes | Create a new habit | 201, 400 |
| `/habits` | GET | Yes | List all user habits | 200 |
| `/habits/:id/complete` | POST | Yes | Log completion | 200, 404 |
| `/habits/:id/delete` | POST | Yes | Remove a habit | 200, 404 |

#### **POST /habits**
- **Request Body**:
  ```json
  {
    "name": "Exercise",
    "description": "30 mins daily",
    "frequency": "daily"
  }
  ```
- **Response (201)**: `Habit Object` (includes `id`, `currentStreak`, `longestStreak`, etc.)

#### **GET /habits**
- **Response (200)**: `Array of Habit Objects`

#### **POST /habits/:id/complete**
- **URL Parameter**: `id` (Habit ID)
- **Response (200)**: 
  ```json
  {
    "id": 1,
    "currentStreak": 5,
    "longestStreak": 10,
    "lastCompletedDate": "2024-04-23"
  }
  ```

#### **POST /habits/:id/delete**
- **URL Parameter**: `id` (Habit ID)
- **Response (200)**: `{ "success": true }`

---

### 📈 Finance (`/finance`)

| Endpoint | Method | Auth | Description | Status Codes |
|----------|--------|------|-------------|--------------|
| `/finance/transactions` | POST | Yes | Create a new transaction | 201, 400 |
| `/finance/transactions/:userId` | GET | Yes | List all transactions for a user | 200 |

#### **POST /finance/transactions**
- **Request Body**:
  ```json
  {
    "userId": 1,
    "amount": 50.00,
    "description": "Lunch at Cafe",
    "category": "Food",
    "transactionType": "expense",
    "date": "2024-04-23T12:00:00Z"
  }
  ```
- **Response (201)**: `Transaction Object` (includes `id`, `createdAt`, etc.)

#### **GET /finance/transactions/:userId**
- **URL Parameter**: `userId` (ID of the user)
- **Response (200)**: `Array of Transaction Objects`

---

## 🏗 Microservices & Infrastructure

### Internal Service Discovery (NATS)
Services communicate internally using NATS subject patterns:
- `auth.*`
- `finance.*`
- `productivity.*`
- `habit.*`
- `notification.*`

### 🛠 Tech Stack
- **Framework**: NestJS (v11)
- **Database**: PostgreSQL (Multi-schema)
- **Messaging**: NATS (JetStream enabled)
- **Cache**: Redis
- **Storage**: MinIO (S3 Compatible)
- **Mail**: Mailpit (Dev SMTP)

### 📦 Database Schemas
All data resides in `klenzo_db` partitioned by:
- `auth`: User security and sessions
- `finance`: Transactional and budget data
- `productivity`: Tasks and goals
- `habit`: Habit tracking and logs
- `public`: Shared/System data

## 🧪 Development Ports
- **API Gateway**: 3000
- **Auth Service**: 3001
- **Finance Service**: 3002
- **NATS**: 4222 / 8222 (Management)
- **Postgres**: 5432
- **Redis**: 6379
- **MinIO**: 9000 (API) / 9001 (Console)
- **Mailpit**: 8025 (Web UI)
