import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

/**
 * Feature flags service for gradual rollouts and A/B testing.
 * Flags are stored in Redis for fast access and easy updates.
 *
 * Usage:
 *   if (await featureFlags.isEnabled('new_checkout_flow', userId)) {
 *     // Show new checkout
 *   }
 */
export interface FeatureFlag {
  key: string;
  enabled: boolean;
  percentage: number; // 0-100, percentage of users who see this flag
  allowedUsers?: string[]; // Specific user IDs
  allowedRoles?: string[]; // Specific roles
  metadata?: Record<string, any>;
  expiresAt?: Date;
}

@Injectable()
export class FeatureFlagsService {
  private readonly logger = new Logger(FeatureFlagsService.name);
  private readonly prefix = 'feature_flag:';

  // Default flags — can be overridden in Redis
  private readonly defaultFlags: Record<string, FeatureFlag> = {
    new_checkout_flow: {
      key: 'new_checkout_flow',
      enabled: false,
      percentage: 0,
    },
    advanced_analytics: {
      key: 'advanced_analytics',
      enabled: true,
      percentage: 100,
    },
    beta_features: {
      key: 'beta_features',
      enabled: false,
      percentage: 10,
    },
    webhook_system: {
      key: 'webhook_system',
      enabled: true,
      percentage: 100,
    },
    push_notifications: {
      key: 'push_notifications',
      enabled: false,
      percentage: 0,
    },
  };

  constructor(private readonly redis: RedisService) {}

  /**
   * Check if a feature flag is enabled for a user.
   */
  async isEnabled(
    flagKey: string,
    userId?: string,
    userRole?: string,
  ): Promise<boolean> {
    const flag = await this.getFlag(flagKey);

    if (!flag || !flag.enabled) return false;

    // Check expiration
    if (flag.expiresAt && new Date() > flag.expiresAt) return false;

    // Check specific user
    if (userId && flag.allowedUsers?.includes(userId)) return true;

    // Check role
    if (userRole && flag.allowedRoles?.includes(userRole)) return true;

    // Check percentage rollout
    if (flag.percentage >= 100) return true;
    if (flag.percentage <= 0) return false;

    // Deterministic percentage based on user ID hash
    if (userId) {
      const hash = this.hashString(userId + flagKey);
      return hash % 100 < flag.percentage;
    }

    return false;
  }

  /**
   * Get a feature flag configuration.
   */
  async getFlag(flagKey: string): Promise<FeatureFlag | null> {
    const cached = await this.redis.get<FeatureFlag>(
      `${this.prefix}${flagKey}`,
    );
    if (cached) return cached;

    // Return default if exists
    return this.defaultFlags[flagKey] || null;
  }

  /**
   * Update a feature flag (admin only).
   */
  async updateFlag(flag: Partial<FeatureFlag> & { key: string }) {
    const existing = await this.getFlag(flag.key);
    const updated: FeatureFlag = {
      ...existing,
      ...flag,
    } as FeatureFlag;

    await this.redis.set(`${this.prefix}${flag.key}`, updated, 86400 * 30); // 30 days

    this.logger.log(`Feature flag updated: ${flag.key}`);
    return updated;
  }

  /**
   * List all feature flags.
   */
  async listFlags(): Promise<FeatureFlag[]> {
    const flags: FeatureFlag[] = [];
    for (const key of Object.keys(this.defaultFlags)) {
      const flag = await this.getFlag(key);
      if (flag) flags.push(flag);
    }
    return flags;
  }

  /**
   * Simple deterministic hash for percentage rollouts.
   */
  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }
}
