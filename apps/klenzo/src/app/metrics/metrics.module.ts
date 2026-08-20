import { Module } from '@nestjs/common';
import { MetricsService } from './metrics.service';
import { MetricsController } from './metrics.controller';
import { MetricAggregatorJob } from './metric-aggregator.job';

@Module({
  providers: [MetricsService, MetricAggregatorJob],
  controllers: [MetricsController],
  exports: [MetricsService, MetricAggregatorJob],
})
export class MetricsModule {}
