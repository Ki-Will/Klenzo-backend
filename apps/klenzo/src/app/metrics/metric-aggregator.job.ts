import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { Transaction } from '../entities/transaction.entity';
import { SystemMetric } from '../entities/system-metric.entity';

@Injectable()
export class MetricAggregatorJob implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MetricAggregatorJob.name);
  private intervalId: NodeJS.Timeout | null = null;

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Transaction)
    private readonly transactionRepo: Repository<Transaction>,
    @InjectRepository(SystemMetric)
    private readonly metricRepo: Repository<SystemMetric>,
  ) {}

  onModuleInit() {
    this.logger.log('Starting MetricAggregatorJob (runs every 60 seconds)...');
    // Run immediately on start
    this.aggregateMetrics().catch((err) =>
      this.logger.error('Failed initial metric aggregation', err)
    );

    // Schedule periodic execution
    this.intervalId = setInterval(() => {
      this.aggregateMetrics().catch((err) =>
        this.logger.error('Failed metric aggregation', err)
      );
    }, 60000); // every 60 seconds
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
      const totalUsers = await this.userRepo.count();
      await this.saveMetric('total_users', totalUsers, now);

      // 2. Active Users (logged in within last 15 minutes)
      const fifteenMinsAgo = new Date(now.getTime() - 15 * 60 * 1000);
      const activeUsers = await this.userRepo
        .createQueryBuilder('user')
        .where('user.lastLogin > :date', { date: fifteenMinsAgo })
        .getCount();
      await this.saveMetric('active_users_15m', activeUsers, now);

      // 3. Total Transactions
      const totalTransactions = await this.transactionRepo.count();
      await this.saveMetric('total_transactions', totalTransactions, now);

      // 4. Transaction Volume (Sum of all transaction amounts)
      const sumResult = await this.transactionRepo
        .createQueryBuilder('t')
        .select('SUM(t.amount)', 'sum')
        .getRawOne();
      const transactionVolume = parseFloat(sumResult?.sum || '0');
      await this.saveMetric('transaction_volume', transactionVolume, now);

      // 5. System Health (mocked as 99.9 or stable)
      await this.saveMetric('system_health', 99.9, now);

      this.logger.log('Metric aggregation completed successfully.');
    } catch (error) {
      this.logger.error('Error executing metric aggregation:', error);
    }
  }

  private async saveMetric(name: string, value: number, recordedAt: Date) {
    try {
      const metric = this.metricRepo.create({
        metricName: name,
        value,
        labels: { source: 'MetricAggregatorJob' },
        recordedAt,
      });
      await this.metricRepo.save(metric);
    } catch (err) {
      this.logger.error(`Failed to save metric ${name}:`, err);
    }
  }
}
