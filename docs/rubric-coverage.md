# CPE241 rubric coverage matrix

This document maps every Lecture 10 (Multiuser Environment) topic to a
concrete file:line in the codebase, so the demo viva can answer
"where do you do X?" in one sentence.

Lecture 9 (Query Optimization) topics are also mapped — those need no
code change because Prisma + the partial index from Phase 12.1 already
exercise them; this doc just gives you the talking points.

> Lecture references: `D:/CPE 241 Product build Present/CPE241+Lecture10+Multiuser+Environment (1).pdf` and `D:/CPE 241 Product build Present/CPE241+Lecture09+Query+Optimization+and+Tuning (1).pdf`.

---

## Lecture 10 — Multiuser Environment

| Topic | Where to point | Demo line |
|---|---|---|
| Transactions + ACID | `apps/server/src/services/cart.service.ts` (checkout) — `prisma.$transaction([...])` wraps order creation, cart status flip, transaction insert, audit row. | "Atomic — either all four writes succeed or none do. ACID's A." |
| Isolation level | `READ COMMITTED` (Postgres default — we do not override). Lecture covers it; we use the safe default. | "Postgres default. Higher levels would block our concurrent inventory writes; READ COMMITTED is enough because we use row-level locks via `$transaction`." |
| Locking | Prisma `$transaction` triggers row-level `SELECT … FOR UPDATE` on inventory writes during checkout. | "Implicit row locks during checkout. No phantom reads because we hold the inventory rows for the whole txn." |
| **Triggers** | `packages/db/prisma/migrations/20260428151458_phase_13_6_5_cpe241_rubric_features/migration.sql` lines 22-58 | "Two triggers: `product_touch_updated_at` (BEFORE UPDATE) auto-maintains `product.updated_at`; `review_delete_audit` (AFTER DELETE) writes a fallback audit row even if a manual SQL DELETE bypasses the API." |
| **Views** | Same migration file lines 60-103 | "`live_stores_view` reifies the soft-delete predicate in one place. `product_with_avg_rating_view` denormalises the JOIN+AGGREGATE so analytics consumers can `WHERE avg_rating > 4` in one clause." |
| **Permissions (GRANT/REVOKE)** | Same migration file lines 105-160 | "Three roles: `metu` (Neon admin, migrations only), `metu_app` (runtime, INSERT/UPDATE/DELETE on app tables), `metu_analytics` (SELECT-only, explicitly denied `audit_log`). Principle of least privilege." |
| **Check constraints** | Same migration file lines 162-200 | "Four examples: non-empty product name, non-negative price/stock, discount in 0–100, rating in 1–5, order quantity > 0. Database refuses garbage even if zod is bypassed." |

---

## Lecture 9 — Query Optimization & Tuning

No code change needed for these — they're the "why" behind decisions we
already made. Reference these slides during viva to show we understand
the planner.

| Topic | Where to point | Demo line |
|---|---|---|
| Execution plans | `EXPLAIN ANALYZE SELECT … FROM store WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT 24;` will show "Index Scan using store_live_idx" — ask the examiner to run it from the Neon SQL editor. | "Partial index from Phase 12.1 wins the planner. Without it, sequential scan on every public store list." |
| Predicate pushdown | `apps/server/src/services/products.service.ts` — `findProducts()` passes `where: { deletedAt: null, isActive: true }` straight into Prisma; the SQL pushes both predicates into the table scan. | "Prisma generates the same WHERE clauses we'd write by hand. No 'select-then-filter-in-app'." |
| Access methods | Every `@@index` in `packages/db/prisma/schema.prisma` is an explicit B-tree. Partial index `store_live_idx` from migration `20260426030000_phase_12_1_store_live_partial_index`. | "Sequential scan vs index scan — Postgres picks based on pg_statistic. Our partial index covers the hot 'live stores' subset." |
| Join methods | `prisma.product.findMany({ include: { store: true, items: true } })` becomes a hash join under the hood for the 2-3 row store + product_item joins. | "Hash join because the inner side is small. Nested loop would win if we were joining a 4-row stores table to 1M products." |

---

## Role rotation runbook (post-migration ops, NOT in this PR)

The migration creates `metu_app` and `metu_analytics` as `NOLOGIN`
roles. To enable a real runtime rotation, follow this sequence in
production:

1. **Set passwords** via Neon SQL editor (privileged session):
   ```sql
   ALTER ROLE metu_app       LOGIN PASSWORD '<32+ chars from secrets manager>';
   ALTER ROLE metu_analytics LOGIN PASSWORD '<32+ chars from secrets manager>';
   ```

2. **Build new connection string** — same host/port/database as the
   existing `DATABASE_URL`, but swap the user + password:
   ```
   postgresql://metu_app:<new-password>@<host>:<port>/<db>?sslmode=require
   ```

3. **Rotate the Fly secret** for the API server (runtime traffic):
   ```sh
   flyctl secrets set -a metu-api DATABASE_URL='<the new metu_app URL>'
   ```
   Leave `DATABASE_URL_UNPOOLED` pointing at the admin role — the
   release_command in `fly.server.toml` uses it for `prisma migrate
   deploy`, which needs DDL privileges that `metu_app` lacks by design.

4. **Verify** — after Fly redeploys, hit `/health` then look at Fly
   logs for any `permission denied for table` errors. None expected;
   the migration grants every privilege the runtime uses on every
   existing table + future tables.

5. **Backout** — set `DATABASE_URL` back to the admin connection.
   Zero data loss; only the credential changes.

This runbook is documented but NOT executed in Phase 13.6.5 — the
demo viva can show the roles existing in `\du` without disrupting
production traffic.

---

## Verification checklist

After the migration ships (Fly release_command runs it as part of the
next deploy), confirm:

| Check | Command (Neon SQL editor or local psql) | Expected |
|---|---|---|
| Trigger on product | `\d+ "product"` | "Triggers: product_touch_updated_at BEFORE UPDATE" |
| Trigger on review | `\d+ "product_review"` | "Triggers: review_delete_audit AFTER DELETE" |
| Views exist | `\dv` | `live_stores_view` and `product_with_avg_rating_view` listed |
| Roles exist | `\du` | `metu_app` and `metu_analytics` shown with "Cannot login" |
| Check constraints | `\d+ "product_review"` | "Check constraints: product_review_rating_range CHECK (rating BETWEEN 1 AND 5)" |
| Audit isolation | `SELECT has_table_privilege('metu_analytics', 'audit_log', 'SELECT');` | `f` (false) |
| App still works | `curl https://metu-api.fly.dev/health` | 200 |
| Tests still green | `npm test -w @metu/server` | 42/42 |

---

## Files in this PR

- `packages/db/prisma/migrations/20260428151458_phase_13_6_5_cpe241_rubric_features/migration.sql` — the entire SQL retrofit.
- `packages/db/prisma/schema.prisma` — adds `Product.updatedAt` (the trigger's backing column).
- `docs/rubric-coverage.md` — this file.
- `apps/web/app/admin/changelog/page.tsx` — Phase 13.6.5 card.
