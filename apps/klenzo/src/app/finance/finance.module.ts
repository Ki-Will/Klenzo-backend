import { Module } from '@nestjs/common';
import { FinanceController } from './finance.controller';
import { FinanceService } from './finance.service';
import { NotificationModule } from '../notification/notification.module';
import { InsightService } from '../insight/insight.service';

@Module({
  imports: [NotificationModule],
  controllers: [FinanceController],
  providers: [FinanceService, InsightService],
})
export class FinanceModule {}
