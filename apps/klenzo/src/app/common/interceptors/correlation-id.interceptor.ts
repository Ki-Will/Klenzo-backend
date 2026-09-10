import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { v4 as uuidv4 } from 'uuid';

/**
 * Correlation ID interceptor.
 * Propagates X-Correlation-ID through all requests for distributed tracing.
 * If no correlation ID is provided, generates one.
 */
@Injectable()
export class CorrelationIdInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    const correlationId =
      (request.headers['x-correlation-id'] as string) ||
      (request.headers['x-request-id'] as string) ||
      uuidv4();

    // Attach to request for downstream use
    request.correlationId = correlationId;

    // Attach to response headers
    response.setHeader('X-Correlation-ID', correlationId);

    const now = Date.now();

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - now;
        // Log with correlation ID
        const logger = context.getHandler().name;
        console.log(
          JSON.stringify({
            correlationId,
            method: request.method,
            url: request.url,
            statusCode: response.statusCode,
            duration: `${duration}ms`,
            timestamp: new Date().toISOString(),
          }),
        );
      }),
    );
  }
}
