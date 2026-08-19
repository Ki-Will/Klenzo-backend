import { Module } from '@nestjs/common';
import { AuditLogService } from './audit-log.service';
import { AuditInterceptor } from './audit.interceptor';

/**
 * AuditModule – bundles the audit log service and interceptor.
 * Import this module in AppModule so the service can be injected wherever needed.
 */
@Module({
  imports: [],
  providers: [AuditLogService, AuditInterceptor],
  exports: [AuditLogService, AuditInterceptor],
})
export class AuditModule {}
