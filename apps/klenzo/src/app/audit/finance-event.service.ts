import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Service for querying finance events captured by database triggers.
 * These events are immutable and provide a complete audit trail.
 */
@Injectable()
export class FinanceEventService {
  private readonly logger = new Logger(FinanceEventService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get audit trail for a specific record.
   * Useful for debugging or showing transaction history.
   */
  async getRecordAuditTrail(tableName: string, recordId: string) {
    try {
      const events = await this.prisma.financeEvent.findMany({
        where: {
          tableName,
          recordId,
        },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          eventType: true,
          tableName: true,
          recordId: true,
          userId: true,
          oldValues: true,
          newValues: true,
          changedFields: true,
          createdAt: true,
        },
      });

      return events;
    } catch (err) {
      this.logger.error(
        `Failed to get audit trail for ${tableName}:${recordId}`,
        err,
      );
      return [];
    }
  }

  /**
   * Get all finance events for a specific user.
   * Useful for user activity logs or compliance reports.
   */
  async getUserFinanceEvents(userId: string, limit = 100) {
    try {
      const events = await this.prisma.financeEvent.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: {
          id: true,
          eventType: true,
          tableName: true,
          recordId: true,
          oldValues: true,
          newValues: true,
          changedFields: true,
          createdAt: true,
        },
      });

      return events;
    } catch (err) {
      this.logger.error(
        `Failed to get finance events for user ${userId}`,
        err,
      );
      return [];
    }
  }

  /**
   * Get recent finance events across all tables.
   * Useful for admin dashboards or monitoring.
   */
  async getRecentEvents(limit = 50, tableName?: string) {
    try {
      const where = tableName ? { tableName } : {};

      const events = await this.prisma.financeEvent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: {
          id: true,
          eventType: true,
          tableName: true,
          recordId: true,
          userId: true,
          oldValues: true,
          newValues: true,
          changedFields: true,
          createdAt: true,
        },
      });

      return events;
    } catch (err) {
      this.logger.error('Failed to get recent finance events', err);
      return [];
    }
  }

  /**
   * Get event statistics for a given time range.
   * Useful for analytics and monitoring dashboards.
   */
  async getEventStats(startDate: Date, endDate: Date) {
    try {
      const stats = await this.prisma.financeEvent.groupBy({
        by: ['tableName', 'eventType'],
        where: {
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
        _count: {
          id: true,
        },
        orderBy: {
          _count: {
            id: 'desc',
          },
        },
      });

      return stats.map((stat) => ({
        tableName: stat.tableName,
        eventType: stat.eventType,
        count: stat._count.id,
      }));
    } catch (err) {
      this.logger.error('Failed to get event stats', err);
      return [];
    }
  }

  /**
   * Detect suspicious activity patterns.
   * E.g., rapid successive updates to the same record.
   */
  async detectSuspiciousActivity(
    tableName: string,
    recordId: string,
    timeWindowMinutes = 5,
    thresholdCount = 10,
  ) {
    try {
      const cutoff = new Date();
      cutoff.setMinutes(cutoff.getMinutes() - timeWindowMinutes);

      const recentEvents = await this.prisma.financeEvent.count({
        where: {
          tableName,
          recordId,
          createdAt: {
            gte: cutoff,
          },
        },
      });

      return {
        isSuspicious: recentEvents >= thresholdCount,
        recentEventCount: recentEvents,
        threshold: thresholdCount,
        timeWindowMinutes,
      };
    } catch (err) {
      this.logger.error('Failed to detect suspicious activity', err);
      return {
        isSuspicious: false,
        recentEventCount: 0,
        threshold: thresholdCount,
        timeWindowMinutes,
      };
    }
  }
}
