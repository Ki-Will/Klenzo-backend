import { Logger } from '@nestjs/common';

const logger = new Logger('Configuration');

export interface AppConfig {
  port: number;
  nodeEnv: string;
  jwtSecret: string;
  jwtExpiresIn: string;
  database: {
    host: string;
    port: number;
    user: string;
    password: string;
    name: string;
  };
  smtp: {
    host: string;
    port: number;
  };
  redis: {
    host: string;
    port: number;
  };
  frontendUrl: string;
}

export function loadConfig(): AppConfig {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    logger.error(
      '❌ JWT_SECRET is not set! Please set JWT_SECRET in your .env file.',
    );
    process.exit(1);
  }
  if (jwtSecret === 'KlenzoSecret' || jwtSecret === 'secret_key') {
    logger.warn(
      '⚠️  Using a default/weak JWT_SECRET. Please change this to a strong random value in production!',
    );
  }

  return {
    port: parseInt(process.env.PORT || '3000', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
    jwtSecret,
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '15m',
    database: {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      user: process.env.DB_USER || 'klenzo',
      password: process.env.DB_PASSWORD || 'klenzo_password',
      name: process.env.DB_NAME || 'klenzo_db',
    },
    smtp: {
      host: process.env.SMTP_HOST || 'localhost',
      port: parseInt(process.env.SMTP_PORT || '1025', 10),
    },
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
    },
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  };
}