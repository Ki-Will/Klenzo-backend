import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as crypto from 'crypto';

export interface AuditLogEntry {
  actorId?: string;
  actorRole: string;
  action: string;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  requestPath?: string;
  result?: 'SUCCESS' | 'FAILED' | 'DENIED';
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── Core Logging ────────────────────────────────────────────────────────

  /**
   * Create an audit log entry with tamper-detection checksum.
   * Each entry's checksum chains to the previous, forming an integrity chain.
   */
  async log(entry: AuditLogEntry): Promise<void> {
    try {
      // Get the last audit log's checksum to chain
      const lastLog = await this.prisma.auditLog.findFirst({
        orderBy: { createdAt: 'desc' },
        select: { checksum: true },
      });

      const previousChecksum = lastLog?.checksum ?? null;

      // Generate checksum from the entry data (without id/timestamp since they're generated)
      const checksum = this.generateChecksum({
        actorId: entry.actorId,
        actorRole: entry.actorRole,
        action: entry.action,
        targetType: entry.targetType,
        targetId: entry.targetId,
        metadata: entry.metadata,
        result: entry.result ?? 'SUCCESS',
        previousChecksum,
      });

      await this.prisma.auditLog.create({
        data: {
          actorId: entry.actorId,
          actorRole: entry.actorRole,
          action: entry.action,
          targetType: entry.targetType,
          targetId: entry.targetId,
          metadata: entry.metadata ?? undefined,
          ipAddress: entry.ipAddress,
          requestPath: entry.requestPath,
          result: entry.result ?? 'SUCCESS',
          checksum,
          previousChecksum,
        },
      });
    } catch (error) {
      // Audit logging must never crash the application
      this.logger.error(`Failed to create audit log: ${error}`);
    }
  }

  /**
   * Log with automatic actor resolution from a NestJS request context.
   */
  async logFromRequest(
    req: { user?: { id: string; role?: string }; ip?: string; path?: string },
    action: string,
    options?: {
      targetType?: string;
      targetId?: string;
      metadata?: Record<string, unknown>;
      result?: 'SUCCESS' | 'FAILED' | 'DENIED';
    },
  ): Promise<void> {
    await this.log({
      actorId: req.user?.id,
      actorRole: req.user?.role ?? 'unknown',
      action,
      targetType: options?.targetType,
      targetId: options?.targetId,
      metadata: options?.metadata,
      ipAddress: req.ip,
      requestPath: req.path,
      result: options?.result,
    });
  }

  // ─── Tamper Detection ────────────────────────────────────────────────────

  /**
   * Verify the integrity of a single audit log entry.
   * Returns true if the checksum is valid and unaltered.
   */
  async verifyEntry(auditLogId: string): Promise<boolean> {
    const entry = await this.prisma.auditLog.findUnique({
      where: { id: auditLogId },
    });

    if (!entry) return false;

    const expectedChecksum = this.generateChecksum({
      actorId: entry.actorId,
      actorRole: entry.actorRole,
      action: entry.action,
      targetType: entry.targetType,
      targetId: entry.targetId,
      metadata: entry.metadata as Record<string, unknown> | undefined,
      result: entry.result,
      previousChecksum: entry.previousChecksum,
    });

    return entry.checksum === expectedChecksum;
  }

  /**
   * Verify the integrity of the entire audit chain.
   * Returns { valid, brokenAt } — brokenAt is the first entry that fails verification.
   */
  async verifyChain(): Promise<{ valid: boolean; brokenAt?: string; totalChecked: number }> {
    const logs = await this.prisma.auditLog.findMany({
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        actorId: true,
        actorRole: true,
        action: true,
        targetType: true,
        targetId: true,
        metadata: true,
        result: true,
        checksum: true,
        previousChecksum: true,
      },
    });

    let previousChecksum: string | null = null;

    for (const log of logs) {
      // Verify chain linkage
      if (log.previousChecksum !== previousChecksum) {
        return { valid: false, brokenAt: log.id, totalChecked: 0 };
      }

      // Verify checksum
      const expectedChecksum = this.generateChecksum({
        actorId: log.actorId,
        actorRole: log.actorRole,
        action: log.action,
        targetType: log.targetType,
        targetId: log.targetId,
        metadata: log.metadata as Record<string, unknown> | undefined,
        result: log.result,
        previousChecksum: log.previousChecksum,
      });

      if (log.checksum !== expectedChecksum) {
        return { valid: false, brokenAt: log.id, totalChecked: 0 };
      }

      previousChecksum = log.checksum;
    }

    return { valid: true, totalChecked: logs.length };
  }

  // ─── Query Helpers ───────────────────────────────────────────────────────

  async getRecentLogs(options?: {
    limit?: number;
    offset?: number;
    action?: string;
    actorRole?: string;
    result?: string;
    targetType?: string;
    targetId?: string;
    startDate?: Date;
    endDate?: Date;
  }) {
    const where: Record<string, unknown> = {};

    if (options?.action) where.action = options.action;
    if (options?.actorRole) where.actorRole = options.actorRole;
    if (options?.result) where.result = options.result;
    if (options?.targetType) where.targetType = options.targetType;
    if (options?.targetId) where.targetId = options.targetId;
    if (options?.startDate || options?.endDate) {
      where.createdAt = {
        ...(options.startDate && { gte: options.startDate }),
        ...(options.endDate && { lte: options.endDate }),
      };
    }

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: options?.limit ?? 50,
        skip: options?.offset ?? 0,
        include: { actor: { select: { id: true, name: true, email: true } } },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { logs, total, limit: options?.limit ?? 50, offset: options?.offset ?? 0 };
  }

  async getLogsByActor(actorId: string, limit = 50) {
    return this.prisma.auditLog.findMany({
      where: { actorId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async getLogsByTarget(targetType: string, targetId: string) {
    return this.prisma.auditLog.findMany({
      where: { targetType, targetId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getAuditStats() {
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [total, last24hCount, last7dCount, byAction, byResult, byRole] =
      await Promise.all([
        this.prisma.auditLog.count(),
        this.prisma.auditLog.count({ where: { createdAt: { gte: last24h } } }),
        this.prisma.auditLog.count({ where: { createdAt: { gte: last7d } } }),
        this.prisma.auditLog.groupBy({
          by: ['action'],
          _count: { id: true },
          orderBy: { _count: { id: 'desc' } },
          take: 10,
        }),
        this.prisma.auditLog.groupBy({
          by: ['result'],
          _count: { id: true },
        }),
        this.prisma.auditLog.groupBy({
          by: ['actorRole'],
          _count: { id: true },
          orderBy: { _count: { id: 'desc' } },
        }),
      ]);

    return {
      total,
      last24h: last24hCount,
      last7d: last7dCount,
      byAction: byAction.map((a) => ({ action: a.action, count: a._count.id })),
      byResult: byResult.map((r) => ({ result: r.result, count: r._count.id })),
      byRole: byRole.map((r) => ({ role: r.actorRole, count: r._count.id })),
    };
  }

  // ─── Checksum Helpers ────────────────────────────────────────────────────

  private generateChecksum(data: {
    actorId?: string | null;
    actorRole: string;
    action: string;
    targetType?: string | null;
    targetId?: string | null;
    metadata?: Record<string, unknown> | null;
    result: string;
    previousChecksum?: string | null;
  }): string {
    const payload = JSON.stringify({
      actorId: data.actorId,
      actorRole: data.actorRole,
      action: data.action,
      targetType: data.targetType,
      targetId: data.targetId,
      metadata: data.metadata,
      result: data.result,
      previousChecksum: data.previousChecksum,
    });

    return crypto.createHash('sha256').update(payload).digest('hex');
  }
}
