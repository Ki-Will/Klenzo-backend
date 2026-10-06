/**
 * @klenzo/database
 *
 * Cloudflare Workers-compatible Prisma database library with Hyperdrive support.
 *
 * Key exports:
 * - `createPrismaClient` / `getCachedClient` — instantiate the pg-adapter-backed client
 * - `createClientFromHyperdrive` — one-liner for Worker handlers
 * - `withTransaction` / `withIdempotentTransaction` — safe transaction wrappers
 * - `handlePrismaError` / `isPrismaError` — convert Prisma errors to domain errors
 * - `checkDatabaseConnection` — lightweight health probe
 * - All Prisma model types and enums re-exported for convenience
 */

// Client
export { createPrismaClient, getCachedClient } from './client.js';
export type { PrismaClient } from './client.js';

// Hyperdrive
export { createClientFromHyperdrive, getConnectionString } from './hyperdrive.js';
export type { HyperdriveBinding } from './hyperdrive.js';

// Transactions
export {
  withTransaction,
  withIdempotentTransaction,
  clearIdempotencyCache,
} from './transaction.js';

// Errors
export {
  DatabaseError,
  RecordNotFoundError,
  UniqueConstraintError,
  TransactionError,
  handlePrismaError,
  isPrismaError,
} from './errors.js';

// Health
export { checkDatabaseConnection } from './health.js';
export type { DatabaseHealthResult } from './health.js';

// Types — model types, enums, and opaque ID aliases
export type {
  Prisma,
  User,
  KycRecord,
  AdminRole,
  Permission,
  AdminRolePermission,
  AdminUserRole,
  ConsentRecord,
  PolicyVersion,
  FeatureFlag,
  Task,
  Habit,
  HabitLog,
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
  Notification,
  AuditLog,
  SystemMetric,
  FinanceEvent,
  UserId,
  TransactionId,
  WalletId,
  TransferId,
  AccountId,
  BudgetId,
  GroupId,
  HabitId,
  TaskId,
  NotificationId,
  AuditLogId,
  PayrollEmployeeId,
  LedgerEntryId,
  ISODateString,
  DecimalString,
} from './types.js';

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
} from './types.js';
