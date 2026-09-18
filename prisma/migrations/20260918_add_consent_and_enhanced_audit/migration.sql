-- Consent Schema
CREATE TYPE "auth"."ConsentType" AS ENUM ('PRIVACY_POLICY', 'TERMS_OF_SERVICE', 'MARKETING', 'ANALYTICS', 'DATA_SHARING');

-- Create consent_records table
CREATE TABLE "auth"."consent_records" (
    "id" TEXT NOT NULL DEFAULT uuid_generate_v4(),
    "userId" TEXT NOT NULL,
    "consentType" "auth"."ConsentType" NOT NULL,
    "granted" BOOLEAN NOT NULL DEFAULT false,
    "version" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "consent_records_pkey" PRIMARY KEY ("id")
);

-- Create unique constraint
CREATE UNIQUE INDEX "consent_records_userId_consentType_key" ON "auth"."consent_records"("userId", "consentType");

-- Create indexes
CREATE INDEX "consent_records_userId_idx" ON "auth"."consent_records"("userId");
CREATE INDEX "consent_records_consentType_idx" ON "auth"."consent_records"("consentType");

-- Add foreign key
ALTER TABLE "auth"."consent_records" ADD CONSTRAINT "consent_records_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "auth"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create policy_versions table
CREATE TABLE "auth"."policy_versions" (
    "id" TEXT NOT NULL DEFAULT uuid_generate_v4(),
    "policyType" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "contentUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "requiresConsent" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "policy_versions_pkey" PRIMARY KEY ("id")
);

-- Create unique constraint
CREATE UNIQUE INDEX "policy_versions_policyType_version_key" ON "auth"."policy_versions"("policyType", "version");

-- Create indexes
CREATE INDEX "policy_versions_policyType_idx" ON "auth"."policy_versions"("policyType");
CREATE INDEX "policy_versions_isActive_idx" ON "auth"."policy_versions"("isActive");

-- Enhanced Audit: add tamper detection columns
ALTER TABLE "public"."audit_logs" ADD COLUMN "result" TEXT NOT NULL DEFAULT 'SUCCESS';
ALTER TABLE "public"."audit_logs" ADD COLUMN "checksum" TEXT;
ALTER TABLE "public"."audit_logs" ADD COLUMN "previousChecksum" TEXT;

-- New indexes for enhanced audit
CREATE INDEX "audit_logs_targetType_targetId_idx" ON "public"."audit_logs"("targetType", "targetId");
CREATE INDEX "audit_logs_result_idx" ON "public"."audit_logs"("result");
