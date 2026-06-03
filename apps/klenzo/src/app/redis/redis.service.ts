import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis;

  constructor(private readonly config: ConfigService) {}

  // ── TTL constants (seconds) ───────────────────────────────────────────────
  static readonly TTL = {
    BANNERS:       300,   // 5 min  — banners change rarely
    NOTIFICATIONS:  30,   // 30 sec — per-user inbox, refreshes quickly
    USER_PROFILE:  120,   // 2 min  — JWT validation cache
    INSIGHTS:      120,   // 2 min  — dashboard aggregates
  } as const;

  onModuleInit() {
    const host = this.config.get<string>('redis.host') || 'localhost';
    const port = this.config.get<number>('redis.port') || 6379;

    this.client = new Redis({
      host,
      port,
      lazyConnect: true,
      retryStrategy: (times) => {
        if (times > 5) {
          this.logger.warn('Redis unavailable after 5 retries — running without cache');
          return null; // stop retrying
        }
        return Math.min(times * 200, 2000);
      },
    });

    this.client.on('connect',   () => this.logger.log('✅ Redis connected'));
    this.client.on('error',     (err) => this.logger.warn(`Redis error: ${err.message}`));
    this.client.on('reconnecting', () => this.logger.log('Redis reconnecting...'));

    this.client.connect().catch(() => {
      // Non-fatal — app works without Redis, just no caching
    });
  }

  onModuleDestroy() {
    this.client?.disconnect();
  }

  // ── Core helpers ──────────────────────────────────────────────────────────

  /** Get a cached value. Returns null on miss or Redis error. */
  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = await this.client.get(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null; // degrade gracefully
    }
  }

  /** Set a value with a TTL in seconds. Silently ignores Redis errors. */
  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    try {
      await this.client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch {
      // non-fatal
    }
  }

  /** Delete one or more keys. */
  async del(...keys: string[]): Promise<void> {
    try {
      if (keys.length) await this.client.del(...keys);
    } catch {
      // non-fatal
    }
  }

  /** Delete all keys matching a glob pattern (e.g. 'notif:user:*'). */
  async invalidatePattern(pattern: string): Promise<void> {
    try {
      const keys = await this.client.keys(pattern);
      if (keys.length) await this.client.del(...keys);
    } catch {
      // non-fatal
    }
  }

  // ── Typed key builders — keeps key names consistent across the app ────────

  static keys = {
    banners:           ()         => 'banners:active',
    userNotifications: (uid: number) => `notif:user:${uid}`,
    userProfile:       (uid: number) => `user:profile:${uid}`,
    insights:          (uid: number) => `insights:dashboard:${uid}`,
    userSessions:      (uid: number) => `user:sessions:${uid}`,
    transactions:      (uid: number) => `finance:transactions:${uid}`,
  };

  async setEx(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    await this.set(key, value, ttlSeconds);
  }
}
