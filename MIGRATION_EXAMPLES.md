# TypeORM to Prisma Migration Examples

## AuthService Migration

### Before (TypeORM)

```typescript
import {
  Injectable,
  UnauthorizedException,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { User } from '../entities/user.entity';
import { RegisterDto, LoginDto, UpdateProfileDto } from '../dto/auth.dto';
import { JwtPayload } from './jwt.strategy';
import { NotificationService } from '../notification/notification.service';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private sessions = new Map<number, Session[]>();

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly jwtService: JwtService,
    private readonly notificationService: NotificationService,
    private readonly redis: RedisService,
  ) {}
```

### After (Prisma)

```typescript
import {
  Injectable,
  UnauthorizedException,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { RegisterDto, LoginDto, UpdateProfileDto } from '../dto/auth.dto';
import { JwtPayload } from './jwt.strategy';
import { NotificationService } from '../notification/notification.service';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private sessions = new Map<number, Session[]>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly notificationService: NotificationService,
    private readonly redis: RedisService,
  ) {}
```

### Method Migration Examples

#### Register Method

**Before:**
```typescript
async register(dto: RegisterDto, device?: string) {
  const existing = await this.userRepository.findOne({
    where: { email: dto.email },
  });
  if (existing) throw new ConflictException('Email already in use');

  const passwordHash = await bcrypt.hash(dto.password, 10);
  const user = this.userRepository.create({ email: dto.email, passwordHash });
  const saved = await this.userRepository.save(user);
  // ... rest
}
```

**After:**
```typescript
async register(dto: RegisterDto, device?: string) {
  const existing = await this.prisma.user.findUnique({
    where: { email: dto.email },
  });
  if (existing) throw new ConflictException('Email already in use');

  const passwordHash = await bcrypt.hash(dto.password, 10);
  const saved = await this.prisma.user.create({
    data: {
      email: dto.email,
      passwordHash,
    },
  });
  // ... rest
}
```

#### Login Method

**Before:**
```typescript
async login(dto: LoginDto, device?: string) {
  const user = await this.userRepository.findOne({
    where: { email: dto.email },
  });
  if (!user) throw new UnauthorizedException('Invalid credentials');
  // ... rest
}
```

**After:**
```typescript
async login(dto: LoginDto, device?: string) {
  const user = await this.prisma.user.findUnique({
    where: { email: dto.email },
  });
  if (!user) throw new UnauthorizedException('Invalid credentials');
  // ... rest
}
```

#### Update Profile

**Before:**
```typescript
async updateProfile(userId: number, dto: UpdateProfileDto) {
  const user = await this.userRepository.findOne({ where: { id: userId } });
  if (!user) throw new NotFoundException('User not found');
  
  const updates: Partial<User> = {};
  if (dto.email !== undefined) updates.email = dto.email;
  if (dto.name !== undefined) updates.name = dto.name;
  
  await this.userRepository.update(userId, updates);
  // ... rest
}
```

**After:**
```typescript
async updateProfile(userId: number, dto: UpdateProfileDto) {
  const existingUser = await this.prisma.user.findUnique({
    where: { id: userId },
  });
  if (!existingUser) throw new NotFoundException('User not found');

  const updates: Prisma.UserUpdateInput = {};
  if (dto.email !== undefined) updates.email = dto.email;
  if (dto.name !== undefined) updates.name = dto.name;

  await this.prisma.user.update({
    where: { id: userId },
    data: updates,
  });
  // ... rest
}
```

## FinanceService Migration Examples

### Before (TypeORM)

```typescript
@Injectable()
export class FinanceService {
  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepo: Repository<Transaction>,
    @InjectRepository(Group)
    private readonly groupRepo: Repository<Group>,
    // ... other repos
  ) {}
```

### After (Prisma)

```typescript
@Injectable()
export class FinanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
    private readonly insightService: InsightService,
  ) {}
```

### Transaction Creation

**Before:**
```typescript
async createTransaction(userId: number, dto: CreateTransactionDto): Promise<Transaction> {
  const transaction = this.transactionRepo.create({
    userId,
    amount: dto.amount,
    // ... other fields
  });
  const saved = await this.transactionRepo.save(transaction);
  return saved;
}
```

**After:**
```typescript
async createTransaction(userId: number, dto: CreateTransactionDto) {
  const saved = await this.prisma.transaction.create({
    data: {
      userId,
      amount: dto.amount,
      description: dto.description ?? null,
      category: dto.category ?? null,
      transactionType: dto.transactionType,
      date: new Date(dto.date),
      groupId: dto.groupId ?? null,
      accountId: dto.accountId ?? null,
      status: (dto.status as TransactionStatus) ?? TransactionStatus.APPROVED,
      parentTransactionId: dto.parentTransactionId ?? null,
    },
  });
  return saved;
}
```

### Complex Query with Relations

**Before (TypeORM):**
```typescript
async getGroupDetail(userId: number, groupId: string): Promise<Group> {
  const group = await this.groupRepo.findOne({
    where: { id: groupId },
    relations: ['members', 'transactions'],
  });
  if (!group) throw new NotFoundException('Group not found');
  this.assertGroupAccess(group, userId);
  return group;
}
```

**After (Prisma):**
```typescript
async getGroupDetail(userId: number, groupId: string) {
  const group = await this.prisma.group.findUnique({
    where: { id: groupId },
    include: {
      members: true,
      transactions: true,
    },
  });
  if (!group) throw new NotFoundException('Group not found');
  this.assertGroupAccess(group, userId);
  return group;
}
```

### Aggregation Query

**Before (TypeORM QueryBuilder):**
```typescript
async getSpendingSummary(userId: number) {
  const [expenses, income] = await Promise.all([
    this.transactionRepo.find({
      where: { userId, transactionType: TransactionType.EXPENSE, status: TransactionStatus.APPROVED },
    }),
    this.transactionRepo.find({
      where: { userId, transactionType: TransactionType.INCOME, status: TransactionStatus.APPROVED },
    }),
  ]);

  const totalExpenses = expenses.reduce((a, t) => a + Number(t.amount), 0);
  const totalIncome = income.reduce((a, t) => a + Number(t.amount), 0);
  // ... rest
}
```

**After (Prisma):**
```typescript
async getSpendingSummary(userId: number) {
  const expenses = await this.prisma.transaction.findMany({
    where: { 
      userId, 
      transactionType: TransactionType.EXPENSE, 
      status: TransactionStatus.APPROVED 
    },
  });
  
  const income = await this.prisma.transaction.findMany({
    where: { 
      userId, 
      transactionType: TransactionType.INCOME, 
      status: TransactionStatus.APPROVED 
    },
  });

  const totalExpenses = expenses.reduce((a, t) => a + Number(t.amount), 0);
  const totalIncome = income.reduce((a, t) => a + Number(t.amount), 0);
  // ... rest
}
```

### Using Aggregation Directly

**Prisma Aggregation:**
```typescript
async getTransactionVolume(userId: number) {
  const result = await this.prisma.transaction.aggregate({
    _sum: { amount: true },
    where: { userId, transactionType: TransactionType.EXPENSE },
  });
  return result._sum.amount || 0;
}
```

## Query Builder Replacements

### Find Many with Where

**TypeORM:**
```typescript
const transactions = await this.transactionRepo.find({
  where: { 
    userId, 
    date: Between(new Date(from), new Date(to)) 
  },
  order: { date: 'DESC' },
});
```

**Prisma:**
```typescript
const transactions = await this.prisma.transaction.findMany({
  where: { 
    userId,
    date: { gte: new Date(from), lte: new Date(to) }
  },
  orderBy: { date: 'desc' },
});
```

### Find One with Relations

**TypeORM:**
```typescript
const habit = await this.habitRepository.findOne({
  where: { id: habitId },
  relations: ['logs'],
});
```

**Prisma:**
```typescript
const habit = await this.prisma.habit.findUnique({
  where: { id: habitId },
  include: { logs: true },
});
```

### Count

**TypeORM:**
```typescript
const count = await this.userRepository.count();
```

**Prisma:**
```typescript
const count = await this.prisma.user.count();
```

### Update

**TypeORM:**
```typescript
await this.userRepository.update(userId, { isActive: false });
```

**Prisma:**
```typescript
await this.prisma.user.update({
  where: { id: userId },
  data: { isActive: false },
});
```

### Delete

**TypeORM:**
```typescript
await this.userRepository.delete(userId);
```

**Prisma:**
```typescript
await this.prisma.user.delete({
  where: { id: userId },
});
```

## Pattern Summary

| TypeORM | Prisma |
|---------|--------|
| `@InjectRepository(Entity)` | Inject `PrismaService` |
| `repository.find()` | `prisma.model.findMany()` |
| `repository.findOne()` | `prisma.model.findUnique()` or `findFirst()` |
| `repository.create()` | Pass `data` to `create()` |
| `repository.save()` | `prisma.model.create()` or `update()` |
| `repository.update()` | `prisma.model.update()` |
| `repository.delete()` | `prisma.model.delete()` |
| `relations: ['child']` | `include: { child: true }` |
| `createQueryBuilder()` | Built-in Prisma queries |
| `Between()`, `MoreThanOrEqual()` | `gte`, `lte`, `gt`, `lt` |