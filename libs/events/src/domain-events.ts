/**
 * Typed domain event interfaces.
 * Each event carries a strongly-typed payload so consumers have
 * full type safety without a code-gen step.
 */

import type {
  AuthEventType,
  FinanceEventType,
  HabitEventType,
  ProductivityEventType,
  DomainEventType,
} from './event-types';

// ─── Base ─────────────────────────────────────────────────────────────────

export interface BaseDomainEvent<T extends DomainEventType, P extends object = Record<string, unknown>> {
  /** Unique event ID (crypto.randomUUID()) */
  eventId: string;
  /** Discriminator type string */
  type: T;
  /** Event creation timestamp in ISO 8601 */
  occurredAt: string;
  /** Service that emitted this event */
  source: string;
  /** Distributed trace correlation ID */
  traceId?: string;
  /** Schema version for forward-compat */
  version: number;
  /** Event payload */
  payload: P;
}

// ─── Auth Events ──────────────────────────────────────────────────────────

export interface UserRegisteredEvent
  extends BaseDomainEvent<
    typeof AuthEventType.USER_REGISTERED,
    {
      userId: string;
      email: string;
      firstName: string;
      lastName: string;
      registrationMethod: 'EMAIL' | 'GOOGLE' | 'APPLE';
    }
  > {}

export interface UserLoggedInEvent
  extends BaseDomainEvent<
    typeof AuthEventType.USER_LOGGED_IN,
    {
      userId: string;
      email: string;
      ipAddress?: string;
      userAgent?: string;
      sessionId?: string;
    }
  > {}

export interface UserPasswordChangedEvent
  extends BaseDomainEvent<
    typeof AuthEventType.USER_PASSWORD_CHANGED,
    {
      userId: string;
      email: string;
      initiatedBy: 'USER' | 'ADMIN' | 'RESET';
    }
  > {}

export interface KycApprovedEvent
  extends BaseDomainEvent<
    typeof AuthEventType.KYC_APPROVED,
    {
      userId: string;
      kycRecordId: string;
      approvedAt: string;
      approvedBy: string;
      documentType: string;
    }
  > {}

// ─── Finance Events ───────────────────────────────────────────────────────

export interface TransactionCreatedEvent
  extends BaseDomainEvent<
    typeof FinanceEventType.TRANSACTION_CREATED,
    {
      transactionId: string;
      walletId: string;
      userId: string;
      type: 'CREDIT' | 'DEBIT' | 'TRANSFER' | 'PAYROLL' | 'FEE' | 'REFUND';
      amount: string;
      currency: string;
      reference: string;
      idempotencyKey?: string;
    }
  > {}

export interface TransactionCompletedEvent
  extends BaseDomainEvent<
    typeof FinanceEventType.TRANSACTION_COMPLETED,
    {
      transactionId: string;
      walletId: string;
      userId: string;
      amount: string;
      currency: string;
      newBalance: string;
    }
  > {}

export interface TransactionFailedEvent
  extends BaseDomainEvent<
    typeof FinanceEventType.TRANSACTION_FAILED,
    {
      transactionId: string;
      walletId: string;
      userId: string;
      amount: string;
      currency: string;
      reason: string;
      errorCode?: string;
    }
  > {}

export interface TransferCompletedEvent
  extends BaseDomainEvent<
    typeof FinanceEventType.TRANSFER_COMPLETED,
    {
      transferId: string;
      fromWalletId: string;
      toWalletId: string;
      amount: string;
      currency: string;
      debitTransactionId: string;
      creditTransactionId: string;
    }
  > {}

export interface BudgetExceededEvent
  extends BaseDomainEvent<
    typeof FinanceEventType.BUDGET_EXCEEDED,
    {
      budgetId: string;
      userId: string;
      budgetName: string;
      limitAmount: string;
      currentSpent: string;
      currency: string;
    }
  > {}

// ─── Habit Events ─────────────────────────────────────────────────────────

export interface HabitCompletedEvent
  extends BaseDomainEvent<
    typeof HabitEventType.HABIT_COMPLETED,
    {
      habitId: string;
      userId: string;
      habitName: string;
      logId: string;
      completedAt: string;
      currentStreak: number;
    }
  > {}

export interface StreakBrokenEvent
  extends BaseDomainEvent<
    typeof HabitEventType.STREAK_BROKEN,
    {
      habitId: string;
      userId: string;
      habitName: string;
      brokenStreak: number;
      lastCompletionDate: string;
      missedDate: string;
    }
  > {}

export interface StreakMilestoneEvent
  extends BaseDomainEvent<
    typeof HabitEventType.STREAK_MILESTONE,
    {
      habitId: string;
      userId: string;
      habitName: string;
      streak: number;
      milestone: 7 | 14 | 21 | 30 | 60 | 90 | 100 | 365;
    }
  > {}

// ─── Productivity Events ──────────────────────────────────────────────────

export interface TaskCompletedEvent
  extends BaseDomainEvent<
    typeof ProductivityEventType.TASK_COMPLETED,
    {
      taskId: string;
      userId: string;
      title: string;
      completedAt: string;
      dueDate?: string;
      wasOverdue: boolean;
      actualMinutes?: number;
      estimatedMinutes?: number;
    }
  > {}

export interface TaskOverdueEvent
  extends BaseDomainEvent<
    typeof ProductivityEventType.TASK_OVERDUE,
    {
      taskId: string;
      userId: string;
      title: string;
      dueDate: string;
      priority: string;
      daysOverdue: number;
    }
  > {}

// ─── Union Types ─────────────────────────────────────────────────────────────

export type AuthDomainEvent =
  | UserRegisteredEvent
  | UserLoggedInEvent
  | UserPasswordChangedEvent
  | KycApprovedEvent;

export type FinanceDomainEvent =
  | TransactionCreatedEvent
  | TransactionCompletedEvent
  | TransactionFailedEvent
  | TransferCompletedEvent
  | BudgetExceededEvent;

export type HabitDomainEvent =
  | HabitCompletedEvent
  | StreakBrokenEvent
  | StreakMilestoneEvent;

export type ProductivityDomainEvent =
  | TaskCompletedEvent
  | TaskOverdueEvent;

export type DomainEvent =
  | AuthDomainEvent
  | FinanceDomainEvent
  | HabitDomainEvent
  | ProductivityDomainEvent;
