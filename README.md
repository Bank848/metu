# METU — Digital Marketplace Platform

> **CPE241 Database Systems · KMUTT · Group 8 · Live demo build**
>
> 🚀 **Live web:** https://metu.online
> 🔌 **Live API:** https://metu-api.fly.dev (health: https://metu-api.fly.dev/health)
> 📜 **Changelog:** https://metu.online/admin/changelog (admin login required)
> 🛡️ **Pentest summary:** [.claude/PENTEST_SUMMARY.md](./.claude/PENTEST_SUMMARY.md) — 5 cycles, 0 P0/P1 open
> 📐 **Rubric coverage matrix:** [docs/rubric-coverage.md](./docs/rubric-coverage.md) — every Lecture 9 + 10 topic mapped to file:line
> 🎨 **Design:** Dark space-theme · Thai-leaning catalog · THB pricing

A dark-mode marketplace for Thai digital creators — templates, music, courses, art.
Built to exercise a normalized relational schema (27 entities, crow's-foot ER)
end-to-end on Postgres + Prisma, with a clean **client / server split**:

- **`apps/web`** — Next.js 15 BFF (Server Components + Route Handlers as proxies)
- **`apps/server`** — Express + layered routes/controllers/services/models, owns Prisma + JWT cookie
- **`packages/db`** — Prisma schema + migrations + seed (single source of truth)
- **`packages/shared`** — zod schemas + TS enums consumed by both web and server

Live deployment is **two Fly.io machines** in `sin` region:
`metu` (web) talks to `metu-api` (server) over the internal network. Postgres lives on **Supabase** (Singapore, `ap-southeast-1`).

![Status](https://img.shields.io/badge/status-demo--ready-FBBF24?style=flat-square) ![Stack](https://img.shields.io/badge/stack-Next.js%20%7C%20Express%20%7C%20Postgres%20%7C%20Prisma%20%7C%20Stripe%20Connect-1F2937?style=flat-square) ![Tests](https://img.shields.io/badge/tests-202%20server%20%7C%2037%20web%20%E2%9C%85-22C55E?style=flat-square)

## Quick start (local dev)

Requires Node 20+ and Docker Desktop.

```bash
# 1. Install all workspace deps
npm install

# 2. Boot Postgres + Adminer
docker compose up -d

# 3. Generate Prisma client + apply migrations + seed demo data
npm run db:generate
npm run db:migrate
npm run db:seed

# 4. Start BOTH services in parallel terminals
npm run dev -w @metu/web        # :3000 — Next.js BFF
npm run dev -w @metu/server     # :4000 — Express API
```

## URLs (local)

| Service               | URL                                |
|-----------------------|------------------------------------|
| Next.js BFF           | http://localhost:3000              |
| Next API proxies      | http://localhost:3000/api/*        |
| Express API           | http://localhost:4000              |
| Express health        | http://localhost:4000/health       |
| Adminer               | http://localhost:8081              |

Adminer login: System `PostgreSQL` · Server `db` · User `metu` · Password `metu` · DB `metu`

The Next BFF forwards every `/api/**` request to Express via the `forwardToApi`
helper in `apps/web/lib/server/proxy.ts` — set `INTERNAL_API_URL=http://localhost:4000`
in `apps/web/.env.local` (default fallback).

## Demo accounts (seeded)

| Role   | Email              | Notes                              |
|--------|--------------------|------------------------------------|
| admin  | admin@metu.dev     | Full /admin access                 |
| seller | seller@metu.dev    | Owns Kluay Studio after `db:seed` (deleted on prod — use the live stores below) |
| buyer  | buyer@metu.dev     | Has past orders + active cart      |

Demo passwords are kept out of public docs — see `packages/db/seed.ts`
for the values used in a fresh local seed, or ask the project owner for
live-prod credentials.

### Live stores on prod

Two demo stores live at `/store/5` (Pixel Forge Bangkok, indie game-dev
catalogue) and `/store/6` (Aurora Creative Lab, mixed digital assets).
30 products each, all 10 categories, all 4 delivery methods, both
Stripe-Connect ready in test mode.

Seeded via `tsx scripts/seed-aurora-store.mts` and
`tsx scripts/seed-pixelforge-store.mts`. Both idempotent — re-running
skips existing names.

## Monorepo layout

```
metu/
├── docker-compose.yml          # postgres:16 + adminer + (mongo, opt-in)
├── fly.toml                    # web app  (metu)
├── fly.server.toml             # api app  (metu-api)
├── apps/
│   ├── web/                    # Next.js 14 BFF · App Router · Tailwind · TS
│   │   ├── app/                # Server Components + page routes
│   │   ├── app/api/            # Thin proxies → Express via forwardToApi
│   │   ├── components/         # Design-system primitives (Phase 9 rebrand)
│   │   └── lib/server/proxy.ts # Cookie-preserving forwarder (Phase 13.2)
│   └── server/                 # Express API · TS · NodeNext modules
│       └── src/
│           ├── routes/         # 1 file per resource (auth/cart/orders/…)
│           ├── controllers/    # Validate request → call service → shape response
│           ├── services/       # Pure business logic + Prisma queries
│           ├── models/         # Zod schemas + DTO interfaces
│           ├── middleware/     # auth, cors, error, logger, seller (requireStore)
│           ├── utils/          # AppError, audit, email, profanity, turnstile
│           └── db/prisma.ts    # Singleton client
└── packages/
    ├── db/                     # Prisma schema + migrations + seed
    └── shared/                 # Zod schemas + TS enums (consumed by web + server)
```

## Tech stack

- **Frontend:** Next.js 15 · TypeScript · Tailwind · lucide-react · Framer Motion · Sentry
- **Backend:** Express · TypeScript · Zod · pino
- **Auth:** [better-auth](https://www.better-auth.com) owns the cookie (Mode A); Google OAuth, TOTP via otplib, in-house phone OTP (Firebase optional)
- **Payments:** Stripe Connect TH, direct-charge model with `application_fee`. Webhooks for `payment_intent.succeeded`, `account.updated`, `charge.refunded`
- **Email:** Resend with branded HTML + plain-text fallback
- **Database:** Postgres 17 on Supabase (`ap-southeast-1`) in prod, docker postgres 16 locally · Prisma
- **Tests:** Vitest + supertest server-side · Vitest for web helpers · Playwright 4-persona smoke
- **Infra:** docker compose locally · two Fly.io machines (`sin` region) in prod

## Architecture: why we split (Phase 13)

Originally everything ran in `apps/web` (Next route handlers calling Prisma directly).
**Phase 13** restructured into two services for architectural cleanliness — code
review is easier, the demo viva can point at named layers, and the door is open
for a future mobile or 3rd-party API consumer.

```
                 Browser
                    │ HTTPS (cookie)
                    ▼
       ┌────────────────────────────┐
       │   metu.online              │   apps/web  (Next.js BFF)
       │   • Server Components      │
       │   • Client Components      │
       │   • /api/* → forwardToApi  │
       └────────────┬───────────────┘
                    │ internal fetch + cookie passthrough
                    ▼
       ┌────────────────────────────┐
       │   metu-api.fly.dev         │   apps/server  (Express)
       │   routes → controllers     │
       │   services → models        │
       │   middleware → utils       │
       └────────────┬───────────────┘
                    │ Prisma
                    ▼
       ┌────────────────────────────┐
       │   Supabase Postgres (sin)  │
       └────────────────────────────┘
```

Phase 13 split is **complete** — every resource (catalog, auth, cart+coupons,
orders, reviews, q&a, favorites+stock-alerts, messages, seller, admin) lives
on the Express side. The Next BFF is pure UI + per-request server-component
queries (cached via `unstable_cache`).

## Scripts

| Command                              | Purpose                                |
|--------------------------------------|----------------------------------------|
| `npm run docker:up`                  | Boot Postgres + Adminer                |
| `npm run docker:down`                | Stop containers                        |
| `npm run docker:reset`               | Wipe volumes + reboot                  |
| `npm run db:generate`                | Regenerate Prisma client               |
| `npm run db:migrate`                 | Dev migrate (creates a new migration)  |
| `npm run db:seed`                    | Load demo data                         |
| `npm run db:reset`                   | Drop + migrate + seed                  |
| `npm run db:studio`                  | Open Prisma Studio                     |
| `npm run dev -w @metu/web`           | Start Next.js BFF (`:3000`)            |
| `npm run dev -w @metu/server`        | Start Express API (`:4000`)            |
| `npm run build -w @metu/web`         | Production build (Next)                |
| `npm run build -w @metu/server`      | Compile TypeScript (Express)           |
| `npm test -w @metu/web`              | Web Vitest (37 tests)                  |
| `npm test -w @metu/server`           | Server Vitest + supertest (202 tests)  |
| `npm run db:er-schema`               | Regenerate `apps/web/lib/admin/er-schema.ts` from Prisma (run after every schema edit so /admin/er-diagram stays accurate) |
| `tsx scripts/seed-aurora-store.mts`  | Populate store 6 (Aurora Creative Lab) with 30 demo products |
| `tsx scripts/seed-pixelforge-store.mts` | Populate store 5 (Pixel Forge Bangkok) with 30 demo products |
| `tsx scripts/seed-stripe-accounts.mts` | Auto-provision Custom Stripe Connect accounts for every store missing one (sandbox magic values) |
| `tsx scripts/check-stripe-status.mts` | Read-only check of Stripe Connect rollout status across all stores |

## How the ER diagram maps to Prisma

Our source ER (crow's-foot) has 18 entities. We kept all 18 and added later-phase
tables on top:

- **`cart_item`** (initial extension): line-items only existed on `order`,
  leaving the active-cart state un-modelled. `cart_item` lets us demo
  "items-in-cart" cleanly with a plain `cart_id + product_item_id` junction.
- **`product_question` + `stock_alert` + `password_reset_token` + `audit_log`**
  (Phase B → D): Q&A under reviews, restock-notify bell, forgot-password flow,
  destructive-action audit trail.
- **`message`** (Phase B): buyer ↔ seller direct messaging — threads derived
  at query time from the (sender, recipient) pair, no separate Conversation table.

Two notable invariants enforced at the application layer:

- `Cart.userId` is **not unique** (a user has many historical carts, only one
  `active` at a time). The "one active cart per user" rule lives in `services/cart.service.ts`.
- `StoreStats.rating` is stored as integer × 10 (e.g. 47 = 4.7★) to avoid
  decimal precision drift in aggregation.

## CPE241 rubric coverage (Lecture 9 + 10)

Phase 13.6.5 added a **rubric retrofit** so every classical RDBMS feature the
exam covers has a concrete file:line in the codebase:

| Topic | Where |
|---|---|
| Transactions + ACID | `apps/server/src/services/cart.service.ts` (checkout `$transaction`) |
| Triggers | `packages/db/prisma/migrations/20260428151458_phase_13_6_5_cpe241_rubric_features/migration.sql` — 2 triggers |
| Views | Same migration — `live_stores_view` + `product_with_avg_rating_view` |
| Permissions (GRANT/REVOKE) | Same migration — `metu_app` (runtime) + `metu_analytics` (read-only, denied audit_log) |
| Check constraints | Same migration — 6 constraints across product / product_item / product_review / order_item |
| Indexes / Query plans | `packages/db/prisma/migrations/20260426030000_phase_12_1_store_live_partial_index/` (partial index) + every `@@index` in schema |

Full matrix at [docs/rubric-coverage.md](./docs/rubric-coverage.md).

## Phase checklist

Granular history at https://metu.online/admin/changelog — each card links to
the GitHub commit. Summary:

| Phase | Scope |
|---|---|
| **0–8** | Initial build per [PLAN.md](./PLAN.md) |
| **A–F** | Dark redesign · Thai catalog · Avatar dropdown · Search · Bug audit · Initial Vercel merge |
| **9** | Visual rebrand — design tokens, surface variants, Framer Motion, asymmetric grids |
| **10** | Authoring + messaging — Q&A label fix, admin moderation, form primitives, buyer inbox |
| **11** | QA workflow — tester → CEO → 8 specialists pattern; 50+ findings closed |
| **11.1–11.2** | Hotfixes — `/browse` overflow + StatCard font + KPI compaction |
| **12.1** | Partial index on `store(deletedAt)` for live-stores hot path |
| **12.2** | User moderation columns (bannedAt + bannedReason) + admin UI |
| **13.1** | Backend separation — Express API + Next BFF (catalog read first) |
| **13.2 / 13.2.1** | Auth + forgot/reset password migrated |
| **13.3** | Cart + coupons migrated |
| **13.4** | Orders + checkout migrated |
| **13.5** | Reviews + admin moderation migrated |
| **13.6** | Q&A + admin moderation migrated |
| **13.6.5** | **CPE241 rubric retrofit** — triggers + views + roles + check constraints |
| **13.7** | Favorites + stock alerts migrated |
| **13.8** | Messages migrated (Postgres path; MongoDB sidecar deferred) |
| **13.9.1 / 13.9.2** | Seller dashboard reads + writes migrated (12 routes total) |
| **13.10 / 13.11** | Admin module migrated; legacy flat routers gone (Next is pure UI/BFF) |
| **14** | better-auth integrated — Google OAuth + account linking + verification table |
| **15.x** | Rate-limit login, sessions UI, force-logout, OTP on sensitive ops, force-password-reset |
| **16.x** | Store suspend/resume, TOTP 2FA enrolment, Mode A swap (better-auth owns every cookie) |
| **22, 23.x** | Helmet headers + signed `metu_pv` cookie; session list + revoke + recent-2FA gate |
| **24** | In-house ER diagram renderer (dagre layout, crow-foot SVG, PNG/SVG export). Source: `er-schema.ts` regen'd from Prisma |
| **26, 27** | Feature trim · Stripe Connect direct-charge with `application_fee` + hosted onboarding |
| **32, 33** | Auto-provision Custom Connect accounts for seed stores · order delivery state machine |
| **38, 41** | Master + per-store coupons · mandatory verify-at-register (email + phone) |
| **42–44** | Pre-defense bug sweeps — own-store guard, Stripe filter on /browse, plain-English errors, URL hardening, OAuth user-create fix, admin dropdown flip-up |
| **45** | Schema aligned with the submitted docx report — Product gains `deliveryMethod` + `isStackable`, ProductItem requires `name`, Order gets a direct `userId` FK, `OrderItem.pricePerUnit` Decimal(12,2), new `ProductDetail` table, `TransactionType` drops `refund` |
| **46** | Stripe checkout fix (pass `stripeAccount` to `loadStripe`) · Firebase Phone Auth wired but opt-in (env-gated) |
| **47** | 25 missing `loading.tsx` skeletons added across admin/seller/public · ER diagram drag-from-anywhere + fullscreen mode · TopNav category chips point at real IDs · Stripe banner self-fetches so it disappears post-onboarding |
| **48 — gift flow** | Gift order redemption with HMAC token, signup handoff, recipient email branding · buyer reclaim before recipient views · self-gift block · cart badge refresh after checkout |
| **49 — login + 2FA polish** | Login redesign single-column · backup codes accepted on `/login`, `/auth/totp/disable`, `/change-password`, `TotpStepUpModal` · disable-2FA requires TOTP or backup code · `/admin/database` step-up prompt · DOB picker switched to Y/M/D dropdowns on register |
| **50 — admin earnings** | Platform-fee KPI on `/admin` overview · revenue chart converted from bars to line + area · tag-insights table with top-3 categories per tag · `/seller/analytics` Bangkok-TZ daily aggregation |
| **51 — browse hardening** | Custom-tag input + Shop name + Budget range slider on filter panel · sticky-sidebar overscroll fix · price/q/shop param zod-clamped + ILIKE wildcard escape · DeliveryMethod enum cast |
| **52 — pentest cycle 5 + perf** | 4 small fixes from R1 sweep (debug `console.log` removed, `order.paid` audit emit, browse param clamp, coupon startDate +5y cap) · home/browse SSR queries cached 60s-5min (TTFB ~3s → ~0.6s) |
| **53 — coupon + tag CRUD** | Seller can edit and delete coupons (404-scoped, refuse delete if redeemed) · `TagInput` accepts free-form names; `resolveTagIds()` server helper creates new `product_tag` rows on demand |
| **Cycles 1-5 pentest** | 4 cycles closed pre-defense (~150 surfaces, 0 P0/P1 open) + cycle 5 R1+R2 deployed (DEMO_REVEAL_TOKENS unset on prod, browse hardening, audit emit). See [.claude/PENTEST_SUMMARY.md](./.claude/PENTEST_SUMMARY.md) |

## Production deploy (Fly.io)

We deploy as **two Fly apps**:

```bash
# Server (Express API)
flyctl deploy --config fly.server.toml -a metu-api --remote-only

# Web (Next.js BFF)
flyctl deploy -a metu --remote-only
```

Both deploys run a release_command — `metu-api`'s release runs
`prisma migrate deploy --schema=packages/db/prisma/schema.prisma` against
`DATABASE_URL_UNPOOLED` (the Supabase **session** pooler at port 5432 —
the IPv6-only `db.<ref>.supabase.co` direct host doesn't reach Fly's
IPv4 egress, and the transaction pooler at 6543 strips the advisory
locks Prisma Migrate needs).

Required Fly secrets:

```sh
# metu-api
flyctl secrets set -a metu-api \
  DATABASE_URL='postgresql://postgres.PROJECTREF:PASSWORD@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1' \
  DATABASE_URL_UNPOOLED='postgresql://postgres.PROJECTREF:PASSWORD@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres' \
  JWT_SECRET='<32+ bytes>' \
  CORS_ORIGIN='https://metu.online'

# metu (web BFF) — uses the same DATABASE_URL pair for SSR Prisma queries
flyctl secrets set -a metu \
  DATABASE_URL='...' \
  DATABASE_URL_UNPOOLED='...' \
  INTERNAL_API_URL='https://metu-api.fly.dev'
```

### Optional secrets

```sh
# Google OAuth (used by better-auth)
flyctl secrets set -a metu-api \
  GOOGLE_CLIENT_ID='...apps.googleusercontent.com' \
  GOOGLE_CLIENT_SECRET='...'

# Stripe Connect (test mode)
flyctl secrets set -a metu-api \
  STRIPE_SECRET_KEY='sk_test_...' \
  STRIPE_WEBHOOK_SECRET='whsec_...' \
  STRIPE_CONNECT_RETURN_BASE='https://metu.online'
flyctl secrets set -a metu \
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY='pk_test_...'

# Resend (email)
flyctl secrets set -a metu-api \
  RESEND_API_KEY='re_...' \
  RESEND_FROM='onboarding@resend.dev'

# Firebase Phone Auth — optional, Spark plan gives 10 free SMS/day
flyctl secrets set -a metu \
  NEXT_PUBLIC_FIREBASE_API_KEY='AIzaSy...' \
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN='<project>.firebaseapp.com' \
  NEXT_PUBLIC_FIREBASE_PROJECT_ID='<project-id>'
flyctl secrets set -a metu-api \
  FIREBASE_SERVICE_ACCOUNT_JSON='<paste the entire JSON file content>'

# Demo mode (LOCAL DEV ONLY — never set on a real prod) — surfaces OTPs
# and email-verify tokens on screen so reviewers without inbox access
# can register without real SMS/email. Setting on production leaks raw
# one-shot tokens via the register/resend response body. Cycle 5 R1
# flagged this as P0 when it was set on `metu-api`. Keep it OFF in prod.
# flyctl secrets set -a metu-api DEMO_REVEAL_TOKENS='true'
```

When you set up the Stripe webhook endpoint in the dashboard, toggle
**"Listen to events on Connected accounts"** ON. Direct-charge
PaymentIntents live on the seller's Connect account, so a platform-
only endpoint never sees them and orders stay `pending` forever.

Both apps `auto_stop_machines = "stop"` with `min_machines_running = 0` —
machines hibernate after idle and auto-start on the next request. First
request after a long idle takes ~1.5 s; subsequent requests are sub-second.

## Troubleshooting

**`ECONNREFUSED` from server:** Postgres hasn't finished booting.
`docker compose logs db` and wait for *"database system is ready to accept connections"*.

**Prisma client not found:** run `npm run db:generate` after `npm install`.

**Web returns 500 with "fetch failed" on `/api/*`:** `INTERNAL_API_URL` env
isn't set or Express isn't running. Either start `npm run dev -w @metu/server`
or set `INTERNAL_API_URL=https://metu-api.fly.dev` to hit prod.

**Port already in use:** Change `PORT` in `apps/web/.env.local` /
`apps/server/.env`, or stop the conflicting process. Adminer's port 8081 was
chosen specifically to avoid common conflicts.

**Windows file-lock on Prisma generate:** stop the dev server first, then run
`npm run db:generate`. Windows holds the native DLL open.

**Fly deploy reports timeout but the app still works:** known false positive
when machines are auto-stopped — the rolling update completes, the health
check fires before auto-start. Curl the URL once to wake the machine; if it
returns 200, the deploy succeeded regardless of the CLI exit code.

## Credits

Built by Group 8 for CPE241 Database Systems at KMUTT.
Brand direction from the team's own Canva pitch deck.
Imagery courtesy of Unsplash and pravatar.cc.
Lecture 11 inspiration on polyglot persistence (Postgres + the optional
MongoDB sidecar) credited in the changelog.
