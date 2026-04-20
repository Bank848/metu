# METU · Deployment Guide

> Single-origin Vercel deploy — the Next.js app contains **both** the frontend pages
> **and** the API route handlers. No separate backend to run.

---

## Architecture

- **Hosting:** Vercel (free tier)
- **Database:** Neon Postgres (free tier) — https://neon.tech
- **Images:** Unsplash, picsum.photos, api.dicebear.com (public CDNs; nothing self-hosted)
- **Auth:** JWT in httpOnly cookie (no third-party auth provider)
- **Local dev:** Docker Postgres + `npm run dev -w @metu/web` — the old Express
  server in `apps/api` still runs for backward compatibility but is **not** used
  in production. All frontend calls hit `/api/*` on the same origin.

---

## One-time setup (do this once)

### 1. Create a Neon Postgres project
1. Sign up at https://neon.tech (GitHub login works).
2. Create a project named `metu-demo`.
3. In the dashboard, copy the **pooled** connection string (looks like
   `postgresql://metu_owner:XYZ@ep-…-pooler.region.aws.neon.tech/metu?sslmode=require`).
4. Also copy the **direct** (unpooled) connection string — needed for migrations.

### 2. Push this repo to GitHub
```bash
cd metu
git init
git add .
git commit -m "chore: initial METU demo build"
gh repo create metu --public --source=. --remote=origin --push
# or create an empty repo on github.com/<you>/metu and:
# git remote add origin https://github.com/<you>/metu.git
# git branch -M main
# git push -u origin main
```

### 3. Seed the Neon database from your laptop
```bash
# Point locally at Neon temporarily
export DATABASE_URL="<direct connection string from Neon>"
npm run db:migrate   # applies all migrations (init + cart_user_many + add_cart_item)
npm run db:seed      # creates 12 users, 4 stores, 26 products, 15 orders, etc.
```

Verify in Neon's SQL console:
```sql
SELECT COUNT(*) FROM product;   -- 26
SELECT email FROM "users" WHERE email LIKE '%@metu.dev';
```

### 4. Create the Vercel project
1. Go to https://vercel.com/new and import your GitHub `metu` repo.
2. **Important — set these in the import wizard:**
   - **Root directory:** `apps/web`
   - **Framework preset:** Next.js (auto-detected)
   - **Build command:** leave default (`next build`)
   - **Install command:** `npm install --include=dev`
3. Environment variables (add at import time, Production + Preview + Development):
   - `DATABASE_URL` = **pooled** Neon string
   - `JWT_SECRET`   = `openssl rand -hex 32` output (any 64-char hex)
   - `NODE_ENV`     = `production`
4. Click **Deploy**. First build takes 2–3 min (Prisma client generation + Next compile).

### 5. Add the Vercel URL to the README
Once deployed, add the live URL to the top of `README.md` so teammates can find it.

---

## Pushing updates

`git push origin main` triggers an auto-deploy on Vercel. The deploy status is at
https://vercel.com/<you>/metu/deployments.

**Rollback:** in the Vercel dashboard, click any previous deployment → "Promote to Production".

---

## Resetting the demo data on Neon

When the marketplace state drifts (orphan orders, random new accounts, etc.)
and you want a clean slate before a presentation:

```bash
# On your laptop, pointed at Neon
export DATABASE_URL="<direct Neon string>"
npm run db:reset     # drops + re-migrates + re-seeds
```

This gives you back the three demo accounts with fresh stories:

| Role   | Email              | Password   |
|--------|--------------------|------------|
| admin  | admin@metu.dev     | Admin#123  |
| seller | seller@metu.dev    | Seller#123 |
| buyer  | buyer@metu.dev     | Buyer#123  |

---

## Smoke-test checklist after first deploy

- [ ] https://<url>/api/health → `{"status":"ok","db":"connected"}`
- [ ] https://<url>/ → dark landing, hero "DIGITAL MARKETPLACE", stat cards populated
- [ ] https://<url>/browse → grid of 16 products with ฿ pricing
- [ ] Log in as `buyer@metu.dev` → dropdown shows "My orders"
- [ ] Add to cart → apply coupon `METU10` → checkout → confetti
- [ ] Log in as `admin@metu.dev` → `/admin/reports` → 5 charts load, "View SQL" works
- [ ] Images from `picsum.photos` and `api.dicebear.com` load (no 403)

---

## Troubleshooting

**`PrismaClientInitializationError: Environment variable not found: DATABASE_URL`**
→ Add `DATABASE_URL` to all three Vercel env scopes (Prod + Preview + Dev).

**`Error: @prisma/client did not initialize yet`**
→ Make sure the `postinstall` script in `apps/web/package.json` runs on Vercel
(it calls `prisma generate --schema=../../packages/db/prisma/schema.prisma`).
Check the build log for a "Running prisma generate" line.

**Images broken on production**
→ Confirm `apps/web/next.config.mjs` lists `images.unsplash.com`, `picsum.photos`,
`i.pravatar.cc`, `api.dicebear.com` in `remotePatterns`. We pass `unoptimized`
on all `<Image>` tags so Vercel's image optimizer doesn't need to fetch them.

**Cold start on first request**
→ First hit after 5 min idle takes ~2s on Vercel free tier. Warn teammates to
refresh once if the first page hangs.

**Prisma "query_engine-windows.dll.node: EPERM" during local generate**
→ Windows locks the DLL while any node process is using it. Run
`taskkill /F /IM node.exe` then retry `npm install` or `npm run db:generate`.

**Cookie says `secure: true` in prod but I'm testing on http://**
→ Expected. Vercel always serves over HTTPS, so secure cookies work. If you
preview locally with `next start` on http, the auth cookie won't set — use
`npm run dev` (which sets `secure: false` automatically).

---

## What's different between local dev and Vercel

| | Local dev | Vercel production |
|---|---|---|
| Database | `docker compose up -d` (Postgres on :5432) | Neon (pooled URL) |
| API layer | `apps/web/app/api/*` (or `apps/api` Express if NEXT_PUBLIC_API_URL is set) | `apps/web/app/api/*` only |
| Cookie `secure` | `false` | `true` |
| Image optimization | `unoptimized` | `unoptimized` |
| Adminer UI | http://localhost:8081 | Neon SQL console (web) |

---

## Estimated cost

- Vercel free tier: 100 GB bandwidth/mo, unlimited deploys. **$0**.
- Neon free tier: 0.5 GB storage, 191.9 compute hours/mo. **$0** for this demo.

Total ongoing cost: **$0**. The only real constraint is the Neon 1 project cap
on the free plan — don't create more than one Neon project per free account.
