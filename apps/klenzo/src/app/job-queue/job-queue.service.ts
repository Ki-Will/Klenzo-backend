import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue, Job } from 'bullmq';

/**
 * Job queue service for reliable, persistent event processing.
 * Replaces Redis Pub/Sub for critical events that must not be lost.
 *
 * Events are persisted to Redis and retried on failure.
 * Dead letter queue handles permanently failed jobs.
 */
@Injectable()
export class JobQueueService {
  private readonly logger = new Logger(JobQueueService.name);

  constructor(
    @InjectQueue('notifications') private notificationsQueue: Queue,
    @InjectQueue('finance-events') private financeEventsQueue: Queue,
    @InjectQueue('analytics') private analyticsQueue: Queue,
  ) {}

  // ── Notification Events ──────────────────────────────────────────────

  async sendNotification(params: {
    userId: string;
    type: string;
    title: string;
    body: string;
    category?: string;
    metadata?: Record<string, any>;
  }) {
    return this.notificationsQueue.add('send-notification', params, {
      priority: params.category === 'security' ? 1 : 5,
    });
  }

  async sendEmail(params: {
    to: string;
    subject: string;
    html: string;
    template?: string;
  }) {
    return this.notificationsQueue.add('send-email', params, {
      priority: 3,
    });
  }

  async sendBulkNotifications(params: {
    userIds: string[];
    type: string;
    title: string;
    body: string;
  }) {
    return this.notificationsQueue.add('send-bulk', params, {
      priority: 7,
    });
  }

  // ── Finance Events ──────────────────────────────────────────────────

  async publishTransactionEvent(params: {
    userId: string;
    transactionId: string;
    event: 'created' | 'updated' | 'deleted';
    data: Record<string, any>;
  }) {
    return this.financeEventsQueue.add('transaction-event', params, {
      priority: 2,
    });
  }

  async publishWalletEvent(params: {
    userId: string;
    walletId: string;
    event: 'balance_changed' | 'created' | 'updated';
    data: Record<string, any>;
  }) {
    return this.financeEventsQueue.add('wallet-event', params, {
      priority: 1,
    });
  }

  async publishTransferEvent(params: {
    senderId: string;
    recipientId: string;
    transferId: string;
    event: 'completed' | 'failed';
    data: Record<string, any>;
  }) {
    return this.financeEventsQueue.add('transfer-event', params, {
      priority: 1,
    });
  }

  // ── Analytics Events ────────────────────────────────────────────────

  async trackEvent(params: {
    userId: string;
    event: string;
    properties?: Record<string, any>;
  }) {
    return this.analyticsQueue.add('track-event', params, {
      priority: 10, // Low priority — analytics can be delayed
    });
  }

  // ── Queue Health ────────────────────────────────────────────────────

  async getQueueStats() {
    const [notifications, finance, analytics] = await Promise.all([
      this.getQueueInfo(this.notificationsQueue),
      this.getQueueInfo(this.financeEventsQueue),
      this.getQueueInfo(this.analyticsQueue),
    ]);

    return { notifications, finance, analytics };
  }

  private async getQueueInfo(queue: Queue) {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
    ]);

    return { waiting, active, completed, failed, delayed };
  }
}
