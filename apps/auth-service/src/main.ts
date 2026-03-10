import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const globalPrefix = 'api';
  app.setGlobalPrefix(globalPrefix);
  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(
    `🚀 Auth Service is running on: http://localhost:${port}/${globalPrefix}`
  );
  await app.listen();
  Logger.log(`🚀 Auth Microservice is listening on NATS`);
}

bootstrap();
