import { Module } from '@nestjs/common';
import { AuditLogService } from './audit-log.service';
import { AuditInterceptor } from './audit.interceptor';
import { FinanceEventService } from './finance-event.service';
import { FinanceEventEnricherService } from './finance-event-enricher.service';
import { AuditController } from './audit.controller';
import { AuthModule } from '../auth/auth.module';

/**
 * AuditModule – bundles the audit log service, interceptor, finance event services,
 * and API controller for querying audit events.
 * 
 * - AuditLogService: Application-level audit logging (NestJS interceptor)
 * - AuditInterceptor: Captures HTTP mutations automatically
 * - FinanceEventService: Query database trigger events
 * - FinanceEventEnricherService: Enrich trigger events with HTTP context
 */
@Module({
  imports: [AuthModule],
  controllers: [AuditController],
  providers: [
    AuditLogService,
    AuditInterceptor,
    FinanceEventService,
    FinanceEventEnricherService,
  ],
  exports: [
    AuditLogService,
    AuditInterceptor,
    FinanceEventService,
    FinanceEventEnricherService,
  ],
})
export class AuditModule {}
