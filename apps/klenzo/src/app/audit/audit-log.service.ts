import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Service used by controllers / guards to persist audit entries.
 * All calls are fire‑and‑forget – errors are logged but never disrupt the main flow.
 */
@Injectable()
export class AuditLogService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

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
        },
      });
    } catch (err) {
      // Swallow errors to avoid breaking the request pipeline, but record to console.
      console.error('Failed to write audit log', err);
    }
  }
}
