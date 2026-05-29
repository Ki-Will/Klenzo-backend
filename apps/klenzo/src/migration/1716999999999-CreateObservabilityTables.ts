import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateObservabilityTables1716999999999 implements MigrationInterface {
  name = 'CreateObservabilityTables1716999999999';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create audit_logs table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS public.audit_logs (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "actorId" integer,
        "actorRole" character varying(32) NOT NULL,
        "action" character varying(128) NOT NULL,
        "targetType" character varying(64),
        "targetId" character varying(64),
        "metadata" jsonb,
        "ipAddress" character varying(45),
        "requestPath" character varying(512),
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_audit_logs_id" PRIMARY KEY ("id")
      )
    `);

    // Indexes for audit_logs
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_audit_logs_actorId" ON public.audit_logs ("actorId")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_audit_logs_action" ON public.audit_logs ("action")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_audit_logs_createdAt" ON public.audit_logs ("createdAt")`);

    // 2. Create system_metrics table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS public.system_metrics (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "metricName" character varying(128) NOT NULL,
        "value" numeric(18,4) NOT NULL,
        "labels" jsonb,
        "recordedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_system_metrics_id" PRIMARY KEY ("id")
      )
    `);

    // Indexes for system_metrics
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_system_metrics_name_date" ON public.system_metrics ("metricName", "recordedAt")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS public."IDX_system_metrics_name_date"`);
    await queryRunner.query(`DROP TABLE IF EXISTS public.system_metrics`);
    await queryRunner.query(`DROP INDEX IF EXISTS public."IDX_audit_logs_createdAt"`);
    await queryRunner.query(`DROP INDEX IF EXISTS public."IDX_audit_logs_action"`);
    await queryRunner.query(`DROP INDEX IF EXISTS public."IDX_audit_logs_actorId"`);
    await queryRunner.query(`DROP TABLE IF EXISTS public.audit_logs`);
  }
}
