// Finance Service RPC Contracts

export type TransactionType = 'CREDIT' | 'DEBIT' | 'TRANSFER' | 'PAYROLL' | 'FEE' | 'REFUND';
export type TransactionStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'REVERSED';
export type AccountType = 'CHECKING' | 'SAVINGS' | 'WALLET' | 'PAYROLL' | 'ESCROW';
export type Currency = 'USD' | 'EUR' | 'GBP' | 'NGN' | 'GHS' | 'KES' | 'ZAR';

export interface WalletSummary {
  id: string;
  userId: string;
  currency: Currency;
  balance: string; // Decimal as string to avoid precision loss
  availableBalance: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TransactionSummary {
  id: string;
  walletId: string;
  accountId?: string;
  type: TransactionType;
  status: TransactionStatus;
  amount: string;
  currency: Currency;
  description?: string;
  reference: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface AccountSummary {
  id: string;
  userId: string;
  type: AccountType;
  name: string;
  currency: Currency;
  balance: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// Get wallet balance
export interface GetWalletBalanceRequest {
  userId: string;
  currency?: Currency;
}

export interface GetWalletBalanceResponse {
  wallet: WalletSummary;
}

// Create transaction
export interface CreateTransactionRequest {
  walletId: string;
  accountId?: string;
  type: TransactionType;
  amount: string;
  currency: Currency;
  description?: string;
  reference?: string;
  metadata?: Record<string, unknown>;
  idempotencyKey?: string;
}

export interface CreateTransactionResponse {
  transaction: TransactionSummary;
}

// Get transactions
export interface GetTransactionsRequest {
  walletId?: string;
  accountId?: string;
  userId?: string;
  type?: TransactionType;
  status?: TransactionStatus;
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
}

export interface GetTransactionsResponse {
  transactions: TransactionSummary[];
  total: number;
  page: number;
  pageSize: number;
}

// Create account
export interface CreateAccountRequest {
  userId: string;
  type: AccountType;
  name: string;
  currency: Currency;
  initialBalance?: string;
}

export interface CreateAccountResponse {
  account: AccountSummary;
}

// Get user accounts
export interface GetUserAccountsRequest {
  userId: string;
  type?: AccountType;
  isActive?: boolean;
}

export interface GetUserAccountsResponse {
  accounts: AccountSummary[];
}

// Transfer
export interface CreateTransferRequest {
  fromWalletId: string;
  toWalletId: string;
  amount: string;
  currency: Currency;
  description?: string;
  idempotencyKey?: string;
}

export interface CreateTransferResponse {
  transferId: string;
  debitTransaction: TransactionSummary;
  creditTransaction: TransactionSummary;
  status: TransactionStatus;
}

// Budget
export interface BudgetSummary {
  id: string;
  userId: string;
  name: string;
  amount: string;
  currency: Currency;
  spent: string;
  remaining: string;
  period: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
  startDate: string;
  endDate?: string;
  isActive: boolean;
}

export interface CreateBudgetRequest {
  userId: string;
  name: string;
  amount: string;
  currency: Currency;
  period: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
  startDate: string;
  endDate?: string;
}

export interface CreateBudgetResponse {
  budget: BudgetSummary;
}
