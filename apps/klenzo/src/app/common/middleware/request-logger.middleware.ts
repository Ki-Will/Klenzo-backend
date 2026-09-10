import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

/**
 * Structured request logging middleware.
 * Logs every request with correlation ID, duration, and status.
 */
@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction) {
    const start = Date.now();
    const correlationId = req.headers['x-correlation-id'] || req.headers['x-request-id'] || '';

    // Log request
    this.logger.log(
      JSON.stringify({
        type: 'request',
        method: req.method,
        url: req.originalUrl,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        correlationId,
        timestamp: new Date().toISOString(),
      }),
    );

    // Log response
    res.on('finish', () => {
      const duration = Date.now() - start;
      const logLevel = res.statusCode >= 400 ? 'warn' : 'log';

      this.logger[logLevel](
        JSON.stringify({
          type: 'response',
          method: req.method,
          url: req.originalUrl,
          statusCode: res.statusCode,
          duration: `${duration}ms`,
          correlationId,
          timestamp: new Date().toISOString(),
        }),
      );
    });

    next();
  }
}
