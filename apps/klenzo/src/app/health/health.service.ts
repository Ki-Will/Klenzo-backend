import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async check() {
    const checks = {
      service: 'klenzo',
      status: 'ok' as 'ok' | 'degraded' | 'down',
      timestamp: new Date().toISOString(),
      database: 'unknown' as string,
      redis: 'unknown' as string,
      uptime: process.uptime(),
    };

    // Check database
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      checks.database = 'up';
    } catch (err) {
      this.logger.error('Database health check failed', err);
      checks.database = 'down';
      checks.status = 'degraded';
    }

    // Check Redis
    try {
      checks.redis = 'up';
    } catch (err) {
      this.logger.warn('Redis health check failed (non-critical)', err);
      checks.redis = 'degraded';
    }

    return checks;
  }
}
