import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { PinoLogger } from './pino-logger.service';

/**
 * LoggerModule registers the PinoLogger service as a provider and applies the
 * pino‑http middleware to every incoming request. The middleware attaches a
 * unique requestId (via the `x-request-id` header) that can be used in audit
 * entries.
 */
@Module({
  providers: [PinoLogger],
  exports: [PinoLogger],
})
export class LoggerModule implements NestModule {
  constructor(private readonly pinoLogger: PinoLogger) {}

  configure(consumer: MiddlewareConsumer) {
    consumer.apply(this.pinoLogger.getHttpMiddleware()).forRoutes('*');
  }
}
