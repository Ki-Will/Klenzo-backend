import { Module } from '@nestjs/common';
import { FinanceController } from './finance.controller';
import { FinanceService } from './finance.service';
import { LedgerService } from './ledger.service';
import { NotificationModule } from '../notification/notification.module';
import { InsightService } from '../insight/insight.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [NotificationModule, PrismaModule],
  controllers: [FinanceController],
  providers: [FinanceService, LedgerService, InsightService],
  exports: [LedgerService],
})
export class FinanceModule {}
