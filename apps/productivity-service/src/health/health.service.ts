import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../klenzo/src/app/prisma/prisma.service';

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(private readonly prisma: PrismaService) {}

  async check() {
    const checks = {
      service: 'productivity-service',
      status: 'ok' as 'ok' | 'degraded' | 'down',
      timestamp: new Date().toISOString(),
      database: 'unknown' as string,
      uptime: process.uptime(),
    };

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      checks.database = 'up';
    } catch (err) {
      this.logger.error('Database health check failed', err);
      checks.database = 'down';
      checks.status = 'down';
    }

    return checks;
  }
}
