import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../../klenzo/src/app/app.module';

async function bootstrap() {
  const logger = new Logger('HabitService');
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const port = process.env.HABIT_SERVICE_PORT || 3004;
  await app.listen(port);
  logger.log(`🚀 Habit Tracking Microservice active on port ${port}`);
}

bootstrap();
