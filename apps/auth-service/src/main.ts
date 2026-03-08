import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { Transport, MicroserviceOptions } from '@nestjs/microservices';
import { AppModule } from './app/app.module';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(AppModule, {
    transport: Transport.NATS,
    options: {
      servers: [process.env.NATS_SERVERS || 'nats://localhost:4222'],
    },
  });

  await app.listen();
  Logger.log(`🚀 Auth Microservice is listening on NATS`);
}

bootstrap();
