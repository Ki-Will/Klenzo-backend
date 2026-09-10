# Auth Service

## Overview

The Auth Service handles all authentication, authorization, user management, and KYC (Know Your Customer) verification for the Klenzo platform. It is the identity provider for all other microservices.

## Ports

| Protocol | Port | Purpose |
|----------|------|---------|
| HTTP | 3001 | External API (Nginx routing) |
| gRPC | 5001 | Internal service-to-service calls |

## Responsibilities

- User registration and login
- JWT token generation and validation
- Refresh token rotation
- Password hashing and reset
- Account lockout after failed attempts
- Multi-tier KYC verification
- Session management
- Role-based access control (RBAC)

## API Endpoints

### Authentication

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/auth/register` | Register new user | No |
| POST | `/api/auth/login` | Login with credentials | No |
| POST | `/api/auth/refresh` | Refresh access token | No |
| POST | `/api/auth/logout` | Logout (clear tokens) | Yes |
| POST | `/api/auth/forgot-password` | Request password reset | No |
| POST | `/api/auth/reset-password` | Reset password with token | No |

### Profile

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/auth/profile` | Get current user profile | Yes |
| PATCH | `/api/auth/profile` | Update profile | Yes |
| POST | `/api/auth/change-password` | Change password | Yes |

### KYC

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/kyc/submit` | Submit KYC documents | Yes |
| GET | `/api/kyc/status` | Check KYC status | Yes |
| POST | `/api/kyc/verify` | Admin: verify KYC | Yes (ADMIN) |

## Request/Response Examples

### Register

**Request:**
```json
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecureP@ss123"
}
```

**Response:**
```json
{
  "message": "Registration successful",
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "a1b2c3d4e5f6...",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "role": "USER",
    "isActive": true,
    "createdAt": "2026-01-01T00:00:00.000Z"
  }
}
```

### Login

**Request:**
```json
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecureP@ss123"
}
```

**Response:**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "a1b2c3d4e5f6...",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": null,
    "role": "USER",
    "isActive": true,
    "lastLogin": "2026-01-01T12:00:00.000Z"
  }
}
```

### Token Validation (gRPC)

**Proto Definition:**
```protobuf
service AuthService {
  rpc ValidateToken (ValidateTokenRequest) returns (ValidateTokenResponse);
  rpc GetUserProfile (GetUserProfileRequest) returns (GetUserProfileResponse);
  rpc CheckRole (CheckRoleRequest) returns (CheckRoleResponse);
}

message ValidateTokenRequest {
  string token = 1;
}

message ValidateTokenResponse {
  bool isValid = 1;
  string userId = 2;
  string email = 3;
  string role = 4;
  bool isActive = 5;
}
```

## Security Features

### JWT Tokens

- **Access Token**: 15-minute expiry
- **Refresh Token**: 7-day expiry, stored hashed in database
- **Storage**: HttpOnly cookies (browser) or Authorization header (API clients)

### Password Policy

- Minimum 8 characters
- Hashed with bcrypt (10 rounds)
- Password reset tokens expire after 1 hour

### Account Lockout

- After 5 failed login attempts, account is locked
- User must reset password to regain access
- Email notification sent on lockout

### RBAC Roles

| Role | Description |
|------|-------------|
| `USER` | Standard user, own data only |
| `ADMIN` | Can view all users, manage KYC |
| `SUPERADMIN` | Full system access |

## Environment Variables

```env
# Service Configuration
AUTH_SERVICE_PORT=3001
AUTH_GRPC_PORT=5001

# Database
DATABASE_URL=postgresql://user:pass@host:5432/klenzo_db?schema=auth

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT
JWT_SECRET=your_secure_random_secret
JWT_EXPIRES_IN=15m

# Email (for notifications)
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_FROM=noreply@localhost
```

## Health Checks

| Endpoint | Description |
|----------|-------------|
| `GET /healthz` | Full health check (database, Redis, uptime) |
| `GET /healthz/live` | Liveness probe |
| `GET /healthz/ready` | Readiness probe |

**Response:**
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

## Dependencies

- **Prisma**: Database access (auth schema)
- **Redis**: Session cache, token blacklist
- **JWT**: Token generation/validation
- **bcrypt**: Password hashing
- **Notification Service**: Welcome emails, lockout alerts

## Error Codes

| Code | Description |
|------|-------------|
| 400 | Invalid request body |
| 401 | Invalid credentials |
| 401 | Token expired |
| 401 | Account locked |
| 404 | User not found |
| 409 | Email already in use |
| 429 | Rate limit exceeded |
