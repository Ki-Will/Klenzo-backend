# Migration Status — Klenzoo Backend (NestJS → Cloudflare Workers)

> **Last updated:** 2026-10-07
> **Source of truth:** [`KLENZOO_$0_FIRST_MICROSERVICE_MIGRATION.md`](../../KLENZOO_$0_FIRST_MICROSERVICE_MIGRATION.md) (implementation contract)
> **Companion docs:** [`migration-matrix.md`](../architecture/migration-matrix.md), [`current.md`](../architecture/current.md), [`target.md`](../architecture/target.md), [`service-boundaries.md`](../architecture/service-boundaries.md)

---

## 1. Where we are

| Phase | Name | Status |
|---|---|---|
| 0 | Architecture freeze & repository cleanup | ✅ Complete (baseline repaired — see §3) |
| 1 | Worker platform (`api-worker`) | 🟡 Scaffolded: Hono app, health/version, request ID, logging, error shape — 14 tests pass |
| 2 | Shared contracts & runtime compatibility | ✅ Shared libs written + tested; NestJS `auth-service` now consumes `@klenzo/contracts` (proto-parity); Worker code has zero NestJS imports (exit gate met) |
| 3 | PostgreSQL + Hyperdrive | 🟡 `libs/database` client/transaction/error layer written + tested (23 tests); no live Hyperdrive binding yet |
| 4 | Authentication Worker | 🔲 Not started |
| 5 | gRPC → Service Bindings | 🔲 Not started |
| 6 | Finance Worker | 🔲 Not started |
| 7 | Habit & Productivity Workers | 🔲 Not started |
| 8 | Queues (replace BullMQ) | 🔲 Not started (queue message contracts typed in `libs/contracts`) |
| 9 | Notification Worker + FCM | 🔲 Not started |
| 10 | R2 storage | 🔲 Not started |
| 11 | Realtime / Socket.IO replacement | 🔲 Not started (evaluate necessity first) |
| 12 | Insight Worker | 🔲 Not started |
| 13 | Remove legacy runtime infra | 🔲 Not started |

---

## 2. Gate status

Verified on 2026-10-07 (Linux host) unless noted.

| Gate | Command | Status |
|---|---|---|
| Typecheck — all 7 projects | `npm run typecheck` | ✅ Green (0 errors) |
| Unit tests — 10 projects, 140 tests | `npx nx run-many -t test` | ✅ Green (2026-10-07) |
| Lint — migration projects | `npx nx run-many -t lint -p api-worker validation contracts database auth config events shared` | ✅ Green (2026-10-05) |
| Worker smoke test | `npx nx test api-worker` | ✅ 14 tests (2026-10-07, §4.5 patch applied) |
| Prisma validation | `npx prisma validate` | ✅ (2026-10-07) |

Test breakdown: `api-worker` 14 · `database` 23 · `validation` 51 · `contracts` 10 · six NestJS services × 7 = 42.

---

## 3. Baseline repair log (Phase 0 exit gate)

The legacy NestJS typecheck baseline was red at the start of this workstream. It was repaired without changing runtime behavior except where noted:

- **2026-10-05** — `klenzo` typecheck: 54 errors → 11. Installed missing dependencies (`@opentelemetry/*`, `web-push`, `@types/uuid`, `@types/opossum`, `@types/compression`, `@types/web-push`), restored accidentally-deleted `AuthService.getSessions`/`revokeSession`, added the missing MFA branch in `auth.controller#login`, fixed audit/guard import paths, added per-service `tsconfig.spec.json`.
- **2026-10-05** — Full test suite green (136 tests, 10 projects).
- **2026-10-06** — `klenzo` typecheck: 11 errors → 0. Fixed duplicate `forbidNonWhitelisted` in `main.ts`, opossum default import in `circuit-breaker.ts`, `resourceFromAttributes()` in `opentelemetry.ts` (OTel resources ≥1.30 API), Prisma `InputJsonValue` casts in approval/audit/rbac, `RedisService.get/set` API misuse in rbac permission cache, consent `ConsentType` enum comparisons. `npm run typecheck` now green for all 7 projects.

---

## 4. Known issues / debt

### 4.1 Consent feature: app ↔ schema drift — ✅ RESOLVED (2026-10-07)

The Prisma/PostgreSQL enum `auth."ConsentType"` now carries both the legacy uppercase values and the 7 snake_case app values (`terms_of_service`, `privacy_policy`, `marketing_email`, `marketing_sms`, `push_notifications`, `analytics`, `data_sharing_partners`) — additive migration `prisma/migrations/20261006_add_app_consent_types/` (`ALTER TYPE ... ADD VALUE IF NOT EXISTS`, safe on existing data; PG15 cannot run it inside a transaction — `prisma migrate deploy` handles this).

- `recordConsent`/`revokeConsent` casts are now typed (`as ConsentType`, no `as any`).
- `checkPolicyConsent` compares against the snake_case values the app actually writes — previously (after the typecheck repair aligned them to uppercase) the comparisons could never match any stored row.
- The sets still do not map 1:1 (two marketing types + push vs one legacy `MARKETING`); no mapping decision needed anymore since the enum accepts all app values directly.

### 4.2 Test flakiness under full parallel runs

`npx nx run-many -t test` occasionally segfaults jest worker processes when all 10 projects run in parallel (observed on Linux with the repo on an NTFS-mounted volume). Affected projects pass reliably standalone (`nx test <project>`). Nx flags `insight-service:test` and others as flaky after such runs. Re-run failures individually before treating them as real.

### 4.3 node_modules platform mismatch

`node_modules` was originally installed on Windows; the current host is Linux. Platform-specific natives (`@rollup/rollup-linux-x64-gnu`, `@esbuild/linux-x64`, `@unrs/resolver-binding-linux-x64-gnu`) were missing or half-extracted after an interrupted install. Repair: `npm install` from the repo root (do not delete `package-lock.json` unless npm's optional-dependency bug persists).

### 4.4 Other

- `libs/auth`, `libs/shared`, `libs/config`, `libs/events` typecheck but have no tests yet (contract Phase 2 suggests schema/contract tests).
- CI (`.github/workflows`) not yet extended with the Worker typecheck/test/build targets.
- `graphify` CLI: now installed on the host (0.9.77); graph refreshed after the typecheck repair commit.

---

### 4.5 Local patch: vitest-pool-workers space-in-path bug

`@cloudflare/vitest-pool-workers@0.5.41` (pinned by vitest 2.x) fails on paths containing spaces: workerd resolves `file:` URLs as relative paths, so module loading dies with `No such module ".../file:/...King%20Will/..."`. This is upstream [workers-sdk#14107](https://github.com/cloudflare/workers-sdk/issues/14107), fixed by PR #14152 (June 2026) — after our version.

**Local workaround:** port the #14152 `rawSpecifier` handling into `node_modules/@cloudflare/vitest-pool-workers/dist/pool/index.mjs` inside `handleModuleFallbackRequest` (after the `specifier.startsWith("file:")` block):

```js
const rawSpecifier = url.searchParams.get("rawSpecifier");
if (rawSpecifier !== null && rawSpecifier.startsWith("file:")) {
  specifier = ensurePosixLikePath(fileURLToPath(rawSpecifier));
}
```

**⚠️ This patch lives only in `node_modules` and is wiped by every `npm install`.** Re-apply after any reinstall (or move the repo to a path without spaces, or upgrade vitest + `@cloudflare/vitest-pool-workers` past #14152).

Re-applied on 2026-10-07 after the full `npm install` (which completed cleanly, `exit 0`; `package-lock.json` churn was CRLF-only and normalized).

---

## 5. Next actions (in contract order)

1. Exit-gate verification for Phase 0/1: deployed `api-worker` smoke test against a live environment (requires wrangler credentials).
2. ✅ Phase 2 done (2026-10-07): `auth-service` consumes `@klenzo/contracts` with proto-parity types; Worker/shared libs have zero NestJS imports.
3. Phase 3: Hyperdrive binding + vertical database slice test (no schema changes).
4. ✅ §4.1 consent drift resolved (2026-10-07) — enum extended, migration `20261006_add_app_consent_types` pending deploy.
