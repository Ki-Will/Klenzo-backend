# Security Practices

## Overview

Klenzo Backend implements defense-in-depth security practices across application, network, and database layers.

## Authentication

### JWT Tokens

- **Algorithm**: HS256 (HMAC-SHA256)
- **Access Token Expiry**: 15 minutes
- **Refresh Token Expiry**: 7 days
- **Storage**: HttpOnly cookies + Authorization header fallback

### Token Structure

```json
{
  "id": "user-uuid",
  "email": "user@example.com",
  "iat": 1704067200,
  "exp": 1704068100
}
```

### Refresh Token Rotation

1. On login, generate new refresh token
2. Store SHA-256 hash in database
3. On refresh, validate hash and issue new pair
4. Old refresh token is invalidated

## Authorization

### RBAC Roles

| Role | Permissions |
|------|-------------|
| `USER` | Read/write own data |
| `ADMIN` | Read all users, manage KYC, view audit logs |
| `SUPERADMIN` | Full system access |

### Guards

```typescript
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Get('admin/users')
async listUsers() { ... }
```

## Input Validation

### Global Validation Pipe

```typescript
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true,              // Strip unknown properties
    forbidNonWhitelisted: true,   // Reject unknown properties
    transform: true,              // Auto-transform payloads
    transformOptions: {
      enableImplicitConversion: true,
    },
  }),
);
```

### DTO Validation

```typescript
export class RegisterDto {
  @IsEmail()
  email: string;

  @MinLength(8)
  @Matches(/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*#?&]/)
  password: string;
}
```

## Rate Limiting

### Configuration

```typescript
ThrottlerModule.forRoot([
  { name: 'short', ttl: 1000, limit: 20 },    // 20 req/s
  { name: 'medium', ttl: 10000, limit: 100 },  // 100 req/10s
  { name: 'long', ttl: 60000, limit: 300 },    // 300 req/min
])
```

### Nginx Rate Limiting

```nginx
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=50r/s;
limit_req_zone $binary_remote_addr zone=auth_limit:10m rate=10r/s;
```

## Password Security

### Hashing

- **Algorithm**: bcrypt
- **Rounds**: 10
- **Storage**: Only hash stored, never plaintext

### Account Lockout

- After 5 failed attempts, account is locked
- User must reset password to regain access
- Email notification sent on lockout

## CORS Configuration

```typescript
app.enableCors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.has(origin)) {
      callback(null, true);
    } else {
      callback(new Error('CORS not allowed'));
    }
  },
  credentials: true,
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
  allowedHeaders: 'Content-Type,Authorization,Cookie',
});
```

## Security Headers (Nginx)

```nginx
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "no-referrer-when-downgrade" always;
add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;
```

## Sensitive Data Handling

### Audit Logging Sanitization

```typescript
const sensitiveKeys = [
  'password', 'token', 'accessToken', 
  'refreshToken', 'oldPassword', 'newPassword'
];

for (const key of sensitiveKeys) {
  if (key in sanitizedBody) {
    sanitizedBody[key] = '[REDACTED]';
  }
}
```

### Environment Variables

- Never commit `.env` files
- Use `${VAR:-default}` pattern in docker-compose
- Rotate secrets regularly

## Database Security

### Schema Isolation

- Each service has its own schema
- Cross-schema queries prevented by convention
- Audit triggers on sensitive tables

### Connection Security

```env
DATABASE_URL=postgresql://user:pass@host:5432/db?sslmode=require
```

## API Security

### Token Validation

Every authenticated request validates:

1. Token signature
2. Token expiry
3. User exists and is active
4. User not in token blacklist (Redis)

### Request Sanitization

- Whitelist validation strips unexpected fields
- SQL injection prevented by Prisma ORM
- XSS prevented by output encoding

## Monitoring & Alerting

### Security Events Tracked

| Event | Alert Level |
|-------|-------------|
| Failed login (5x) | Account lockout |
| Invalid token | Log |
| CORS violation | Log |
| Rate limit exceeded | Log + possible block |
| Suspicious audit pattern | Alert |

## Compliance Considerations

### Data Protection

- Passwords hashed with bcrypt
- PII encrypted at rest (database level)
- Audit logs immutable (append-only)
- Refresh tokens one-time use

### Audit Trail

- Application-level: NestJS AuditInterceptor
- Database-level: PostgreSQL triggers
- Immutable finance_events table
