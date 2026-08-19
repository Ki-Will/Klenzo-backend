import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { loadConfig } from './config/configuration';

// Prisma
import { PrismaModule } from './prisma/prisma.module';

// Feature modules
import { RedisModule } from './redis/redis.module';
import { AuthModule } from './auth/auth.module';
import { ProductivityModule } from './productivity/productivity.module';
import { HabitModule } from './habit/habit.module';
import { FinanceModule } from './finance/finance.module';
import { NotificationModule } from './notification/notification.module';
import { InsightModule } from './insight/insight.module';
import { AdminModule } from './admin/admin.module';
import { AuditModule } from './audit/audit.module';
import { LoggerModule } from './logger/logger.module';
import { MetricsModule } from './metrics/metrics.module';
import { AuditInterceptor } from './audit/audit.interceptor';

const isDev = process.env.NODE_ENV !== 'production';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [loadConfig],
      envFilePath: '.env',
      ignoreEnvFile: !isDev,
    }),

    // Prisma — global database connection
    PrismaModule,

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
    AuditModule,
    LoggerModule,
    MetricsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AppModule {}
