import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import * as crypto from 'crypto';

export interface FlagContext {
  userId?: string;
  userRole?: string;
  country?: string;
}

const CACHE_PREFIX = 'flag:';
const CACHE_TTL = 60; // seconds

// Deterministic hash: same userId always produces same 0-99
function hashUserId(userId: string): number {
  const hash = crypto.createHash('sha256').update(userId).digest('hex');
  return parseInt(hash.substring(0, 8), 16) % 100;
}

@Injectable()
export class FeatureFlagService {
  private readonly logger = new Logger(FeatureFlagService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  // ─── Evaluation ─────────────────────────────────────────────────────────

  /**
   * Check if a feature flag is enabled for the given context.
   * Returns false if the flag doesn't exist or is disabled.
   */
  async isEnabled(flagName: string, context: FlagContext = {}): Promise<boolean> {
    try {
      const flag = await this.getFlag(flagName);
      if (!flag || !flag.isEnabled) return false;

      // Country check
      if (flag.allowedCountries?.length && context.country) {
        if (!flag.allowedCountries.includes(context.country)) return false;
      }

      // Role check (if any role matches, return true)
      if (flag.allowedRoles?.length && context.userRole) {
        if (flag.allowedRoles.includes(context.userRole)) return true;
      }

      // Whitelist check
      if (flag.allowedUsers?.length && context.userId) {
        if (flag.allowedUsers.includes(context.userId)) return true;
      }

      // Percentage rollout
      if (flag.rolloutPercent > 0 && flag.rolloutPercent < 100 && context.userId) {
        return hashUserId(context.userId) < flag.rolloutPercent;
      }

      return flag.rolloutPercent === 100;
    } catch {
      return false;
    }
  }

  /**
   * Check multiple flags at once.
   */
  async getManyFlags(
    names: string[],
    context: FlagContext = {},
  ): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};
    for (const name of names) {
      results[name] = await this.isEnabled(name, context);
    }
    return results;
  }

  // ─── Cache Management ───────────────────────────────────────────────────

  private async getFlag(name: string) {
    // Try Redis cache first
    const cached = await this.redis.get<string>(`${CACHE_PREFIX}${name}`);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch {
        // Cache corruption — reload from DB
      }
    }

    // Load from database
    const flag = await this.prisma.featureFlag.findUnique({ where: { name } });
    if (flag) {
      await this.redis.set(
        `${CACHE_PREFIX}${name}`,
        JSON.stringify(flag),
        CACHE_TTL,
      );
    }
    return flag;
  }

  async invalidateCache(name: string): Promise<void> {
    await this.redis.del(`${CACHE_PREFIX}${name}`);
  }

  async invalidateAllCache(): Promise<void> {
    const flags = await this.prisma.featureFlag.findMany();
    for (const flag of flags) {
      await this.invalidateCache(flag.name);
    }
  }

  // ─── Admin CRUD ─────────────────────────────────────────────────────────

  async getAllFlags() {
    return this.prisma.featureFlag.findMany({
      orderBy: { name: 'asc' },
    });
  }

  async getFlagByName(name: string) {
    const flag = await this.prisma.featureFlag.findUnique({ where: { name } });
    if (!flag) throw new NotFoundException(`Feature flag "${name}" not found`);
    return flag;
  }

  async createFlag(dto: {
    name: string;
    description?: string;
    isEnabled?: boolean;
    rolloutPercent?: number;
    allowedUsers?: string[];
    allowedRoles?: string[];
    allowedCountries?: string[];
    createdBy?: string;
  }) {
    const flag = await this.prisma.featureFlag.create({
      data: {
        name: dto.name,
        description: dto.description,
        isEnabled: dto.isEnabled ?? false,
        rolloutPercent: dto.rolloutPercent ?? 0,
        allowedUsers: dto.allowedUsers ?? [],
        allowedRoles: dto.allowedRoles ?? [],
        allowedCountries: dto.allowedCountries ?? [],
        createdById: dto.createdBy,
        updatedById: dto.createdBy,
      },
    });

    this.logger.log(`Feature flag created: ${flag.name}`);
    return flag;
  }

  async updateFlag(
    name: string,
    dto: {
      description?: string;
      isEnabled?: boolean;
      rolloutPercent?: number;
      allowedUsers?: string[];
      allowedRoles?: string[];
      allowedCountries?: string[];
      updatedBy?: string;
    },
  ) {
    const existing = await this.prisma.featureFlag.findUnique({ where: { name } });
    if (!existing) throw new NotFoundException(`Feature flag "${name}" not found`);

    const flag = await this.prisma.featureFlag.update({
      where: { name },
      data: {
        ...dto,
        updatedById: dto.updatedBy,
      },
    });

    await this.invalidateCache(name);
    this.logger.log(`Feature flag updated: ${name}`);
    return flag;
  }

  async deleteFlag(name: string) {
    const existing = await this.prisma.featureFlag.findUnique({ where: { name } });
    if (!existing) throw new NotFoundException(`Feature flag "${name}" not found`);

    await this.prisma.featureFlag.delete({ where: { name } });
    await this.invalidateCache(name);
    this.logger.log(`Feature flag deleted: ${name}`);
    return { success: true };
  }

  // ─── Seed Default Flags ─────────────────────────────────────────────────

  async seedDefaults() {
    const defaults = [
      { name: 'payroll_module', description: 'Enables the payroll feature for organizations', isEnabled: false },
      { name: 'mtn_integration', description: 'Enables MTN mobile money deposits/withdrawals', isEnabled: false },
      { name: 'airtel_integration', description: 'Enables Airtel mobile money', isEnabled: false },
      { name: 'enhanced_kyc', description: 'Enables enhanced KYC tier', isEnabled: false },
      { name: 'fraud_challenge_flow', description: 'Enables OTP challenge for high-risk transactions', isEnabled: true },
      { name: 'new_transfer_ui', description: 'New Flutter transfer screen (A/B test)', isEnabled: false },
      { name: 'analytics_dashboard', description: 'Advanced analytics for organizations', isEnabled: false },
      { name: 'bulk_transfers', description: 'Organization bulk payment feature', isEnabled: false },
      { name: 'international_transfers', description: 'Cross-border EAC transfers', isEnabled: false },
    ];

    let created = 0;
    for (const flag of defaults) {
      const existing = await this.prisma.featureFlag.findUnique({ where: { name: flag.name } });
      if (!existing) {
        await this.prisma.featureFlag.create({ data: flag });
        created++;
      }
    }

    return { message: `Seeded ${created} feature flags (${defaults.length - created} already existed)` };
  }
}
