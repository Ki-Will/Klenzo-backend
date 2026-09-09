import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../../klenzo/src/app/app.module';

async function bootstrap() {
  const logger = new Logger('ProductivityService');
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const port = process.env.PRODUCTIVITY_SERVICE_PORT || 3003;
  await app.listen(port);
  logger.log(`🚀 Productivity Tasks Microservice active on port ${port}`);
}

bootstrap();
