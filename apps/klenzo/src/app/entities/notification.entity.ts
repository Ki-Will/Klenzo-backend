import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
} from 'typeorm';

export enum NotificationType {
  INFO = 'info',
  SUCCESS = 'success',
  WARNING = 'warning',
  ERROR = 'error',
}

export enum NotificationCategory {
  NOTIFICATION = 'notification',
  BANNER = 'banner',
}

/**
 * Color rules:
 *
 *  - Regular notifications (category = 'notification'):
 *      color is always NULL. The frontend derives the display color
 *      from the `type` field (info=blue, success=green, warning=amber, error=red).
 *
 *  - Banners (category = 'banner'):
 *      color is a hex string set by the admin (e.g. '#6366f1').
 *      Falls back to the platform default '#6366f1' if the admin
 *      doesn't supply one. Never null for banners.
 */
@Entity({ schema: 'notifications', name: 'notifications' })
export class Notification {
  @PrimaryGeneratedColumn()
  id: number;

  /** null = global/broadcast; set = specific user */
  @Column({ nullable: true, type: 'int' })
  userId: number | null;

  @Column({
    type: 'enum',
    enum: NotificationType,
    default: NotificationType.INFO,
  })
  type: NotificationType;

  @Column({
    type: 'enum',
    enum: NotificationCategory,
    default: NotificationCategory.NOTIFICATION,
  })
  category: NotificationCategory;

  @Column()
  title: string;

  @Column({ nullable: true, type: 'text' })
  message: string;

  @Column({ default: false })
  isRead: boolean;

  @Column({ default: false })
  isDismissed: boolean;

  /** true when this record targets all users (userId = null) */
  @Column({ default: false })
  isGlobal: boolean;

  /**
   * Hex color string — ONLY populated for banners.
   * Regular notifications always have null here; the frontend
   * uses `type` to pick the color instead.
   *
   * Examples: '#6366f1', '#ef4444', '#f59e0b'
   */
  @Column({ nullable: true, type: 'varchar', length: 7 })
  color: string | null;

  @Column({ default: 'normal' })
  priority: 'low' | 'normal' | 'high';

  // ─── Banner-only fields ───────────────────────────────────────────────────

  @Column({ default: true })
  dismissible: boolean;

  @Column({ nullable: true, type: 'varchar' })
  link: string | null;

  @Column({ nullable: true, type: 'varchar' })
  linkText: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  startDate: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  endDate: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}
