import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MetricAggregatorJob implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MetricAggregatorJob.name);
  private intervalId: NodeJS.Timeout | null = null;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    this.logger.log('Starting MetricAggregatorJob (runs every 60 seconds)...');
    this.aggregateMetrics().catch((err) =>
      this.logger.error('Failed initial metric aggregation', err)
    );

    this.intervalId = setInterval(() => {
      this.aggregateMetrics().catch((err) =>
        this.logger.error('Failed metric aggregation', err)
      );
    }, 60000);
  }

  onModuleDestroy() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  async aggregateMetrics() {
    this.logger.log('Running metric aggregation...');
    const now = new Date();

    try {
      // 1. Total Users
      const totalUsers = await this.prisma.user.count();
      await this.saveMetric('total_users', totalUsers, now);

      // 2. Active Users (logged in within last 15 minutes)
      const fifteenMinsAgo = new Date(now.getTime() - 15 * 60 * 1000);
      const activeUsers = await this.prisma.user.count({
        where: { lastLogin: { gt: fifteenMinsAgo } },
      });
      await this.saveMetric('active_users_15m', activeUsers, now);

      // 3. Total Transactions
      const totalTransactions = await this.prisma.transaction.count();
      await this.saveMetric('total_transactions', totalTransactions, now);

      // 4. Transaction Volume
      const sumResult = await this.prisma.transaction.aggregate({
        _sum: { amount: true },
      });
      const transactionVolume = Number(sumResult._sum.amount ?? 0);
      await this.saveMetric('transaction_volume', transactionVolume, now);

      // 5. System Health (mocked)
      await this.saveMetric('system_health', 99.9, now);

      this.logger.log('Metric aggregation completed successfully.');
    } catch (error) {
      this.logger.error('Error executing metric aggregation:', error);
    }
  }

  private async saveMetric(name: string, value: number, recordedAt: Date) {
    try {
      await this.prisma.systemMetric.create({
        data: {
          metricName: name,
          value,
          labels: { source: 'MetricAggregatorJob' },
          recordedAt,
        },
      });
    } catch (err) {
      this.logger.error(`Failed to save metric ${name}:`, err);
    }
  }
}
