import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as crypto from 'crypto';

/**
 * Service used by controllers / guards to persist audit entries.
 * All calls are fire-and-forget – errors are logged but never disrupt the main flow.
 * Now includes SHA-256 tamper detection with chain hashing.
 */
@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(entry: {
    actorId?: string | null;
    actorRole: string;
    action: string;
    targetType?: string | null;
    targetId?: string | null;
    metadata?: any;
    ipAddress?: string | null;
    requestPath?: string | null;
  }) {
    try {
      // Get the last audit log's checksum to chain
      const lastLog = await this.prisma.auditLog.findFirst({
        orderBy: { createdAt: 'desc' },
        select: { checksum: true },
      });

      const previousChecksum = lastLog?.checksum ?? null;

      // Generate checksum for tamper detection
      const checksum = this.generateChecksum({
        actorId: entry.actorId,
        actorRole: entry.actorRole,
        action: entry.action,
        targetType: entry.targetType,
        targetId: entry.targetId,
        metadata: entry.metadata,
        previousChecksum,
      });

      await this.prisma.auditLog.create({
        data: {
          actorId: entry.actorId ?? null,
          actorRole: entry.actorRole,
          action: entry.action,
          targetType: entry.targetType ?? null,
          targetId: entry.targetId ?? null,
          metadata: entry.metadata ?? null,
          ipAddress: entry.ipAddress ?? null,
          requestPath: entry.requestPath ?? null,
          result: 'SUCCESS',
          checksum,
          previousChecksum,
        },
      });
    } catch (err) {
      // Swallow errors to avoid breaking the request pipeline, but record to console.
      this.logger.error('Failed to write audit log', err);
    }
  }

  private generateChecksum(data: {
    actorId?: string | null;
    actorRole: string;
    action: string;
    targetType?: string | null;
    targetId?: string | null;
    metadata?: unknown;
    previousChecksum?: string | null;
  }): string {
    const payload = JSON.stringify({
      actorId: data.actorId,
      actorRole: data.actorRole,
      action: data.action,
      targetType: data.targetType,
      targetId: data.targetId,
      metadata: data.metadata,
      previousChecksum: data.previousChecksum,
    });

    return crypto.createHash('sha256').update(payload).digest('hex');
  }
}
