import { z } from 'zod';
import { CurrencySchema, DecimalAmountSchema, UuidSchema } from './common';

// ─── Shared ────────────────────────────────────────────────────────────────

const TransactionTypeSchema = z.enum(['CREDIT', 'DEBIT', 'TRANSFER', 'PAYROLL', 'FEE', 'REFUND']);
const AccountTypeSchema = z.enum(['CHECKING', 'SAVINGS', 'WALLET', 'PAYROLL', 'ESCROW']);
const BudgetPeriodSchema = z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY']);

// ─── Create Transaction ─────────────────────────────────────────────────────

export const CreateTransactionSchema = z.object({
  walletId: UuidSchema,
  accountId: UuidSchema.optional(),
  type: TransactionTypeSchema,
  amount: DecimalAmountSchema,
  currency: CurrencySchema,
  description: z.string().max(500, 'Description too long').optional(),
  reference: z.string().max(255).optional(),
  metadata: z.record(z.unknown()).optional(),
  idempotencyKey: z.string().uuid().optional(),
});

export type CreateTransactionInput = z.infer<typeof CreateTransactionSchema>;

// ─── Create Account ─────────────────────────────────────────────────────────

export const CreateAccountSchema = z.object({
  type: AccountTypeSchema,
  name: z.string().trim().min(1, 'Account name is required').max(120, 'Name too long'),
  currency: CurrencySchema,
  initialBalance: DecimalAmountSchema.optional(),
});

export type CreateAccountInput = z.infer<typeof CreateAccountSchema>;

// ─── Create Budget ───────────────────────────────────────────────────────────

export const CreateBudgetSchema = z.object({
  name: z.string().trim().min(1, 'Budget name is required').max(120, 'Name too long'),
  amount: DecimalAmountSchema,
  currency: CurrencySchema,
  period: BudgetPeriodSchema,
  startDate: z.string().datetime({ message: 'startDate must be ISO 8601' }),
  endDate: z.string().datetime({ message: 'endDate must be ISO 8601' }).optional(),
  categoryIds: z.array(UuidSchema).max(20).optional(),
}).refine(
  (data) => !data.endDate || new Date(data.startDate) <= new Date(data.endDate),
  { message: 'startDate must be before endDate', path: ['startDate'] },
);

export type CreateBudgetInput = z.infer<typeof CreateBudgetSchema>;

// ─── Create Wallet ───────────────────────────────────────────────────────────

export const CreateWalletSchema = z.object({
  currency: CurrencySchema,
  initialBalance: DecimalAmountSchema.optional(),
});

export type CreateWalletInput = z.infer<typeof CreateWalletSchema>;

// ─── Create Transfer ─────────────────────────────────────────────────────────

export const CreateTransferSchema = z
  .object({
    fromWalletId: UuidSchema,
    toWalletId: UuidSchema,
    amount: DecimalAmountSchema,
    currency: CurrencySchema,
    description: z.string().max(500).optional(),
    idempotencyKey: z.string().uuid().optional(),
  })
  .refine((data) => data.fromWalletId !== data.toWalletId, {
    message: 'Cannot transfer to the same wallet',
    path: ['toWalletId'],
  });

export type CreateTransferInput = z.infer<typeof CreateTransferSchema>;
