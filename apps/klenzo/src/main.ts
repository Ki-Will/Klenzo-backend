import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const cookieParser = require('cookie-parser');
import helmet from 'helmet';
import { AppModule } from './app/app.module';
import { AllExceptionsFilter } from './app/common/filters/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.use(helmet());

  // ── Cookie parser — must come before guards that read req.cookies ──────────
  app.use((cookieParser as unknown as () => ReturnType<typeof cookieParser>)());

  // Increase payload limit for base64 image uploads
  const express = require('express');
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ limit: '10mb', extended: true }));

  // ── CORS ──────────────────────────────────────────────────────────────────
  // Wildcard '*' is incompatible with credentials:include — browsers reject it.
  // We list allowed origins explicitly and accept requests with no origin
  // (curl, Postman, server-side Next.js proxy).
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5000';
  const allowedOrigins = new Set([
    frontendUrl,
    'http://localhost:3000',
    'http://localhost:5000',
    'http://localhost:5173',
    'http://127.0.0.1:5000',
    'http://127.0.0.1:5173',
  ]);

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      // No origin = server-side / curl / Postman — always allow
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
      } else {
        // In development allow everything; in production reject unknown origins
        if (process.env.NODE_ENV !== 'production') {
          callback(null, true);
        } else {
          callback(new Error(`CORS: origin ${origin} not allowed`));
        }
      }
    },
    credentials: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type,Authorization,Cookie',
    preflightContinue: false,
    optionsSuccessStatus: 204,
  });

  app.setGlobalPrefix('api');

  // ── Validation ────────────────────────────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // ── Global exception filter ───────────────────────────────────────────────
  app.useGlobalFilters(new AllExceptionsFilter());

  const port = process.env.PORT || 3000;
  await app.listen(port);
  Logger.log(`🚀 Klenzo running on: http://localhost:${port}/api`);
  Logger.log(`   CORS origin: ${frontendUrl}`);
}

bootstrap();
