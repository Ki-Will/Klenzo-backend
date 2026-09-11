import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { Transport, MicroserviceOptions } from '@nestjs/microservices';
import { join } from 'path';
import { existsSync } from 'fs';
import { AppModule } from './app.module';

// Resolve *.proto whether running from source (apps/finance-service/src)
// or from the webpack build output (dist/apps/finance-service).
function resolveProtoPath(file: string): string {
  const fromDist = join(__dirname, 'libs', 'proto', file);
  if (existsSync(fromDist)) return fromDist;
  return join(__dirname, '..', '..', '..', 'libs', 'proto', file);
}

async function bootstrap() {
  const logger = new Logger('FinanceService');
  const grpcPort = parseInt(process.env.FINANCE_GRPC_PORT || '5002', 10);
  const httpPort = parseInt(process.env.FINANCE_SERVICE_PORT || '3002', 10);

  // HTTP server for Nginx routing
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Health check endpoint (no prefix)
  app.setGlobalPrefix('api', {
    exclude: ['healthz', 'healthz/live', 'healthz/ready'],
  });

  await app.listen(httpPort);
  logger.log(`🚀 Finance Service HTTP on port ${httpPort}`);

  // gRPC microservice for inter-service communication
  const grpcApp = await NestFactory.createMicroservice<MicroserviceOptions>(
    AppModule,
    {
      transport: Transport.GRPC,
      options: {
        package: 'finance',
        protoPath: resolveProtoPath('finance.proto'),
        url: `0.0.0.0:${grpcPort}`,
      },
    },
  );

  await grpcApp.listen();
  logger.log(`🚀 Finance Service gRPC on port ${grpcPort}`);
}

bootstrap();
