-- ── FINANCIAL BACKBONE ──────────────────────────────────────────────────────
-- NOTE: the original file for this migration contained Prisma schema DSL
-- (enum/model blocks) instead of SQL and could never execute on any database.
-- Regenerated from prisma/schema.prisma via `prisma migrate diff`.
-- Objects: 7 finance enums; ledger_entries, reconciliation_records,
-- risk_assessments, approval_requests; their indexes and foreign keys.

CREATE TYPE "finance"."LedgerEntryType" AS ENUM ('DEBIT', 'CREDIT');
CREATE TYPE "finance"."LedgerEntryStatus" AS ENUM ('PENDING', 'POSTED', 'REVERSED');
CREATE TYPE "finance"."ReconciliationStatus" AS ENUM ('MATCHED', 'UNMATCHED', 'AMOUNT_MISMATCH', 'STATUS_MISMATCH', 'DUPLICATE', 'PENDING', 'RESOLVED');
CREATE TYPE "finance"."RiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE "finance"."RiskDecision" AS ENUM ('ALLOW', 'REVIEW', 'BLOCK', 'ESCALATE');
CREATE TYPE "finance"."ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED');
CREATE TYPE "finance"."ApprovalType" AS ENUM ('TRANSACTION_REVERSAL', 'WALLET_ADJUSTMENT', 'REFUND', 'PROVIDER_DISABLEMENT', 'LIMIT_CHANGE', 'ACCOUNT_RESTRICTION');

CREATE TABLE "finance"."ledger_entries" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "transactionId" TEXT,
    "transferId" TEXT,
    "type" "finance"."LedgerEntryType" NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "balance" DECIMAL(65,30) NOT NULL,
    "status" "finance"."LedgerEntryStatus" NOT NULL DEFAULT 'POSTED',
    "description" TEXT,
    "reference" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'RWF',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_entries_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "finance"."reconciliation_records" (
    "id" TEXT NOT NULL,
    "providerName" TEXT NOT NULL,
    "providerRef" TEXT,
    "providerAmount" DECIMAL(65,30) NOT NULL,
    "providerStatus" TEXT,
    "providerDate" TIMESTAMP(3),
    "transactionId" TEXT,
    "ledgerEntryId" TEXT,
    "status" "finance"."ReconciliationStatus" NOT NULL DEFAULT 'PENDING',
    "discrepancyType" TEXT,
    "resolutionNote" TEXT,
    "resolvedBy" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reconciliation_records_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "finance"."risk_assessments" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "riskScore" INTEGER NOT NULL,
    "riskLevel" "finance"."RiskLevel" NOT NULL,
    "signals" JSONB NOT NULL,
    "decision" "finance"."RiskDecision" NOT NULL DEFAULT 'ALLOW',
    "reviewNote" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "risk_assessments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "finance"."approval_requests" (
    "id" TEXT NOT NULL,
    "type" "finance"."ApprovalType" NOT NULL,
    "requestedById" TEXT NOT NULL,
    "approvedById" TEXT,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "finance"."ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "reason" TEXT,
    "rejectionReason" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "approval_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ledger_entries_walletId_createdAt_idx" ON "finance"."ledger_entries"("walletId", "createdAt");
CREATE INDEX "ledger_entries_transactionId_idx" ON "finance"."ledger_entries"("transactionId");
CREATE INDEX "ledger_entries_transferId_idx" ON "finance"."ledger_entries"("transferId");
CREATE INDEX "ledger_entries_status_idx" ON "finance"."ledger_entries"("status");
CREATE INDEX "reconciliation_records_status_idx" ON "finance"."reconciliation_records"("status");
CREATE INDEX "reconciliation_records_providerName_idx" ON "finance"."reconciliation_records"("providerName");
CREATE INDEX "reconciliation_records_transactionId_idx" ON "finance"."reconciliation_records"("transactionId");
CREATE INDEX "risk_assessments_transactionId_idx" ON "finance"."risk_assessments"("transactionId");
CREATE INDEX "risk_assessments_userId_idx" ON "finance"."risk_assessments"("userId");
CREATE INDEX "risk_assessments_riskLevel_idx" ON "finance"."risk_assessments"("riskLevel");
CREATE INDEX "risk_assessments_decision_idx" ON "finance"."risk_assessments"("decision");
CREATE INDEX "approval_requests_status_idx" ON "finance"."approval_requests"("status");
CREATE INDEX "approval_requests_type_idx" ON "finance"."approval_requests"("type");
CREATE INDEX "approval_requests_requestedById_idx" ON "finance"."approval_requests"("requestedById");

ALTER TABLE "finance"."ledger_entries" ADD CONSTRAINT "ledger_entries_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "finance"."wallets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "finance"."ledger_entries" ADD CONSTRAINT "ledger_entries_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "finance"."transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "finance"."ledger_entries" ADD CONSTRAINT "ledger_entries_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "finance"."transfers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "finance"."reconciliation_records" ADD CONSTRAINT "reconciliation_records_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "finance"."transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "finance"."reconciliation_records" ADD CONSTRAINT "reconciliation_records_ledgerEntryId_fkey" FOREIGN KEY ("ledgerEntryId") REFERENCES "finance"."ledger_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "finance"."risk_assessments" ADD CONSTRAINT "risk_assessments_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "finance"."transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "finance"."approval_requests" ADD CONSTRAINT "approval_requests_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "auth"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "finance"."approval_requests" ADD CONSTRAINT "approval_requests_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "auth"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
