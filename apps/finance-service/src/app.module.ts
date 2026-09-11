import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { loadConfig } from '../../klenzo/src/app/config/configuration';

// Shared infrastructure
import { PrismaModule } from '../../klenzo/src/app/prisma/prisma.module';
import { RedisModule } from '../../klenzo/src/app/redis/redis.module';
import { LoggerModule } from '../../klenzo/src/app/logger/logger.module';

// Finance-specific modules
import { FinanceModule } from '../../klenzo/src/app/finance/finance.module';
import { WalletModule } from '../../klenzo/src/app/wallet/wallet.module';
import { TransfersModule } from '../../klenzo/src/app/transfers/transfers.module';
import { PayrollModule } from '../../klenzo/src/app/payroll/payroll.module';
import { NotificationModule } from '../../klenzo/src/app/notification/notification.module';

// Health check
import { HealthModule } from './health/health.module';

// gRPC provider
import { FinanceGrpcService } from './grpc/finance-grpc.service';

// gRPC client for auth service
import { ClientsModule, Transport } from '@nestjs/microservices';
import { join } from 'path';
import { existsSync } from 'fs';

const isDev = process.env.NODE_ENV !== 'production';

// Resolve *.proto whether running from source (apps/finance-service/src)
// or from the webpack build output (dist/apps/finance-service).
function resolveProtoPath(file: string): string {
  const fromDist = join(__dirname, 'libs', 'proto', file);
  if (existsSync(fromDist)) return fromDist;
  return join(__dirname, '..', '..', '..', 'libs', 'proto', file);
}

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
    // gRPC client to auth-service
    ClientsModule.register([
      {
        name: 'AUTH_GRPC',
        transport: Transport.GRPC,
        options: {
          package: 'auth',
          protoPath: resolveProtoPath('auth.proto'),
          url:
            process.env.AUTH_GRPC_URL || `localhost:${process.env.AUTH_GRPC_PORT || '5001'}`,
        },
      },
    ]),
    FinanceModule,
    WalletModule,
    TransfersModule,
    PayrollModule,
    NotificationModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    FinanceGrpcService,
  ],
})
export class AppModule {}
