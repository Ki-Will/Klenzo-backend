import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('HabitService');
  const httpPort = parseInt(process.env.HABIT_SERVICE_PORT || '3004', 10);

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
  logger.log(`🚀 Habit Service HTTP on port ${httpPort}`);
}

bootstrap();
