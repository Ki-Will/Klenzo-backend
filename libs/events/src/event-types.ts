/**
 * Domain event type constants.
 * Using const enums for zero-cost TypeScript enumerations.
 * Consumers should import these to identify events in queue handlers.
 */

// ─── Auth Events ──────────────────────────────────────────────────────────

export const AuthEventType = {
  USER_REGISTERED: 'auth.user.registered',
  USER_LOGGED_IN: 'auth.user.logged_in',
  USER_LOGGED_OUT: 'auth.user.logged_out',
  USER_PASSWORD_CHANGED: 'auth.user.password_changed',
  USER_PASSWORD_RESET_REQUESTED: 'auth.user.password_reset_requested',
  USER_EMAIL_VERIFIED: 'auth.user.email_verified',
  USER_PROFILE_UPDATED: 'auth.user.profile_updated',
  USER_DEACTIVATED: 'auth.user.deactivated',
  TOKEN_REFRESHED: 'auth.token.refreshed',
  TOKEN_REVOKED: 'auth.token.revoked',
  KYC_SUBMITTED: 'auth.kyc.submitted',
  KYC_APPROVED: 'auth.kyc.approved',
  KYC_REJECTED: 'auth.kyc.rejected',
} as const;

export type AuthEventType = (typeof AuthEventType)[keyof typeof AuthEventType];

// ─── Finance Events ───────────────────────────────────────────────────────

export const FinanceEventType = {
  WALLET_CREATED: 'finance.wallet.created',
  WALLET_CREDITED: 'finance.wallet.credited',
  WALLET_DEBITED: 'finance.wallet.debited',
  WALLET_SUSPENDED: 'finance.wallet.suspended',
  TRANSACTION_CREATED: 'finance.transaction.created',
  TRANSACTION_COMPLETED: 'finance.transaction.completed',
  TRANSACTION_FAILED: 'finance.transaction.failed',
  TRANSACTION_REVERSED: 'finance.transaction.reversed',
  TRANSFER_INITIATED: 'finance.transfer.initiated',
  TRANSFER_COMPLETED: 'finance.transfer.completed',
  TRANSFER_FAILED: 'finance.transfer.failed',
  ACCOUNT_CREATED: 'finance.account.created',
  BUDGET_CREATED: 'finance.budget.created',
  BUDGET_LIMIT_APPROACHING: 'finance.budget.limit_approaching',
  BUDGET_EXCEEDED: 'finance.budget.exceeded',
  PAYROLL_RUN_CREATED: 'finance.payroll.run_created',
  PAYROLL_RUN_COMPLETED: 'finance.payroll.run_completed',
  ANOMALY_DETECTED: 'finance.anomaly.detected',
} as const;

export type FinanceEventType = (typeof FinanceEventType)[keyof typeof FinanceEventType];

// ─── Habit Events ─────────────────────────────────────────────────────────

export const HabitEventType = {
  HABIT_CREATED: 'habit.created',
  HABIT_UPDATED: 'habit.updated',
  HABIT_DELETED: 'habit.deleted',
  HABIT_COMPLETED: 'habit.completed',
  HABIT_SKIPPED: 'habit.skipped',
  STREAK_STARTED: 'habit.streak.started',
  STREAK_EXTENDED: 'habit.streak.extended',
  STREAK_BROKEN: 'habit.streak.broken',
  STREAK_MILESTONE: 'habit.streak.milestone', // e.g. 7, 30, 100 days
} as const;

export type HabitEventType = (typeof HabitEventType)[keyof typeof HabitEventType];

// ─── Productivity Events ──────────────────────────────────────────────────

export const ProductivityEventType = {
  TASK_CREATED: 'productivity.task.created',
  TASK_UPDATED: 'productivity.task.updated',
  TASK_COMPLETED: 'productivity.task.completed',
  TASK_CANCELLED: 'productivity.task.cancelled',
  TASK_OVERDUE: 'productivity.task.overdue',
} as const;

export type ProductivityEventType =
  (typeof ProductivityEventType)[keyof typeof ProductivityEventType];

// ─── Notification Events ──────────────────────────────────────────────────

export const NotificationEventType = {
  NOTIFICATION_CREATED: 'notification.created',
  NOTIFICATION_SENT: 'notification.sent',
  NOTIFICATION_DELIVERED: 'notification.delivered',
  NOTIFICATION_FAILED: 'notification.failed',
  NOTIFICATION_READ: 'notification.read',
  DEVICE_TOKEN_REGISTERED: 'notification.device.registered',
  DEVICE_TOKEN_UNREGISTERED: 'notification.device.unregistered',
} as const;

export type NotificationEventType =
  (typeof NotificationEventType)[keyof typeof NotificationEventType];

// ─── Platform Events ──────────────────────────────────────────────────────

export const PlatformEventType = {
  FEATURE_FLAG_CHANGED: 'platform.feature_flag.changed',
  SYSTEM_MAINTENANCE: 'platform.system.maintenance',
  AUDIT_LOG_CREATED: 'platform.audit.created',
} as const;

export type PlatformEventType = (typeof PlatformEventType)[keyof typeof PlatformEventType];

// ─── All Events Union ─────────────────────────────────────────────────────

export type DomainEventType =
  | AuthEventType
  | FinanceEventType
  | HabitEventType
  | ProductivityEventType
  | NotificationEventType
  | PlatformEventType;
