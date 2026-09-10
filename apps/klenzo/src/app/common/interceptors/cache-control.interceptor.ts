import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { Reflector } from '@nestjs/core';
import { CACHE_CONTROL_KEY } from '../decorators/api-version.decorator';

/**
 * Cache control interceptor.
 * Sets Cache-Control headers based on decorator metadata.
 */
@Injectable()
export class CacheControlInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const cachePolicy = this.reflector.get<string>(
      CACHE_CONTROL_KEY,
      context.getHandler(),
    );

    if (cachePolicy) {
      const response = context.switchToHttp().getResponse();
      response.setHeader('Cache-Control', cachePolicy);
    }

    return next.handle();
  }
}
