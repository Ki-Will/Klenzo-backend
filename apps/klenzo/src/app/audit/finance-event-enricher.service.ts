import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Service to enrich finance events captured by database triggers
 * with HTTP context (IP address, request path).
 * 
 * The database triggers capture the core event data, but they don't have
 * access to HTTP context. This service updates the events with that information.
 */
@Injectable()
export class FinanceEventEnricherService {
  private readonly logger = new Logger(FinanceEventEnricherService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Enrich the most recent event for a record with HTTP context.
   * Call this after a finance mutation to add IP and request path.
   */
  async enrichRecentEvent(params: {
    tableName: string;
    recordId: string;
    eventType: string;
    ipAddress?: string;
    requestPath?: string;
  }) {
    try {
      // Find the most recent event for this record
      const recentEvent = await this.prisma.financeEvent.findFirst({
        where: {
          tableName: params.tableName,
          recordId: params.recordId,
          eventType: params.eventType,
        },
        orderBy: { createdAt: 'desc' },
      });

      if (recentEvent) {
        await this.prisma.financeEvent.update({
          where: { id: recentEvent.id },
          data: {
            ipAddress: params.ipAddress || null,
            requestPath: params.requestPath || null,
          },
        });
      }
    } catch (err) {
      this.logger.error('Failed to enrich finance event', err);
    }
  }

  /**
   * Enrich multiple events in batch (e.g., after a transfer that affects multiple records).
   */
  async enrichEventsBatch(
    events: Array<{
      tableName: string;
      recordId: string;
      eventType: string;
      ipAddress?: string;
      requestPath?: string;
    }>,
  ) {
    for (const event of events) {
      await this.enrichRecentEvent(event);
    }
  }
}
