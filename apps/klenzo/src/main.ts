import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import compression from 'compression';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const cookieParser = require('cookie-parser');
import { AppModule } from './app/app.module';
import { AllExceptionsFilter } from './app/common/filters/all-exceptions.filter';
import { TimeoutInterceptor } from './app/common/interceptors/timeout.interceptor';
import { CorrelationIdInterceptor } from './app/common/interceptors/correlation-id.interceptor';
import { CompressionInterceptor } from './app/common/interceptors/compression.interceptor';
import { SanitizationInterceptor } from './app/common/interceptors/sanitization.interceptor';
import { CacheControlInterceptor } from './app/common/interceptors/cache-control.interceptor';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // ── Security Middleware ─────────────────────────────────────────────────
  // Helmet: Sets various HTTP security headers
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
          fontSrc: ["'self'", "https://fonts.gstatic.com"],
          imgSrc: ["'self'", "data:", "https:", "http:"],
          connectSrc: ["'self'"],
          frameSrc: ["'none'"],
          objectSrc: ["'none'"],
        },
      },
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  // Compression: Gzip/Brotli for response bodies
  app.use(
    compression({
      level: 6,
      threshold: 1024, // Only compress responses > 1KB
      filter: (req, res) => {
        if (req.headers['x-no-compression']) return false;
        return compression.filter(req, res);
      },
    }),
  );

  // ── Cookie Parser ──────────────────────────────────────────────────────
  app.use((cookieParser as unknown as () => ReturnType<typeof cookieParser>)());

  // ── Body Size Limits ───────────────────────────────────────────────────
  const express = require('express');
  app.use(express.json({ limit: '1mb' })); // Reduced from 10mb
  app.use(express.urlencoded({ limit: '1mb', extended: true }));

  // Upload-specific limit (applied to multipart routes)
  app.use('/api/*/upload', express.json({ limit: '10mb' }));

  // ── CORS ──────────────────────────────────────────────────────────────────
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
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
      } else {
        if (process.env.NODE_ENV !== 'production') {
          callback(null, true);
        } else {
          callback(new Error(`CORS: origin ${origin} not allowed`));
        }
      }
    },
    credentials: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type,Authorization,Cookie,Idempotency-Key,X-Correlation-ID',
    preflightContinue: false,
    optionsSuccessStatus: 204,
  });

  // ── API Versioning ─────────────────────────────────────────────────────
  app.setGlobalPrefix('api', {
    exclude: ['healthz', 'healthz/live', 'healthz/ready'],
  });

  // ── Global Interceptors ────────────────────────────────────────────────
  app.useGlobalInterceptors(
    new TimeoutInterceptor(30000),
    new CorrelationIdInterceptor(),
    new CompressionInterceptor(),
    new SanitizationInterceptor(),
  );

  // ── Validation ────────────────────────────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      forbidNonWhitelisted: true,
      disableErrorMessages: process.env.NODE_ENV === 'production',
    }),
  );

  // ── Global Exception Filter ───────────────────────────────────────────
  app.useGlobalFilters(new AllExceptionsFilter());

  // ── Swagger / OpenAPI ────────────────────────────────────────────────
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Klenzo API')
      .setDescription(
        'Enterprise-Grade Distributed Financial & Productivity Platform API\n\n' +
          '## Architecture\n' +
          'Microservices with gRPC inter-service communication and Redis Pub/Sub event bus.\n\n' +
          '## Security\n' +
          '- JWT Bearer authentication\n' +
          '- Rate limiting (10 req/s for auth, 50 req/s for API)\n' +
          '- Idempotency keys for finance mutations\n' +
          '- Correlation IDs for distributed tracing',
      )
      .setVersion('1.0')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
        'access-token',
      )
      .addTag('Auth', 'Authentication, registration, and KYC verification')
      .addTag('Finance', 'Transactions, wallets, transfers, and payroll')
      .addTag('Productivity', 'Task management and productivity tracking')
      .addTag('Habits', 'Habit tracking and completion logs')
      .addTag('Notifications', 'Real-time alerts and email delivery')
      .addTag('Insights', 'Financial analytics and spending metrics')
      .addTag('Admin', 'Platform administration and user management')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
        docExpansion: 'none',
        filter: true,
        showRequestDuration: true,
      },
    });

    Logger.log(
      `📚 Swagger docs: http://localhost:${process.env.PORT || 3000}/api/docs`,
    );
  }

  // ── Graceful Shutdown ─────────────────────────────────────────────────
  process.on('SIGTERM', async () => {
    Logger.log('SIGTERM received. Starting graceful shutdown...');
    await app.close();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    Logger.log('SIGINT received. Starting graceful shutdown...');
    await app.close();
    process.exit(0);
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);
  Logger.log(`🚀 Klenzo running on: http://localhost:${port}/api`);
  Logger.log(`   CORS origin: ${frontendUrl}`);
  Logger.log(`   Security: Helmet + Compression + Rate Limiting`);
  Logger.log(`   Tracing: Correlation IDs enabled`);
}

bootstrap();
