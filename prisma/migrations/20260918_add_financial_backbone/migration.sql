// ── LEDGER SCHEMA (Double-Entry Accounting) ──────────────────────────────

enum LedgerEntryType {
  DEBIT
  CREDIT

  @@schema("finance")
}

enum LedgerEntryStatus {
  PENDING
  POSTED
  REVERSED

  @@schema("finance")
}

model LedgerEntry {
  id              String          @id @default(uuid())
  walletId        String
  transactionId   String?
  transferId      String?
  type            LedgerEntryType
  amount          Decimal
  balance         Decimal         // Running balance after this entry
  status          LedgerEntryStatus @default(POSTED)
  description     String?
  reference       String?
  currency        String          @default("RWF")
  createdAt       DateTime        @default(now())

  wallet    Wallet?    @relation(fields: [walletId], references: [id])
  transaction Transaction? @relation(fields: [transactionId], references: [id])
  transfer  Transfer?  @relation(fields: [transferId], references: [id])

  @@map("ledger_entries")
  @@schema("finance")
  @@index([walletId, createdAt])
  @@index([transactionId])
  @@index([transferId])
  @@index([status])
}

// ── RECONCILIATION SCHEMA ──────────────────────────────────────────────────

enum ReconciliationStatus {
  MATCHED
  UNMATCHED
  AMOUNT_MISMATCH
  STATUS_MISMATCH
  DUPLICATE
  PENDING
  RESOLVED

  @@schema("finance")
}

model ReconciliationRecord {
  id              String                @id @default(uuid())
  providerName    String
  providerRef     String?
  providerAmount  Decimal
  providerStatus  String?
  providerDate    DateTime?
  transactionId   String?
  ledgerEntryId   String?
  status          ReconciliationStatus  @default(PENDING)
  discrepancyType String?
  resolutionNote  String?
  resolvedBy      String?
  resolvedAt      DateTime?
  createdAt       DateTime              @default(now())
  updatedAt       DateTime              @updatedAt

  transaction   Transaction?  @relation(fields: [transactionId], references: [id])
  ledgerEntry   LedgerEntry?  @relation(fields: [ledgerEntryId], references: [id])

  @@map("reconciliation_records")
  @@schema("finance")
  @@index([status])
  @@index([providerName])
  @@index([transactionId])
}

// ── AML/FRAUD SCHEMA ───────────────────────────────────────────────────────

enum RiskLevel {
  LOW
  MEDIUM
  HIGH
  CRITICAL

  @@schema("finance")
}

enum RiskDecision {
  ALLOW
  REVIEW
  BLOCK
  ESCALATE

  @@schema("finance")
}

model RiskAssessment {
  id              String       @id @default(uuid())
  transactionId   String
  userId          String
  riskScore       Int          // 0-100
  riskLevel       RiskLevel
  signals         Json         // Array of risk signal descriptions
  decision        RiskDecision @default(ALLOW)
  reviewNote      String?
  reviewedBy      String?
  reviewedAt      DateTime?
  createdAt       DateTime     @default(now())

  transaction Transaction? @relation(fields: [transactionId], references: [id])

  @@map("risk_assessments")
  @@schema("finance")
  @@index([transactionId])
  @@index([userId])
  @@index([riskLevel])
  @@index([decision])
}

// ── APPROVAL WORKFLOWS SCHEMA ──────────────────────────────────────────────

enum ApprovalStatus {
  PENDING
  APPROVED
  REJECTED
  EXPIRED

  @@schema("finance")
}

enum ApprovalType {
  TRANSACTION_REVERSAL
  WALLET_ADJUSTMENT
  REFUND
  PROVIDER_DISABLEMENT
  LIMIT_CHANGE
  ACCOUNT_RESTRICTION

  @@schema("finance")
}

model ApprovalRequest {
  id              String          @id @default(uuid())
  type            ApprovalType
  requestedById   String
  approvedById    String?
  targetType      String
  targetId        String
  payload         Json
  status          ApprovalStatus  @default(PENDING)
  reason          String?
  rejectionReason String?
  expiresAt       DateTime?
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt

  requestedBy User @relation("ApprovalRequestedBy", fields: [requestedById], references: [id])
  approvedBy  User? @relation("ApprovalApprovedBy", fields: [approvedById], references: [id])

  @@map("approval_requests")
  @@schema("finance")
  @@index([status])
  @@index([type])
  @@index([requestedById])
}
