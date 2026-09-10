import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { RedisService } from '../../redis/redis.service';

/**
 * Idempotency guard for POST/PUT/DELETE finance operations.
 * Uses Redis to deduplicate requests with the same idempotency key.
 * Prevents double-charges on network retries.
 */
@Injectable()
export class IdempotencyGuard implements CanActivate {
  private readonly TTL_SECONDS = 86400; // 24 hours

  constructor(private readonly redis: RedisService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // Only apply to mutating methods
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
      const idempotencyKey =
        request.headers['idempotency-key'] as string;

      if (idempotencyKey) {
        const cacheKey = `idempotency:${idempotencyKey}`;

        // Check if this key was already processed
        const existingResponse = await this.redis.get<{
          status: number;
          body: any;
        }>(cacheKey);

        if (existingResponse) {
          // Return the cached response
          throw new HttpException(existingResponse.body, existingResponse.status as any);
        }

        // Store a marker to prevent concurrent duplicate processing
        await this.redis.set(
          cacheKey,
          { status: 202, body: { processing: true } },
          this.TTL_SECONDS,
        );
      }
    }

    return true;
  }
}

/**
 * Decorator to mark an endpoint as idempotent.
 * Usage: @UseGuards(IdempotencyGuard)
 */
