import { Module, Global } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { JobQueueService } from './job-queue.service';

/**
 * Global job queue module.
 * Uses BullMQ for reliable, persistent event processing.
 * Replaces Redis Pub/Sub for critical events that must not be lost.
 */
@Global()
@Module({
  imports: [
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
      },
      defaultJobOptions: {
        removeOnComplete: 100, // Keep last 100 completed jobs
        removeOnFail: 500, // Keep last 500 failed jobs for debugging
        attempts: 3, // Retry up to 3 times
        backoff: {
          type: 'exponential',
          delay: 1000, // Start with 1 second delay
        },
      },
    }),
    BullModule.registerQueue(
      { name: 'notifications' },
      { name: 'finance-events' },
      { name: 'analytics' },
    ),
  ],
  providers: [JobQueueService],
  exports: [BullModule, JobQueueService],
})
export class JobQueueModule {}
