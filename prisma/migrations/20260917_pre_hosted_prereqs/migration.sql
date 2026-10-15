-- Prerequisites previously satisfied only by hand-provisioned dev clusters:
--   * `platform` schema — created by 20260918_add_feature_flags / add_rbac_system
--     but never by any migration (dev DBs had it from manual bootstrap).
--   * `uuid-ossp` extension — uuid_generate_v4() used by
--     20260918_add_consent_and_enhanced_audit; hosted Postgres (Neon, Supabase,
--     RDS) do not pre-install it.
-- Both statements are idempotent; on legacy dev DBs they are no-ops.
CREATE SCHEMA IF NOT EXISTS "platform";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
