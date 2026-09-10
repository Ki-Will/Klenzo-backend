# gRPC Protocol Buffer Reference

## Overview

Klenzo uses gRPC for synchronous inter-service communication. Protocol Buffer definitions are located in `libs/proto/` and define the service contracts for inter-service RPC calls.

## Proto Files

| File | Package | Services |
|------|---------|----------|
| `auth.proto` | `auth` | AuthService |
| `finance.proto` | `finance` | FinanceService |

## Authentication Service (`auth.proto`)

### Service Definition

```protobuf
syntax = "proto3";
package auth;

service AuthService {
  // Validate a JWT token and return user info
  rpc ValidateToken (ValidateTokenRequest) returns (ValidateTokenResponse);
  
  // Get user profile by ID
  rpc GetUserProfile (GetUserProfileRequest) returns (GetUserProfileResponse);
  
  // Check if user has a specific role
  rpc CheckRole (CheckRoleRequest) returns (CheckRoleResponse);
}
```

### Messages

#### ValidateToken

```protobuf
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

**Usage:**
```typescript
// Finance Service validates token from Auth Service
const result = await authClient.validateToken({ token: 'eyJhbGciOi...' });
if (result.isValid) {
  // Proceed with request
}
```

#### GetUserProfile

```protobuf
message GetUserProfileRequest {
  string userId = 1;
}

message GetUserProfileResponse {
  string id = 1;
  string email = 2;
  string name = 3;
  string phone = 4;
  string avatar = 5;
  string role = 6;
  bool isActive = 7;
  string createdAt = 8;
  string updatedAt = 9;
}
```

**Usage:**
```typescript
// Finance Service gets user profile for display
const profile = await authClient.getUserProfile({ userId: 'user-uuid' });
console.log(profile.name, profile.email);
```

#### CheckRole

```protobuf
message CheckRoleRequest {
  string userId = 1;
  string requiredRole = 2;
}

message CheckRoleResponse {
  bool hasRole = 1;
  string actualRole = 2;
}
```

**Usage:**
```typescript
// Finance Service checks if user is admin
const result = await authClient.checkRole({ 
  userId: 'user-uuid', 
  requiredRole: 'ADMIN' 
});
if (!result.hasRole) {
  throw new ForbiddenException('Admin access required');
}
```

---

## Finance Service (`finance.proto`)

### Service Definition

```protobuf
syntax = "proto3";
package finance;

service FinanceService {
  // Get user's main wallet balance
  rpc GetUserWalletBalance (GetUserWalletBalanceRequest) returns (GetUserWalletBalanceResponse);
  
  // Validate user has sufficient funds for a transfer
  rpc ValidateSufficientFunds (ValidateSufficientFundsRequest) returns (ValidateSufficientFundsResponse);
  
  // Get user's transaction summary
  rpc GetTransactionSummary (GetTransactionSummaryRequest) returns (GetTransactionSummaryResponse);
}
```

### Messages

#### GetUserWalletBalance

```protobuf
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

**Usage:**
```typescript
// Other services can query wallet balance
const balance = await financeClient.getUserWalletBalance({ userId: 'user-uuid' });
if (balance.hasWallet) {
  console.log(`Balance: ${balance.mainWalletBalance} ${balance.currency}`);
}
```

#### ValidateSufficientFunds

```protobuf
message ValidateSufficientFundsRequest {
  string userId = 1;
  double amount = 2;
  string currency = 3;
}

message ValidateSufficientFundsResponse {
  bool isSufficient = 1;
  double currentBalance = 2;
  double requestedAmount = 3;
  string currency = 4;
}
```

**Usage:**
```typescript
// Validate before creating a transfer
const validation = await financeClient.validateSufficientFunds({
  userId: 'sender-uuid',
  amount: 100.00,
  currency: 'USD'
});

if (!validation.isSufficient) {
  throw new BadRequestException(
    `Insufficient funds. Available: ${validation.currentBalance}`
  );
}
```

#### GetTransactionSummary

```protobuf
message GetTransactionSummaryRequest {
  string userId = 1;
  string startDate = 2;
  string endDate = 3;
}

message GetTransactionSummaryResponse {
  string userId = 1;
  double totalIncome = 2;
  double totalExpenses = 3;
  double netBalance = 4;
  int32 transactionCount = 5;
  string currency = 6;
}
```

**Usage:**
```typescript
// Insight Service gets summary for analytics
const summary = await financeClient.getTransactionSummary({
  userId: 'user-uuid',
  startDate: '2026-01-01',
  endDate: '2026-01-31'
});

console.log(`Income: ${summary.totalIncome}`);
console.log(`Expenses: ${summary.totalExpenses}`);
console.log(`Net: ${summary.netBalance}`);
```

---

## Client Configuration

### NestJS gRPC Client

```typescript
// In finance-service/src/app.module.ts
@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'AUTH_GRPC',
        transport: Transport.GRPC,
        options: {
          package: 'auth',
          protoPath: join(__dirname, '..', '..', 'libs', 'proto', 'auth.proto'),
          url: process.env.AUTH_GRPC_URL || 'localhost:5001',
        },
      },
    ]),
  ],
})
```

### Service Injection

```typescript
@Injectable()
export class FinanceGrpcService {
  constructor(
    @Inject('AUTH_GRPC') private readonly authClient: ClientGrpc,
  ) {}

  onModuleInit() {
    this.authService = this.authClient.getService<AuthServiceClient>('AuthService');
  }

  async validateToken(token: string) {
    return firstValueFrom(this.authService.validateToken({ token }));
  }
}
```

---

## Port Allocation

| Service | HTTP Port | gRPC Port |
|---------|-----------|-----------|
| Auth Service | 3001 | 5001 |
| Finance Service | 3002 | 5002 |
| Productivity Service | 3003 | — |
| Habit Service | 3004 | — |
| Notification Service | 3005 | — |
| Insight Service | 3006 | — |

---

## Service Discovery

### Docker Compose

Services discover each other by container name:

```yaml
environment:
  - AUTH_GRPC_URL=auth-service:5001
  - FINANCE_GRPC_URL=finance-service:5002
```

### Production

Use environment variables:

```env
AUTH_GRPC_URL=auth-service.internal:5001
FINANCE_GRPC_URL=finance-service.internal:5002
```

---

## Error Handling

### gRPC Status Codes

| Code | Name | Description |
|------|------|-------------|
| 0 | OK | Success |
| 3 | INVALID_ARGUMENT | Invalid request |
| 5 | NOT_FOUND | Resource not found |
| 7 | PERMISSION_DENIED | Insufficient permissions |
| 13 | INTERNAL | Server error |
| 14 | UNAVAILABLE | Service unavailable |

### NestJS Exception Mapping

```typescript
// Server-side
throw new RpcException({
  code: status.NOT_FOUND,
  message: 'User not found',
});

// Client-side
try {
  await firstValueFrom(this.authService.validateToken({ token }));
} catch (error) {
  if (error.code === status.NOT_FOUND) {
    // Handle not found
  }
}
```

---

## Performance Considerations

- **Connection pooling**: gRPC clients use HTTP/2 multiplexing
- **Keepalive**: Connections are kept alive between requests
- **Timeout**: Configure per-call timeouts for critical operations
- **Retry**: Implement retry logic with exponential backoff
