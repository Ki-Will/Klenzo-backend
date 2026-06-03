import { Logger } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsString,
  validateSync,
  IsNotEmpty,
} from 'class-validator';

const logger = new Logger('Configuration');

enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

class EnvironmentVariables {
  @IsEnum(Environment)
  NODE_ENV: Environment = Environment.Development;

  @IsNumber()
  PORT = 3000;

  @IsString()
  @IsNotEmpty()
  JWT_SECRET: string;

  @IsString()
  JWT_EXPIRES_IN = '15m';

  @IsString()
  DB_HOST = 'localhost';

  @IsNumber()
  DB_PORT = 5432;

  @IsString()
  DB_USER = 'klenzo';

  @IsString()
  DB_PASSWORD = 'klenzo_password';

  @IsString()
  DB_NAME = 'klenzo_db';

  @IsString()
  SMTP_HOST = 'localhost';

  @IsNumber()
  SMTP_PORT = 1025;

  @IsString()
  REDIS_HOST = 'localhost';

  @IsNumber()
  REDIS_PORT = 6379;

  @IsString()
  FRONTEND_URL = 'http://localhost:5173';
}

export function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(errors.toString());
  }
  return validatedConfig;
}

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
  const jwtSecret = process.env.JWT_SECRET || '';
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