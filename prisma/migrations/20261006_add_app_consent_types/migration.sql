-- Add the app-level snake_case consent types used by CONSENT_TYPES in
-- apps/klenzo/src/app/admin/consent/consent.service.ts. Previously every
-- consent insert failed because the DB enum only had uppercase values.
-- The legacy uppercase values are retained so this migration is safe on any
-- existing data.
ALTER TYPE "auth"."ConsentType" ADD VALUE IF NOT EXISTS 'terms_of_service';
ALTER TYPE "auth"."ConsentType" ADD VALUE IF NOT EXISTS 'privacy_policy';
ALTER TYPE "auth"."ConsentType" ADD VALUE IF NOT EXISTS 'marketing_email';
ALTER TYPE "auth"."ConsentType" ADD VALUE IF NOT EXISTS 'marketing_sms';
ALTER TYPE "auth"."ConsentType" ADD VALUE IF NOT EXISTS 'push_notifications';
ALTER TYPE "auth"."ConsentType" ADD VALUE IF NOT EXISTS 'analytics';
ALTER TYPE "auth"."ConsentType" ADD VALUE IF NOT EXISTS 'data_sharing_partners';
