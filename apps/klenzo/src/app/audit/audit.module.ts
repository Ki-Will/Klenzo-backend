import { Module } from '@nestjs/common';
import { AuditService } from './audit.service';
import { AuditLogService } from './audit-log.service';
import { AuditController } from './audit.controller';
import { AuditInterceptor } from './audit.interceptor';
import { FinanceEventService } from './finance-event.service';
import { FinanceEventEnricherService } from './finance-event-enricher.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { RbacModule } from '../rbac/rbac.module';

@Module({
  imports: [PrismaModule, RbacModule],
  providers: [
    AuditService,
    AuditLogService,
    AuditInterceptor,
    FinanceEventService,
    FinanceEventEnricherService,
  ],
  controllers: [AuditController],
  exports: [
    AuditService,
    AuditLogService,
    AuditInterceptor,
    FinanceEventService,
    FinanceEventEnricherService,
  ],
})
export class AuditModule {}
