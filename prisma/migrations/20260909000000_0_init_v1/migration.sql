-- Create Schemas
CREATE SCHEMA IF NOT EXISTS "auth";
CREATE SCHEMA IF NOT EXISTS "finance";
CREATE SCHEMA IF NOT EXISTS "habit";
CREATE SCHEMA IF NOT EXISTS "notifications";
CREATE SCHEMA IF NOT EXISTS "productivity";
CREATE SCHEMA IF NOT EXISTS "public";

-- Create Enums
CREATE TYPE "auth"."Role" AS ENUM ('USER', 'ADMIN', 'SUPERADMIN');
CREATE TYPE "finance"."TransactionStatus" AS ENUM ('PENDING', 'APPROVED');
CREATE TYPE "finance"."TransactionType" AS ENUM ('INCOME', 'EXPENSE');
CREATE TYPE "finance"."BudgetPeriod" AS ENUM ('MONTHLY', 'QUARTERLY', 'YEARLY', 'CUSTOM');
CREATE TYPE "productivity"."TaskStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'DONE', 'CANCELLED');
CREATE TYPE "habit"."HabitFrequency" AS ENUM ('DAILY', 'WEEKLY');
CREATE TYPE "notifications"."NotificationType" AS ENUM ('INFO', 'SUCCESS', 'WARNING', 'ERROR');
CREATE TYPE "notifications"."NotificationCategory" AS ENUM ('NOTIFICATION', 'BANNER', 'INSIGHT', 'TRANSACTION', 'SECURITY', 'GROUP');

-- Create Table: auth.users
CREATE TABLE "auth"."users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastLogin" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "refreshToken" TEXT,
    "refreshTokenExpires" TIMESTAMP(3),
    "passwordResetToken" TEXT,
    "passwordResetExpires" TIMESTAMP(3),
    "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
    "role" "auth"."Role" NOT NULL DEFAULT 'USER',
    "name" TEXT,
    "phone" TEXT,
    "avatar" TEXT,
    "notificationSettings" JSONB,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- Create Table: productivity.tasks
CREATE TABLE "productivity"."tasks" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "productivity"."TaskStatus" NOT NULL DEFAULT 'TODO',
    "dueDate" TIMESTAMP(3),
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- Create Table: habit.habits
CREATE TABLE "habit"."habits" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "frequency" "habit"."HabitFrequency" NOT NULL,
    "currentStreak" INTEGER NOT NULL DEFAULT 0,
    "longestStreak" INTEGER NOT NULL DEFAULT 0,
    "lastCompletedDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "habits_pkey" PRIMARY KEY ("id")
);

-- Create Table: habit.habit_logs
CREATE TABLE "habit"."habit_logs" (
    "id" TEXT NOT NULL,
    "habitId" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "habit_logs_pkey" PRIMARY KEY ("id")
);

-- Create Table: finance.groups
CREATE TABLE "finance"."groups" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "groups_pkey" PRIMARY KEY ("id")
);

-- Create Table: finance.group_members
CREATE TABLE "finance"."group_members" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "group_members_pkey" PRIMARY KEY ("id")
);

-- Create Table: finance.accounts
CREATE TABLE "finance"."accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "balance" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- Create Table: finance.budgets
CREATE TABLE "finance"."budgets" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'General Budget',
    "category" TEXT,
    "type" TEXT NOT NULL DEFAULT 'expense',
    "limitAmount" DECIMAL(65,30) NOT NULL,
    "spent" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "period" "finance"."BudgetPeriod" NOT NULL DEFAULT 'MONTHLY',
    "color" TEXT,
    "icon" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "budgets_pkey" PRIMARY KEY ("id")
);

-- Create Table: finance.transactions
CREATE TABLE "finance"."transactions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "groupId" TEXT,
    "accountId" TEXT,
    "parentTransactionId" TEXT,
    "status" "finance"."TransactionStatus" NOT NULL DEFAULT 'APPROVED',
    "transactionType" "finance"."TransactionType" NOT NULL DEFAULT 'EXPENSE',
    "amount" DECIMAL(65,30) NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "budgetId" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- Create Table: notifications.notifications
CREATE TABLE "notifications"."notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "type" "notifications"."NotificationType" NOT NULL DEFAULT 'INFO',
    "category" "notifications"."NotificationCategory" NOT NULL DEFAULT 'NOTIFICATION',
    "title" TEXT NOT NULL,
    "message" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "isDismissed" BOOLEAN NOT NULL DEFAULT false,
    "isGlobal" BOOLEAN NOT NULL DEFAULT false,
    "color" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "dismissible" BOOLEAN NOT NULL DEFAULT true,
    "link" TEXT,
    "linkText" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- Create Table: public.audit_logs
CREATE TABLE "public"."audit_logs" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "actorRole" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT,
    "targetId" TEXT,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "requestPath" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- Create Table: public.system_metrics
CREATE TABLE "public"."system_metrics" (
    "id" TEXT NOT NULL,
    "metricName" TEXT NOT NULL,
    "value" DECIMAL(65,30) NOT NULL,
    "labels" JSONB,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_metrics_pkey" PRIMARY KEY ("id")
);

-- Create Unique Index
CREATE UNIQUE INDEX "users_email_key" ON "auth"."users"("email");

-- Create Indexes
CREATE INDEX "tasks_userId_idx" ON "productivity"."tasks"("userId");
CREATE INDEX "tasks_status_idx" ON "productivity"."tasks"("status");
CREATE INDEX "habits_userId_idx" ON "habit"."habits"("userId");
CREATE INDEX "habit_logs_habitId_idx" ON "habit"."habit_logs"("habitId");
CREATE INDEX "groups_createdBy_idx" ON "finance"."groups"("createdBy");
CREATE INDEX "group_members_groupId_idx" ON "finance"."group_members"("groupId");
CREATE INDEX "group_members_userId_idx" ON "finance"."group_members"("userId");
CREATE INDEX "accounts_userId_idx" ON "finance"."accounts"("userId");
CREATE INDEX "budgets_userId_idx" ON "finance"."budgets"("userId");
CREATE INDEX "transactions_userId_idx" ON "finance"."transactions"("userId");
CREATE INDEX "transactions_groupId_idx" ON "finance"."transactions"("groupId");
CREATE INDEX "transactions_status_idx" ON "finance"."transactions"("status");
CREATE INDEX "transactions_parentTransactionId_idx" ON "finance"."transactions"("parentTransactionId");
CREATE INDEX "transactions_budgetId_idx" ON "finance"."transactions"("budgetId");
CREATE INDEX "transactions_accountId_idx" ON "finance"."transactions"("accountId");
CREATE INDEX "notifications_userId_idx" ON "notifications"."notifications"("userId");
CREATE INDEX "notifications_category_idx" ON "notifications"."notifications"("category");
CREATE INDEX "notifications_isRead_idx" ON "notifications"."notifications"("isRead");
CREATE INDEX "audit_logs_actorId_idx" ON "public"."audit_logs"("actorId");
CREATE INDEX "audit_logs_action_idx" ON "public"."audit_logs"("action");
CREATE INDEX "audit_logs_createdAt_idx" ON "public"."audit_logs"("createdAt");
CREATE INDEX "system_metrics_metricName_recordedAt_idx" ON "public"."system_metrics"("metricName", "recordedAt");

-- Add Foreign Key Constraints
ALTER TABLE "productivity"."tasks" ADD CONSTRAINT "tasks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "auth"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "habit"."habits" ADD CONSTRAINT "habits_userId_fkey" FOREIGN KEY ("userId") REFERENCES "auth"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "habit"."habit_logs" ADD CONSTRAINT "habit_logs_habitId_fkey" FOREIGN KEY ("habitId") REFERENCES "habit"."habits"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "finance"."groups" ADD CONSTRAINT "groups_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "auth"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "finance"."group_members" ADD CONSTRAINT "group_members_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "finance"."groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "finance"."accounts" ADD CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "auth"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "finance"."budgets" ADD CONSTRAINT "budgets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "auth"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "finance"."transactions" ADD CONSTRAINT "transactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "auth"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "finance"."transactions" ADD CONSTRAINT "transactions_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "finance"."groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "finance"."transactions" ADD CONSTRAINT "transactions_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "finance"."accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "finance"."transactions" ADD CONSTRAINT "transactions_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "finance"."budgets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "finance"."transactions" ADD CONSTRAINT "transactions_parentTransactionId_fkey" FOREIGN KEY ("parentTransactionId") REFERENCES "finance"."transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "notifications"."notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "auth"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "public"."audit_logs" ADD CONSTRAINT "actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "auth"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
