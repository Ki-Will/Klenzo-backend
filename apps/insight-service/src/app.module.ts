import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { loadConfig } from '../../klenzo/src/app/config/configuration';

// Shared infrastructure
import { PrismaModule } from '../../klenzo/src/app/prisma/prisma.module';
import { RedisModule } from '../../klenzo/src/app/redis/redis.module';
import { LoggerModule } from '../../klenzo/src/app/logger/logger.module';

// Insight-specific modules
import { InsightModule } from '../../klenzo/src/app/insight/insight.module';
import { AdminModule } from '../../klenzo/src/app/admin/admin.module';
import { AuditModule } from '../../klenzo/src/app/audit/audit.module';
import { MetricsModule } from '../../klenzo/src/app/metrics/metrics.module';

// Health check
import { HealthModule } from './health/health.module';

const isDev = process.env.NODE_ENV !== 'production';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [loadConfig],
      envFilePath: '.env',
      ignoreEnvFile: !isDev,
    }),
    PrismaModule,
    RedisModule,
    LoggerModule,
    ThrottlerModule.forRoot(
      isDev
        ? [{ name: 'global', ttl: 60000, limit: 1000 }]
        : [
            { name: 'short', ttl: 1000, limit: 20 },
            { name: 'medium', ttl: 10000, limit: 100 },
            { name: 'long', ttl: 60000, limit: 300 },
          ],
    ),
    InsightModule,
    AdminModule,
    AuditModule,
    MetricsModule,
    HealthModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
