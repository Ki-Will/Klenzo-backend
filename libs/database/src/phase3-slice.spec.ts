/**
 * PHASE 3 — PostgreSQL vertical slice (integration test, real database).
 *
 * Exit gate: "A Worker can perform a complete database-backed vertical slice
 * against PostgreSQL without changing the schema."
 *
 * Covers the Phase 3 test list:
 *   1. Worker → database connection (pre-Hyperdrive: direct connection string;
 *      the Hyperdrive binding exposes the same `connectionString` shape, so the
 *      client code path is identical — see libs/database/src/hyperdrive.ts)
 *   2. Read from each required schema (auth, finance, habit, notifications,
 *      platform, productivity, public)
 *   3. Write a disposable test record
 *   4. Roll back / delete test data
 *   5. Verify transaction behavior (commit + rollback)
 *   6. Verify finance trigger behavior (finance_events written by DB triggers)
 *   7. Verify audit rows (public.audit_logs)
 *   8. Prisma validation / type generation — run by the typecheck+generate gate,
 *      not here (see docs/migration/status.md)
 *
 * OPT-IN: this suite requires a reachable PostgreSQL with all migrations
 * applied. Set KLENZO_SLICE_DB_URL to run it:
 *
 *   KLENZO_SLICE_DB_URL="postgresql://klenzo@localhost:5434/klenzo_db?schema=public" \
 *     npx nx test database
 *
 * Without the variable the whole suite is skipped (CI-safe, no schema changes,
 * no network access).
 */

import type { PrismaClient } from './client.js';
import { createPrismaClient } from './client.js';
import { checkDatabaseConnection } from './health.js';

const CONN_STR = process.env.KLENZO_SLICE_DB_URL;
const describeSlice = CONN_STR ? describe : describe.skip;

if (!CONN_STR) {
  // eslint-disable-next-line no-console
  console.log(
    '[phase3-slice] KLENZO_SLICE_DB_URL not set — skipping real-database vertical slice.',
  );
}

describeSlice('Phase 3 vertical slice (real PostgreSQL)', () => {
  let prisma: PrismaClient;

  const marker = `phase3-slice-${Date.now()}`;
  const disposableEmail = `${marker}@example.test`;

  // Ids of rows created during the test, cleaned up in afterAll.
  const created = { userId: '', transactionIds: [] as string[] };

  beforeAll(async () => {
    prisma = createPrismaClient(CONN_STR as string);
  }, 30_000);

  afterAll(async () => {
    if (!prisma) return;
    try {
      // Remove disposable rows (finance_events rows for our transactions first —
      // they are the DB trigger's audit trail for records that no longer exist).
      if (created.transactionIds.length > 0) {
        await prisma.$executeRaw`
          DELETE FROM public.finance_events
          WHERE table_name = 'transactions'
            AND record_id::text = ANY(${created.transactionIds})`;
      }
      await prisma.transaction.deleteMany({
        where: { userId: created.userId },
      });
      await prisma.auditLog.deleteMany({
        where: { action: 'PHASE3_SLICE_TEST' },
      });
      await prisma.notification.deleteMany({
        where: { title: marker },
      });
      await prisma.user.deleteMany({
        where: { email: disposableEmail },
      });
    } finally {
      await prisma.$disconnect();
    }
  }, 30_000);

  // ── 1. Connection ─────────────────────────────────────────────────────────

  it('connects and answers SELECT 1', async () => {
    const health = await checkDatabaseConnection(prisma);
    expect(health.ok).toBe(true);
    expect(health.latencyMs).toBeGreaterThanOrEqual(0);
  });

  // ── 2. Read from each required schema ────────────────────────────────────

  it('reads a table from every required schema', async () => {
    const counts = await Promise.all([
      prisma.user.count(), //        auth          .users
      prisma.wallet.count(), //      finance       .wallets
      prisma.habit.count(), //       habit         .habits
      prisma.notification.count(), // notifications .notifications
      prisma.featureFlag.count(), // platform      .feature_flags
      prisma.task.count(), //        productivity  .tasks
      prisma.auditLog.count(), //    public        .audit_logs
    ]);
    for (const c of counts) {
      expect(typeof c).toBe('number');
      expect(c).toBeGreaterThanOrEqual(0);
    }
  });

  // ── 3 + 4. Disposable write and delete ───────────────────────────────────

  it('writes a disposable record and deletes it again', async () => {
    const row = await prisma.notification.create({
      data: { title: marker, message: 'phase3 slice disposable record' },
    });
    expect(row.id).toBeTruthy();

    const found = await prisma.notification.findUnique({
      where: { id: row.id },
    });
    expect(found?.title).toBe(marker);

    await prisma.notification.delete({ where: { id: row.id } });
    const gone = await prisma.notification.findUnique({
      where: { id: row.id },
    });
    expect(gone).toBeNull();
  });

  // ── 5. Transaction behavior ──────────────────────────────────────────────

  it('commits a transaction', async () => {
    await prisma.$transaction(async (tx) => {
      await tx.notification.create({
        data: { title: marker, message: 'committed' },
      });
    });
    const committed = await prisma.notification.findFirst({
      where: { title: marker, message: 'committed' },
    });
    expect(committed).not.toBeNull();
  });

  it('rolls back a failed transaction without leaving partial rows', async () => {
    await expect(
      prisma.$transaction(async (tx) => {
        await tx.notification.create({
          data: { title: marker, message: 'will-roll-back' },
        });
        throw new Error('intentional rollback');
      }),
    ).rejects.toThrow('intentional rollback');

    const partial = await prisma.notification.findFirst({
      where: { title: marker, message: 'will-roll-back' },
    });
    expect(partial).toBeNull();
  });

  // ── 6 + 7. Finance trigger behavior and audit rows ───────────────────────

  it('fires the finance trigger and writes audit rows on insert/update/delete', async () => {
    // Disposable user (transactions.userId → auth.users.id FK).
    const user = await prisma.user.create({
      data: { email: disposableEmail, passwordHash: 'slice-test-not-a-real-hash' },
    });
    created.userId = user.id;

    // INSERT → trigger writes finance_events row.
    const tx1 = await prisma.transaction.create({
      data: {
        userId: user.id,
        amount: 100,
        description: marker,
        date: new Date(),
      },
    });
    created.transactionIds.push(tx1.id);

    const insertEvents = await prisma.$queryRaw<Array<{ event_type: string }>>`
      SELECT event_type FROM public.finance_events
      WHERE table_name = 'transactions' AND record_id = ${tx1.id}::uuid`;
    expect(insertEvents.map((e) => e.event_type)).toContain('INSERT');

    // UPDATE → trigger writes UPDATE event with changed fields.
    await prisma.transaction.update({
      where: { id: tx1.id },
      data: { amount: 250 },
    });
    const updateEvents = await prisma.$queryRaw<Array<{ event_type: string }>>`
      SELECT event_type FROM public.finance_events
      WHERE table_name = 'transactions' AND record_id = ${tx1.id}::uuid
      ORDER BY created_at`;
    expect(updateEvents.map((e) => e.event_type)).toContain('UPDATE');

    // DELETE → trigger writes DELETE event; audit trail survives the row.
    await prisma.transaction.delete({ where: { id: tx1.id } });
    const deleteEvents = await prisma.$queryRaw<Array<{ event_type: string }>>`
      SELECT event_type FROM public.finance_events
      WHERE table_name = 'transactions' AND record_id = ${tx1.id}::uuid`;
    expect(deleteEvents.map((e) => e.event_type)).toContain('DELETE');

    // Audit rows in public.audit_logs (written by the app layer).
    const audit = await prisma.auditLog.create({
      data: {
        actorId: user.id,
        actorRole: 'USER',
        action: 'PHASE3_SLICE_TEST',
        targetType: 'notification',
        metadata: { marker },
        result: 'SUCCESS',
      },
    });
    expect(audit.id).toBeTruthy();
    const readBack = await prisma.auditLog.findUnique({
      where: { id: audit.id },
    });
    expect(readBack?.action).toBe('PHASE3_SLICE_TEST');
    expect(readBack?.checksum).toBeNull(); // chain checksum is optional
  });
});
