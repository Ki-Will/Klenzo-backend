import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';

/**
 * Graceful shutdown service.
 * Handles SIGTERM and SIGINT signals to drain connections
 * before exiting, preventing data loss during deployments.
 */
@Injectable()
export class GracefulShutdownService implements OnModuleDestroy {
  private readonly logger = new Logger(GracefulShutdownService.name);
  private isShuttingDown = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {
    // Register signal handlers
    process.on('SIGTERM', () => this.handleShutdown('SIGTERM'));
    process.on('SIGINT', () => this.handleShutdown('SIGINT'));
    process.on('beforeExit', () => this.handleShutdown('beforeExit'));
  }

  async handleShutdown(signal: string) {
    if (this.isShuttingDown) return;
    this.isShuttingDown = true;

    this.logger.log(`Received ${signal}. Starting graceful shutdown...`);

    try {
      // Close database connections
      this.logger.log('Disconnecting from database...');
      await this.prisma.$disconnect();

      // Close Redis connections
      this.logger.log('Disconnecting from Redis...');
      this.redis.onModuleDestroy?.call(this.redis);

      this.logger.log('Graceful shutdown complete.');
      process.exit(0);
    } catch (err) {
      this.logger.error('Error during graceful shutdown:', err);
      process.exit(1);
    }
  }

  onModuleDestroy() {
    // Called by NestJS lifecycle
    this.handleShutdown('ModuleDestroy');
  }
}
