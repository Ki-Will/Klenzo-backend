import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Reflector } from '@nestjs/core';
import { CACHE_CONTROL_KEY } from '../decorators/api-version.decorator';

/**
 * Cache headers interceptor.
 * Sets Cache-Control, ETag, and conditional response headers.
 */
@Injectable()
export class CacheHeadersInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    // Only apply caching to GET requests
    if (request.method !== 'GET') {
      response.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      return next.handle();
    }

    const cachePolicy = this.reflector.get<string>(
      CACHE_CONTROL_KEY,
      context.getHandler(),
    );

    if (cachePolicy) {
      response.setHeader('Cache-Control', cachePolicy);
    } else {
      // Default: cache for 60 seconds with stale-while-revalidate
      response.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    }

    return next.handle().pipe(
      tap((data) => {
        // Generate ETag based on response content
        if (data && typeof data === 'object') {
          const etag = `"${Buffer.from(JSON.stringify(data)).toString('base64').substring(0, 32)}"`;
          response.setHeader('ETag', etag);

          // Check If-None-Match for conditional responses
          const ifNoneMatch = request.headers['if-none-match'];
          if (ifNoneMatch === etag) {
            response.status(304).end();
          }
        }
      }),
    );
  }
}
