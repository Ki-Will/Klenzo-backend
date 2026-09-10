import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  RequestTimeoutException,
} from '@nestjs/common';
import { Observable, throwError, TimeoutError } from 'rxjs';
import { catchError, timeout } from 'rxjs/operators';

/**
 * Global timeout interceptor.
 * Prevents requests from hanging indefinitely.
 * Default: 30 seconds for regular endpoints, 60 seconds for uploads.
 */
@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
  constructor(private readonly defaultTimeout = 30000) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const isUpload = request.headers['content-type']?.includes('multipart');
    const timeoutMs = isUpload ? 120000 : this.defaultTimeout;

    return next.handle().pipe(
      timeout(timeoutMs),
      catchError((err) => {
        if (err instanceof TimeoutError) {
          return throwError(
            () =>
              new RequestTimeoutException(
                `Request timed out after ${timeoutMs / 1000}s`,
              ),
          );
        }
        return throwError(() => err);
      }),
    );
  }
}
