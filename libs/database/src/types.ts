/**
 * Re-exports all Prisma-generated model types and enums from @prisma/client,
 * plus project-specific opaque type aliases used across the Klenzo backend.
 *
 * Import from '@klenzo/database' rather than '@prisma/client' directly so
 * that downstream code remains decoupled from the ORM internals.
 */

// ── Prisma namespace & utility types ────────────────────────────────────────
export type { Prisma } from '@prisma/client';

// ── Enums ────────────────────────────────────────────────────────────────────
export {
  Role,
  AdminRoleCode,
  TransactionStatus,
  TransactionType,
  TaskStatus,
  NotificationType,
  NotificationCategory,
  HabitFrequency,
  BudgetPeriod,
  TransferType,
  TransferStatus,
  KycTier,
  KycStatus,
  LedgerEntryType,
  LedgerEntryStatus,
  ReconciliationStatus,
  RiskLevel,
  RiskDecision,
  ApprovalStatus,
  ApprovalType,
  ConsentType,
} from '@prisma/client';

// ── Model types (auth schema) ─────────────────────────────────────────────────
export type {
  User,
  KycRecord,
  AdminRole,
  Permission,
  AdminRolePermission,
  AdminUserRole,
  ConsentRecord,
  PolicyVersion,
} from '@prisma/client';

// ── Model types (platform schema) ─────────────────────────────────────────────
export type { FeatureFlag } from '@prisma/client';

// ── Model types (productivity schema) ────────────────────────────────────────
export type { Task } from '@prisma/client';

// ── Model types (habit schema) ────────────────────────────────────────────────
export type { Habit, HabitLog } from '@prisma/client';

// ── Model types (finance schema) ──────────────────────────────────────────────
export type {
  Wallet,
  Transfer,
  PayrollRun,
  PayrollEmployee,
  Group,
  GroupMember,
  Account,
  Budget,
  Transaction,
  LedgerEntry,
  ReconciliationRecord,
  RiskAssessment,
  ApprovalRequest,
} from '@prisma/client';

// ── Model types (notifications schema) ───────────────────────────────────────
export type { Notification } from '@prisma/client';

// ── Model types (public schema) ───────────────────────────────────────────────
export type { AuditLog, SystemMetric, FinanceEvent } from '@prisma/client';

// ── Opaque ID aliases ────────────────────────────────────────────────────────
// Using `string` (UUID) everywhere — these aliases express *intent* and make
// function signatures self-documenting without introducing nominal typing
// complexity.

/** UUID identifying a User row in auth.users */
export type UserId = string;

/** UUID identifying a finance.transactions row */
export type TransactionId = string;

/** UUID identifying a finance.wallets row */
export type WalletId = string;

/** UUID identifying a finance.transfers row */
export type TransferId = string;

/** UUID identifying a finance.accounts row */
export type AccountId = string;

/** UUID identifying a finance.budgets row */
export type BudgetId = string;

/** UUID identifying a finance.groups row */
export type GroupId = string;

/** UUID identifying a habit.habits row */
export type HabitId = string;

/** UUID identifying a productivity.tasks row */
export type TaskId = string;

/** UUID identifying a notifications.notifications row */
export type NotificationId = string;

/** UUID identifying a public.audit_logs row */
export type AuditLogId = string;

/** UUID identifying a finance.payroll_employees row */
export type PayrollEmployeeId = string;

/** UUID identifying a finance.ledger_entries row */
export type LedgerEntryId = string;

/** ISO 8601 date-time string (convenience alias) */
export type ISODateString = string;

/** Decimal value represented as a string (Prisma Decimal serialisation) */
export type DecimalString = string;
