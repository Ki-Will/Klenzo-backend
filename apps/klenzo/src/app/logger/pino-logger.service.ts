import pino from 'pino';
import pinoHttp from 'pino-http';
import { Injectable } from '@nestjs/common';

/**
 * Centralised Pino logger configuration.
 * Logs are JSON‑structured, include requestId and timestamp.
 * Adjust level via LOG_LEVEL env var (default: 'info').
 */
@Injectable()
export class PinoLogger {
  private logger = pino({
    level: process.env.LOG_LEVEL || 'info',
    base: { pid: process.pid },
    timestamp: () => `"time":"${new Date().toISOString()}"`,
  });

  /** Returns the raw pino instance – useful for direct calls. */
  getInstance() {
    return this.logger;
  }

  /** Returns a pino‑http middleware bound to this logger. */
  getHttpMiddleware() {
    return pinoHttp({ logger: this.logger });
  }
}
