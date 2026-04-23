# Klenzo Backend - Nx Monorepo

Klenzo is a modular personal productivity and financial management platform built with NestJS, TypeORM, and NATS.

## 🏗 Architecture Overview

The project follows a microservices architecture managed by Nx:

- **API Gateway**: The entry point for all client requests. Handles routing to microservices via NATS.
- **Auth Service**: Manages user registration, authentication, and security.
- **Finance Service**: Handles financial tracking, transactions, and budgeting.
- **Messaging Library**: Shared library for NATS-based event-driven communication.

## 🚀 Getting Started

### Prerequisites

- Node.js 20+
- Docker & Docker Compose
- NPM

### Development Setup

Klenzo uses a standardized Docker development environment with hot-reloading:

1. **Install Dependencies Locally**:
   ```bash
   npm install
   ```

2. **Start the Environment**:
   ```bash
   docker-compose --profile development up --build
   ```
   *Note: The `--profile development` flag includes **Mailpit** for email testing.*

### Key Features
- **Nx Watch Mode**: Containers automatically rebuild and restart when you edit code.
- **Dependency Protection**: Internal `node_modules` are preserved within containers.
- **Database Initialization**: Automated creation of `auth` and `finance` schemas.

---

## 📡 API Documentation

### Base URL
`http://localhost:3000/api`

### 1. Auth Service

#### **Register User**
`POST /auth/register`
- **Body**:
  ```json
  {
    "email": "user@example.com",
    "password": "password123"
  }
  ```
- **Constraints**: Password min 8 chars.

#### **Login**
`POST /auth/login`
- **Body**:
  ```json
  {
    "email": "user@example.com",
    "password": "password123"
  }
  ```
- **Response**: `{ "accessToken": "...", "refreshToken": "..." }`

#### **Refresh Token**
`POST /auth/refresh`
- **Body**: `{ "refreshToken": "..." }`

#### **Forgot Password**
`POST /auth/forgot-password`
- **Body**: `{ "email": "user@example.com" }`

#### **Reset Password**
`POST /auth/reset-password`
- **Body**:
  ```json
  {
    "token": "reset_token_from_email",
    "password": "new_password123"
  }
  ```

#### **Get Profile** (Authenticated)
`GET /auth/profile`
- **Header**: `Authorization: Bearer <token>`

---

### 2. Finance Service

#### **Create Transaction**
`POST /finance/transactions`
- **Body**:
  ```json
  {
    "userId": 1,
    "amount": 100.50,
    "description": "Grocery",
    "category": "Food",
    "transactionType": "expense",
    "date": "2024-03-12T10:00:00Z"
  }
  ```

#### **Get Transactions**
`GET /finance/transactions/:userId`

---

## 🛠 Infrastructure

| Service | Port | Description |
|---------|------|-------------|
| **API Gateway** | 3000 | Main Entry Point |
| **NATS** | 4222 | Message Broker |
| **PostgreSQL** | 5432 | Primary Database |
| **Redis** | 6379 | Caching |
| **MinIO** | 9000/9001 | Object Storage |
| **Mailpit** | 8025 | Web Email UI (Dev Only) |

## 📦 Database Schemas

The system uses separate schemas within the same PostgreSQL database:
- `auth`: Users, sessions, security tokens.
- `finance`: Accounts, transactions, budgets.
- `habit`, `insight`, `notifications`, `productivity`: (Initial schemas created).

## 📄 License
MIT
