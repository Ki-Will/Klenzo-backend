-- Consolidated V2 Migration: Adds Wallets, Transfers, KYC, Payroll, and High-Performance Compound Indexes

-- Create New Enums
CREATE TYPE "finance"."TransferType" AS ENUM ('P2P', 'MOBILE_MONEY', 'BANK_TRANSFER');
CREATE TYPE "finance"."TransferStatus" AS ENUM ('INITIATED', 'PROCESSING', 'COMPLETED', 'FAILED');
CREATE TYPE "auth"."KycTier" AS ENUM ('TIER_0', 'TIER_1', 'TIER_2', 'TIER_3');
CREATE TYPE "auth"."KycStatus" AS ENUM ('NOT_SUBMITTED', 'PENDING', 'VERIFIED', 'REJECTED');

ALTER TYPE "finance"."TransactionStatus" ADD VALUE IF NOT EXISTS 'FAILED';
ALTER TYPE "finance"."TransactionStatus" ADD VALUE IF NOT EXISTS 'REJECTED';
ALTER TYPE "finance"."TransactionType" ADD VALUE IF NOT EXISTS 'TRANSFER';
ALTER TYPE "finance"."TransactionType" ADD VALUE IF NOT EXISTS 'PAYROLL';

-- Create Table: auth.kyc_records
CREATE TABLE "auth"."kyc_records" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tier" "auth"."KycTier" NOT NULL DEFAULT 'TIER_0',
    "status" "auth"."KycStatus" NOT NULL DEFAULT 'NOT_SUBMITTED',
    "documentType" TEXT,
    "documentNumber" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kyc_records_pkey" PRIMARY KEY ("id")
);

-- Create Table: finance.wallets
CREATE TABLE "finance"."wallets" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Main Wallet',
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "balance" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "accountNumber" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wallets_pkey" PRIMARY KEY ("id")
);

-- Create Table: finance.transfers
CREATE TABLE "finance"."transfers" (
    "id" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "type" "finance"."TransferType" NOT NULL DEFAULT 'P2P',
    "status" "finance"."TransferStatus" NOT NULL DEFAULT 'COMPLETED',
    "reference" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transfers_pkey" PRIMARY KEY ("id")
);

-- Create Table: finance.payroll_runs
CREATE TABLE "finance"."payroll_runs" (
    "id" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "totalAmount" DECIMAL(65,30) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'READY',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payroll_runs_pkey" PRIMARY KEY ("id")
);

-- Create Table: finance.payroll_employees
CREATE TABLE "finance"."payroll_employees" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "salary" DECIMAL(65,30) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payroll_employees_pkey" PRIMARY KEY ("id")
);

-- Unique Indexes
CREATE UNIQUE INDEX "kyc_records_userId_key" ON "auth"."kyc_records"("userId");
CREATE UNIQUE INDEX "wallets_accountNumber_key" ON "finance"."wallets"("accountNumber");
CREATE UNIQUE INDEX "transfers_reference_key" ON "finance"."transfers"("reference");

-- Performance Compound Indexes
CREATE INDEX "users_email_isActive_idx" ON "auth"."users"("email", "isActive");
CREATE INDEX "users_createdAt_idx" ON "auth"."users"("createdAt");
CREATE INDEX "kyc_records_status_idx" ON "auth"."kyc_records"("status");
CREATE INDEX "tasks_userId_status_idx" ON "productivity"."tasks"("userId", "status");
CREATE INDEX "tasks_dueDate_idx" ON "productivity"."tasks"("dueDate");
CREATE INDEX "habit_logs_habitId_completedAt_idx" ON "habit"."habit_logs"("habitId", "completedAt");
CREATE INDEX "wallets_userId_isPrimary_idx" ON "finance"."wallets"("userId", "isPrimary");
CREATE INDEX "transfers_senderId_date_idx" ON "finance"."transfers"("senderId", "date");
CREATE INDEX "transfers_status_idx" ON "finance"."transfers"("status");
CREATE INDEX "payroll_runs_createdAt_idx" ON "finance"."payroll_runs"("createdAt");
CREATE INDEX "payroll_employees_userId_idx" ON "finance"."payroll_employees"("userId");
CREATE INDEX "group_members_groupId_userId_idx" ON "finance"."group_members"("groupId", "userId");
CREATE INDEX "budgets_userId_category_idx" ON "finance"."budgets"("userId", "category");
CREATE INDEX "transactions_userId_date_idx" ON "finance"."transactions"("userId", "date");
CREATE INDEX "transactions_groupId_date_idx" ON "finance"."transactions"("groupId", "date");
CREATE INDEX "notifications_userId_isRead_idx" ON "notifications"."notifications"("userId", "isRead");
CREATE INDEX "audit_logs_actorId_createdAt_idx" ON "public"."audit_logs"("actorId", "createdAt");

-- Foreign Keys
ALTER TABLE "auth"."kyc_records" ADD CONSTRAINT "kyc_records_userId_fkey" FOREIGN KEY ("userId") REFERENCES "auth"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "finance"."wallets" ADD CONSTRAINT "wallets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "auth"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "finance"."transfers" ADD CONSTRAINT "transfers_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "auth"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "finance"."payroll_employees" ADD CONSTRAINT "payroll_employees_userId_fkey" FOREIGN KEY ("userId") REFERENCES "auth"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
