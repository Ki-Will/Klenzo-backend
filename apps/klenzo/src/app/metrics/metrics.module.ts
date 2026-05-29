import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MetricsService } from './metrics.service';
import { MetricsController } from './metrics.controller';
import { MetricAggregatorJob } from './metric-aggregator.job';
import { User } from '../entities/user.entity';
import { Transaction } from '../entities/transaction.entity';
import { SystemMetric } from '../entities/system-metric.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, Transaction, SystemMetric])],
  providers: [MetricsService, MetricAggregatorJob],
  controllers: [MetricsController],
  exports: [MetricsService, MetricAggregatorJob],
})
export class MetricsModule {}
