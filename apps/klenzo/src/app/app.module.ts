import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { loadConfig } from './config/configuration';

// Entities
import { User } from './entities/user.entity';
import { Task } from './entities/task.entity';
import { Habit, HabitLog } from './entities/habit.entity';
import { Transaction } from './entities/transaction.entity';
import { Group, GroupMember } from './entities/group.entity';
import { Budget } from './entities/budget.entity';
import { Account } from './entities/account.entity';
import { Notification } from './entities/notification.entity';

// Feature modules
import { RedisModule } from './redis/redis.module';
import { AuthModule } from './auth/auth.module';
import { ProductivityModule } from './productivity/productivity.module';
import { HabitModule } from './habit/habit.module';
import { FinanceModule } from './finance/finance.module';
import { NotificationModule } from './notification/notification.module';
import { InsightModule } from './insight/insight.module';
import { AdminModule } from './admin/admin.module';

const isDev = process.env.NODE_ENV !== 'production';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [loadConfig],
      envFilePath: '.env',
      ignoreEnvFile: !isDev,
    }),

    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      username: process.env.DB_USER || 'klenzo',
      password: process.env.DB_PASSWORD || 'klenzo_password',
      database: process.env.DB_NAME || 'klenzo_db',
      entities: [
        User,
        Task,
        Habit,
        HabitLog,
        Transaction,
        Group,
        GroupMember,
        Budget,
        Account,
        Notification,
      ],
      synchronize: isDev,
      // dropSchema: true,
      logging: isDev ? ['error', 'warn'] : false,
    }),

    // Redis — global, available in every module without re-importing
    RedisModule,

    ThrottlerModule.forRoot(
      isDev
        ? [{ name: 'global', ttl: 60000, limit: 1000 }]
        : [
            { name: 'short', ttl: 1000, limit: 20 },
            { name: 'medium', ttl: 10000, limit: 100 },
            { name: 'long', ttl: 60000, limit: 300 },
          ],
    ),

    AuthModule,
    ProductivityModule,
    HabitModule,
    FinanceModule,
    NotificationModule,
    InsightModule,
    AdminModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
