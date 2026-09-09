import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../../klenzo/src/app/app.module';

async function bootstrap() {
  const logger = new Logger('InsightService');
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const port = process.env.INSIGHT_SERVICE_PORT || 3006;
  await app.listen(port);
  logger.log(`🚀 Insights, Analytics & Admin Microservice active on port ${port}`);
}

bootstrap();
