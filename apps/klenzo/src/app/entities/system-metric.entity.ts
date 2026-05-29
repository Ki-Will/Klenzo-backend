import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * SystemMetric — periodic aggregate snapshots captured by the MetricAggregator job.
 * The JSON metrics API (/api/admin/metrics) reads the latest rows per metricName.
 */
@Entity({ name: 'system_metrics' })
@Index(['metricName', 'recordedAt'])
export class SystemMetric {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Unique metric identifier.
   * Examples: 'active_users_15m', 'total_requests_1h', 'error_rate_1h',
   *           'audit_events_1h', 'avg_response_ms_1h'
   */
  @Column({ type: 'varchar', length: 128 })
  metricName: string;

  /** Numeric value of the metric. */
  @Column({ type: 'numeric', precision: 18, scale: 4 })
  value: number;

  /** Optional labels / dimensions stored as JSONB (e.g. { period: '1h', route: '/api/auth' }). */
  @Column({ nullable: true, type: 'jsonb' })
  labels: Record<string, string> | null;

  @CreateDateColumn({ type: 'timestamptz' })
  recordedAt: Date;
}
