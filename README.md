# METU — Digital Marketplace Platform

> **CPE241 Database Systems · KMUTT · Group 8 · Live demo build**
>
> 🚀 **Live URL:** _paste your Vercel URL here after deploying — see [DEPLOY.md](./DEPLOY.md)_
> 🎬 **5-min demo script:** [PRESENTATION.md](./PRESENTATION.md)
> 🔍 **Audit log:** [AUDIT.md](./AUDIT.md)
> 🎨 **Design:** Dark space-theme matching the team's Canva mockup · Thai-leaning catalog · THB pricing

A dark-mode marketplace for Thai digital creators — templates, music, courses, art.
Built to exercise a normalized relational schema (20 entities, crow's-foot ER)
end-to-end on Postgres + Prisma + Next.js.

- **Local dev:** `docker compose up` + `npm run dev -w @metu/web`
- **Production:** deploys as a single Next.js app to Vercel + Neon — no separate backend.

![Badge](https://img.shields.io/badge/status-demo--ready-FBBF24?style=flat-square) ![Tech](https://img.shields.io/badge/stack-Next.js%20%7C%20Express%20%7C%20Postgres%20%7C%20Prisma-1F2937?style=flat-square)

## Quick start

Requires Node 20+ and Docker Desktop.

```bash
# 1. Install
npm install

# 2. Boot Postgres + Adminer
docker compose up -d

# 3. Generate Prisma client + migrate
npm run db:generate
npm run db:migrate

# 4. Seed rich demo data (users/stores/products/orders/coupons/reviews)
npm run db:seed

# 5. Start the web app (API is merged into Next.js route handlers)
npm run dev -w @metu/web     # :3000  — serves / + /api/*

# (Optional) the legacy Express server still works for backward compatibility:
# npm run dev -w @metu/api   # :4000  — set NEXT_PUBLIC_API_URL to http://localhost:4000 in apps/web/.env.local to route through it
```

## URLs

| Service         | URL                               |
|-----------------|-----------------------------------|
| Web             | http://localhost:3000             |
| Internal API    | http://localhost:3000/api/*       |
| Health          | http://localhost:3000/api/health  |
| Legacy Express  | http://localhost:4000 _(optional)_|
| Adminer         | http://localhost:8081             |

Adminer login: System `PostgreSQL` · Server `db` · User `metu` · Password `metu` · DB `metu`

## Demo accounts (seeded)

| Role   | Email              | Password   | Story                                                     |
|--------|--------------------|------------|-----------------------------------------------------------|
| admin  | admin@metu.dev     | Admin#123  | Sees marketplace-wide reports and user/store management    |
| seller | seller@metu.dev    | Seller#123 | Owns Glasswave Studio: 9 products, 8 orders, 1 active coupon |
| buyer  | buyer@metu.dev     | Buyer#123  | Has 2 past orders; start here for the buyer flow demo     |

On the `/login` page, **click any demo-account chip** to pre-fill the form.

## Monorepo layout

```
metu/
├── docker-compose.yml          # postgres:16 + adminer
├── apps/
│   ├── web/                    # Next.js 14 App Router · Tailwind · TS
│   └── api/                    # Express · TS · JWT cookies
└── packages/
    ├── db/                     # Prisma schema + migrations + seed
    └── shared/                 # Zod schemas + TS enums (shared by web/api)
```

## Tech stack

- **Frontend:** Next.js 14 · TypeScript · Tailwind CSS · lucide-react
- **Backend:** Express · TypeScript · JWT (httpOnly cookie) · Zod validation
- **Database:** PostgreSQL 16 · Prisma ORM
- **Infra:** Docker Compose · Adminer on :8081

## Scripts

| Command                         | Purpose                        |
|---------------------------------|--------------------------------|
| `npm run docker:up`             | Boot Postgres + Adminer        |
| `npm run docker:down`           | Stop containers                |
| `npm run docker:reset`          | Wipe volumes + reboot          |
| `npm run db:generate`           | Regenerate Prisma client       |
| `npm run db:migrate`            | Dev migrate                    |
| `npm run db:seed`               | Load demo data                 |
| `npm run db:reset`              | Drop + migrate + seed          |
| `npm run db:studio`             | Open Prisma Studio             |
| `npm run dev -w @metu/web`      | Start web dev server           |
| `npm run dev -w @metu/api`      | Start api dev server           |

## How the ER diagram maps to Prisma

Our source ER (crow's-foot) has 18 entities. We kept all 18 and added one
surrogate extension: **`cart_item`**. Rationale: the original ER puts line-items
only on `order`, which leaves the active-cart state un-modelled. `cart_item`
lets us demo "items-in-cart" cleanly with a plain `cart_id + product_item_id`
junction — this is the only deviation from the diagram, and it's documented in
`packages/db/prisma/schema.prisma` with an inline comment.

Two places in the schema are reflective of real demo concerns:

- `Cart.userId` is **not unique** (a user has many historical carts, only one
  `active` at a time). The "one active cart per user" invariant is enforced at
  the application layer.
- `StoreStats.rating` is stored as an integer `× 10` (e.g. 47 = 4.7★) to avoid
  decimal precision issues in aggregation.

## Presentation

See [PRESENTATION.md](./PRESENTATION.md) for the 5-minute demo script
with per-feature ER mapping and "database moments" talking points.

## Phase checklist

### v1 — Initial build (Phase 0-8)
- [x] Phase 0–8 complete — see [PLAN.md](./PLAN.md) for the original build plan.

### v2 — Dark redesign + deploy
- [x] Phase A — Dark-mode redesign matching the team's Canva mockup
- [x] Phase B — Thai-leaning catalog + THB (฿) pricing + DiceBear avatars
- [x] Phase C — Avatar-dropdown auth menu (removed duplicate Log-in button)
- [x] Phase D — Real search form in TopNav + multi-field matching (name/desc/store/tag)
- [x] Phase E — Bug audit ([AUDIT.md](./AUDIT.md)) + P0/P1 fixes
- [x] Phase F — Merge Express API into Next.js route handlers → single Vercel deploy ([DEPLOY.md](./DEPLOY.md))

## Troubleshooting

**`ECONNREFUSED` from api:** Postgres hasn't finished booting.
`docker compose logs db` and wait for *"database system is ready to accept
connections"*.

**Prisma client not found:** run `npm run db:generate` after `npm install`.

**Port already in use:** Change `API_PORT`/`WEB_PORT` in `.env`, or stop the
conflicting process. Port 8081 was chosen for Adminer so it doesn't collide
with other common setups.

**Windows file-lock on Prisma generate:** stop the api server first, then run
`npm run db:generate`. Windows holds the native DLL open.

## Neon + Vercel environment

Neon serves two connection strings per database:

- **Pooled** (default `DATABASE_URL`): hostname includes `-pooler`. Used at
  runtime — pgbouncer handles the serverless connection bursts cleanly.
- **Direct** (set as `DATABASE_URL_UNPOOLED`): hostname without `-pooler`.
  Used only by `prisma migrate deploy` during the build step because the
  pooled endpoint strips features Prisma Migrate needs (advisory locks,
  prepared statements).

Set both variables on Vercel. The build wrapper
(`apps/web/scripts/build.mjs`) automatically prefers the unpooled URL for
the migration step. Runtime reads via `lib/server/prisma.ts` keep using
the default pooled URL.

Neon scales compute to zero after ~5 min of inactivity. A Vercel Cron in
`apps/web/vercel.json` pings `/api/health` every 4 minutes to keep it
warm during demo hours — if Hobby-tier crons are unavailable, wiring an
external uptime service (UptimeRobot free tier) to the same URL works
equivalently.

## Credits

Built by Group 8 for CPE241 Database Systems at KMUTT. Brand direction from
the team's own Canva pitch deck. Imagery courtesy of Unsplash and pravatar.cc.
