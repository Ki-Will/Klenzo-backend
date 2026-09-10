import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/**
 * Compression hint interceptor.
 * Sets Content-Encoding headers for large responses.
 * Actual compression is handled by Nginx or reverse proxy.
 */
@Injectable()
export class CompressionInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const response = context.switchToHttp().getResponse();
    
    // Set Vary header for proper caching with compression
    response.setHeader('Vary', 'Accept-Encoding');
    
    return next.handle();
  }
}
