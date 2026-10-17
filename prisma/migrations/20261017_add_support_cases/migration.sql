-- CreateEnum
CREATE TYPE "platform"."SupportCaseStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'ESCALATED', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "platform"."SupportCasePriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateTable
CREATE TABLE "platform"."support_cases" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "platform"."SupportCaseStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "platform"."SupportCasePriority" NOT NULL DEFAULT 'MEDIUM',
    "assignedTo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform"."support_case_messages" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "authorId" TEXT,
    "authorName" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_case_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "support_cases_status_idx" ON "platform"."support_cases"("status");

-- CreateIndex
CREATE INDEX "support_cases_userId_idx" ON "platform"."support_cases"("userId");

-- CreateIndex
CREATE INDEX "support_case_messages_caseId_idx" ON "platform"."support_case_messages"("caseId");

-- AddForeignKey
ALTER TABLE "platform"."support_cases" ADD CONSTRAINT "support_cases_userId_fkey" FOREIGN KEY ("userId") REFERENCES "auth"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform"."support_case_messages" ADD CONSTRAINT "support_case_messages_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "platform"."support_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
