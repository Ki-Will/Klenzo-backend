import { Injectable, Logger } from '@nestjs/common';
import * as webpush from 'web-push';

/**
 * Push notification service for browser push notifications.
 * Uses Web Push API / FCM for browser notifications.
 *
 * Setup:
 * 1. Generate VAPID keys: npx web-push generate-vapid-keys
 * 2. Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY in environment
 */
export interface PushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

@Injectable()
export class PushNotificationService {
  private readonly logger = new Logger(PushNotificationService.name);
  private vapidPublicKey: string;
  private vapidPrivateKey: string;

  constructor() {
    this.vapidPublicKey = process.env.VAPID_PUBLIC_KEY || '';
    this.vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || '';

    if (this.vapidPublicKey && this.vapidPrivateKey) {
      webpush.setVapidDetails(
        'mailto:admin@klenzoo.com',
        this.vapidPublicKey,
        this.vapidPrivateKey,
      );
      this.logger.log('Push notifications configured');
    } else {
      this.logger.warn(
        'VAPID keys not set. Push notifications disabled.',
      );
    }
  }

  /**
   * Send a push notification to a subscription.
   */
  async sendPushNotification(
    subscription: PushSubscription,
    payload: {
      title: string;
      body: string;
      icon?: string;
      badge?: string;
      data?: Record<string, any>;
    },
  ) {
    if (!this.vapidPublicKey) {
      this.logger.warn('Push notifications not configured');
      return { sent: false };
    }

    try {
      await webpush.sendNotification(
        subscription,
        JSON.stringify(payload),
      );
      return { sent: true };
    } catch (err) {
      this.logger.error('Push notification failed', err);
      return { sent: false, error: (err as Error).message };
    }
  }

  /**
   * Send push notification to multiple subscriptions.
   */
  async sendBulkPushNotification(
    subscriptions: PushSubscription[],
    payload: {
      title: string;
      body: string;
      icon?: string;
      data?: Record<string, any>;
    },
  ) {
    const results = await Promise.allSettled(
      subscriptions.map((sub) => this.sendPushNotification(sub, payload)),
    );

    return {
      sent: results.filter((r) => r.status === 'fulfilled').length,
      failed: results.filter((r) => r.status === 'rejected').length,
    };
  }

  /**
   * Get VAPID public key for client-side subscription.
   */
  getVapidPublicKey() {
    return this.vapidPublicKey;
  }
}
