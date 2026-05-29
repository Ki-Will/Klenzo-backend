import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * AuditLog — append-only record of every significant admin / system action.
 *
 * Written by:
 *  1. The NestJS AuditLogService (via HTTP middleware / service calls)
 *  2. PostgreSQL triggers on critical tables (users, notifications)
 */
@Entity({ name: 'audit_logs' })
@Index(['actorId'])
@Index(['action'])
@Index(['createdAt'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** User or admin who triggered the action (null = system). */
  @Column({ nullable: true, type: 'int' })
  actorId: number | null;

  /** Role of the actor at the time of the action. */
  @Column({ type: 'varchar', length: 32 })
  actorRole: string; // 'user' | 'admin' | 'superadmin' | 'system'

  /**
   * Dot-namespaced action identifier.
   * Examples: 'admin.broadcast.created', 'user.login.failed', 'system.metric.snapshot'
   */
  @Column({ type: 'varchar', length: 128 })
  action: string;

  /** The type of entity this action targeted (e.g. 'broadcast', 'user'). */
  @Column({ nullable: true, type: 'varchar', length: 64 })
  targetType: string | null;

  /** Primary key of the targeted entity (stored as text to support both int and uuid PKs). */
  @Column({ nullable: true, type: 'varchar', length: 64 })
  targetId: string | null;

  /** Arbitrary JSON payload — before/after values, diffs, query params, etc. */
  @Column({ nullable: true, type: 'jsonb' })
  metadata: Record<string, unknown> | null;

  /** Client IP address. Uses inet-compatible varchar so it works with both IPv4 and IPv6. */
  @Column({ nullable: true, type: 'varchar', length: 45 })
  ipAddress: string | null;

  /** Request path that triggered the action (optional). */
  @Column({ nullable: true, type: 'varchar', length: 512 })
  requestPath: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
