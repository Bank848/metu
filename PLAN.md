# METU — Digital Marketplace Platform

**Course:** CPE241 Database Systems · KMUTT · Group 8
**Purpose:** Runnable, visually-polished demo web app for live presentation
**Language:** English UI only

---

## 1. Monorepo Structure

```
metu/
├── docker-compose.yml          # web, api, db (postgres:16), adminer
├── .env.example
├── package.json                # root (pnpm workspaces)
├── pnpm-workspace.yaml
├── README.md                   # quick-start + demo credentials
├── PLAN.md                     # this file
├── PRESENTATION.md             # 5-min demo script (added in Phase 8)
│
├── apps/
│   ├── web/                    # Next.js 14 App Router + TS + Tailwind + shadcn/ui
│   │   ├── app/
│   │   │   ├── (public)/       # landing, browse, product detail
│   │   │   ├── (buyer)/        # cart, checkout, orders, profile
│   │   │   ├── (seller)/       # seller dashboard
│   │   │   ├── (admin)/        # admin panel
│   │   │   ├── (auth)/         # login, register
│   │   │   └── api/            # Next.js route handlers (thin proxy to Express if needed)
│   │   ├── components/
│   │   ├── lib/
│   │   ├── middleware.ts
│   │   └── tailwind.config.ts
│   │
│   └── api/                    # Express + TS + Prisma
│       ├── src/
│       │   ├── routes/
│       │   ├── controllers/
│       │   ├── services/
│       │   ├── middleware/
│       │   ├── lib/prisma.ts
│       │   └── server.ts
│       └── tsconfig.json
│
└── packages/
    ├── db/                     # Prisma schema + migrations + seed
    │   ├── prisma/
    │   │   ├── schema.prisma
    │   │   └── migrations/
    │   ├── seed.ts
    │   └── package.json
    │
    └── shared/                 # Zod schemas + TS types shared by web & api
        ├── src/
        │   ├── schemas/        # one file per entity
        │   └── index.ts
        └── package.json
```

**Why monorepo:** shared Zod schemas + types between web and api without duplication; one `pnpm dev` boots everything.

---

## 2. Prisma Schema Outline (18 models)

Models and their core relations (will live in `packages/db/prisma/schema.prisma`):

| Model            | Key fields                                                           | Relations                                                           |
|------------------|----------------------------------------------------------------------|---------------------------------------------------------------------|
| **User**         | user_id (PK), username, email (unique), password, first/last_name, gender, profile_image, date_of_birth, created_date | → Country, ← UserStats(1:1), ← Store(0:1 owned), ← Cart(1:1), ← Transactions, ← Reviews, ← CouponUsages |
| **Country**      | country_id (PK), country_code, name                                  | ← Users                                                             |
| **UserStats**    | user_id (PK, FK), buyer_level, seller_level, role (enum), updated_at | → User(1:1)                                                         |
| **Transaction**  | transaction_id (PK), transaction_type (enum), user_id, total_amount, date, created_at | → User, ← Orders                                        |
| **Store**        | store_id (PK), owner_id (FK→User, unique), business_type_id, name, description, profile_image, cover_image, created_at | → User(owner, 1:1), → BusinessType, ← Products, ← Coupons, ← StoreStats |
| **StoreStats**   | stat_id (PK), store_id (FK unique), CTR, rating, response_time, updated_at | → Store(1:1)                                                 |
| **BusinessType** | type_id (PK), name, description                                      | ← Stores                                                            |
| **Category**     | category_id (PK), category_name, description                         | ← Products                                                          |
| **Product**      | product_id (PK), store_id, category_id, name, description            | → Store, → Category, ← ProductItems, ← ProductImages, ← Reviews, ↔ Tags (via ProductNTag) |
| **ProductItem**  | product_item_id (PK), product_id, delivery_method (enum), quantity, price, discount_percent, discount_amount, created_date | → Product, ← OrderItems |
| **ProductImage** | product_id (PK, FK), product_image (TEXT)                            | → Product                                                           |
| **ProductReview**| review_id (PK), product_id, user_id, rating, comment                 | → Product, → User                                                   |
| **ProductTag**   | tag_id (PK), tag_name, tag_description                               | ↔ Products via ProductNTag                                          |
| **ProductNTag**  | junction_id (PK), product_id, tag_id                                 | → Product, → ProductTag (junction)                                  |
| **Cart**         | cart_id (PK), user_id (FK unique), status (enum), created_at, updated_at, expired_at, session_id | → User(1:1), ← Order(1:1)                   |
| **Order**        | order_id (PK), cart_id (FK), total_price, status (enum), transaction_id, created_at, updated_at, expired_at | → Cart(1:1), → Transaction, ← OrderItems    |
| **OrderItem**    | order_item_id (PK), order_id, product_item_id, coupon_id (nullable), quantity, price_at_purchase | → Order, → ProductItem, → Coupon?             |
| **Coupon**       | coupon_id (PK), store_id, code, start_date, end_date, usage_limit, discount_type, discount_value, is_active | → Store, ← CouponUsages, ← OrderItems        |
| **CouponUsage**  | usage_id (PK), coupon_id, user_id, created_at                        | → Coupon, → User                                                    |

**Enums:**
- `Gender` = male, female, other
- `CartStatus` = active, checked_out, expired
- `OrderStatus` = pending, paid, fulfilled, cancelled, refunded
- `TransactionType` = purchase, payout, refund
- `DeliveryMethod` = download, email, license_key, streaming
- `UserRole` = buyer, seller, admin
- `DiscountType` = percent, fixed

**Indexes:** add `@@index` on `store_id`, `product_id`, `user_id`, `category_id`, `created_at`, `status` (on Order/Cart), `code` (on Coupon), `email`/`username` (on User, unique).

**Cascades:** `onDelete: Cascade` on dependent children (ProductItem, ProductImage, OrderItem, CouponUsage, ProductNTag, StoreStats, UserStats).

---

## 3. Route Map

### Next.js Pages (apps/web/app)

| Path                          | Layout   | Purpose                                       |
|-------------------------------|----------|-----------------------------------------------|
| `/`                           | public   | Landing hero + featured + categories          |
| `/browse`                     | public   | Product grid with filters                     |
| `/product/[id]`               | public   | Product detail                                |
| `/store/[id]`                 | public   | Public store page                             |
| `/login`                      | auth     | Login + demo-account quick-pick               |
| `/register`                   | auth     | Register                                      |
| `/cart`                       | buyer*   | Shopping cart + coupon                        |
| `/checkout`                   | buyer*   | Mock payment + order creation                 |
| `/orders`                     | buyer*   | My orders list                                |
| `/orders/[id]`                | buyer*   | Order detail (invoice view)                   |
| `/profile`                    | buyer*   | User profile + become-a-seller                |
| `/seller`                     | seller*  | Overview stats + charts                       |
| `/seller/products`            | seller*  | Products CRUD                                 |
| `/seller/coupons`             | seller*  | Coupons CRUD                                  |
| `/seller/orders`              | seller*  | Orders inbox                                  |
| `/admin`                      | admin*   | KPI dashboard + charts                        |
| `/admin/users`                | admin*   | Users table                                   |
| `/admin/stores`               | admin*   | Stores table                                  |
| `/admin/reports`              | admin*   | Reports + SQL showcase                        |
| `/demo-reset`                 | admin*   | Truncate + re-seed button                     |

`*` = auth-gated via `middleware.ts`.

### Express API (apps/api/src/routes)

**Auth**
- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/logout`
- `GET  /auth/me`

**Public catalog**
- `GET /products` — filters: category, tags, minPrice, maxPrice, delivery, q, sort, page
- `GET /products/:id` — includes items, images, tags, store, reviews
- `GET /categories`
- `GET /tags`
- `GET /stores/:id`
- `GET /stats` — landing-page counters

**Buyer**
- `GET    /cart`
- `POST   /cart/items`
- `PATCH  /cart/items/:id`
- `DELETE /cart/items/:id`
- `POST   /coupons/validate`
- `POST   /orders` — transactional checkout
- `GET    /orders` · `GET /orders/:id`

**Profile**
- `GET   /me`
- `PATCH /me`
- `POST  /me/become-seller`

**Seller** (requires role=seller, scoped to own store)
- `GET/POST/PATCH/DELETE /seller/products`
- `GET/POST/PATCH/DELETE /seller/coupons`
- `GET   /seller/orders`
- `PATCH /seller/orders/:id/status`
- `GET   /seller/stats`

**Admin** (requires role=admin)
- `GET   /admin/stats`
- `GET   /admin/users` · `PATCH /admin/users/:id`
- `GET   /admin/stores`
- `GET   /admin/reports/:name` — revenue-by-category, top-stores, top-products, coupon-usage, signups-per-day, orders-by-status
- `POST  /admin/demo-reset`

---

## 4. Seed Data Strategy

Seed file: `packages/db/seed.ts`. Run via `pnpm db:seed`. Reset via `pnpm db:reset` (truncate CASCADE + re-seed).

**Volumes:**
- 5 countries (Thailand, USA, Japan, UK, Singapore)
- 6 business types
- 10 categories
- 15 product tags
- 12 users (1 admin, 4 sellers, 7 buyers)
- 4 stores (one per seller)
- 36 products (~9 per store) with 1–3 variants + 2–4 images + 2–5 tags + 3–8 reviews each
- 8 coupons (mix active/expired, percent/fixed)
- 15 past orders with transactions (status mix: paid, fulfilled, pending, cancelled, refunded)
- 3 active carts (buyer-in-progress demo state)

**Demo accounts** (surfaced on login page):

| Role   | Email               | Password   |
|--------|---------------------|------------|
| admin  | admin@metu.dev      | Admin#123  |
| seller | seller@metu.dev     | Seller#123 |
| buyer  | buyer@metu.dev      | Buyer#123  |

**Story seeded into data:**
- `buyer@metu.dev` has 2 past orders + 1 active cart with items (so /cart isn't empty on demo)
- `seller@metu.dev` owns a store with 8+ products, 12 orders spanning all statuses, 1 active coupon `METU10` (10% off)
- Admin sees a realistic marketplace at a glance

**Images:** Unsplash URLs (stable, free) + `i.pravatar.cc` for avatars. Store image URLs as TEXT only; no file upload.

---

## 5. Six-Phase Build Checklist

| Phase | Deliverable                                                              | Verify                                                             |
|-------|--------------------------------------------------------------------------|--------------------------------------------------------------------|
| **1** | Scaffold: monorepo, Docker, Prisma schema, health endpoints              | `docker compose up -d` boots; `/health` returns 200; `pnpm prisma migrate dev` runs |
| **2** | Seed script with rich fake data                                           | `pnpm db:seed` prints row counts; Adminer shows populated tables   |
| **3** | Design system + app shell (brand tokens, layouts, primitives, home hero) | Landing renders with hero + 4 StatCards pulled from `/api/stats`   |
| **4** | Buyer flow: home, browse, detail, cart, checkout, orders                  | End-to-end checkout as `buyer@metu.dev` creates Order + Transaction|
| **5** | Seller dashboard: overview + products/coupons/orders CRUD                 | Login as `seller@metu.dev` → create/edit/delete a product works    |
| **6** | Auth (JWT httpOnly cookie) + Profile + become-a-seller flow               | Register new user → logs in → `/profile` shows correct data        |
| **7** | Admin panel + reports (with raw SQL showcase)                             | `/admin/reports` shows ≥ 2 charts with expandable SQL text         |
| **8** | Polish: empty states, loading skeletons, animations, PRESENTATION.md, `/demo-reset` | Full 5-minute demo script runs clean on fresh DB                  |

---

## 6. Technology Choices (fixed)

- **Next.js 14 App Router + TypeScript** — modern React, fast DX, good SSR story
- **Tailwind CSS + shadcn/ui** — consistent primitives, fast to customize to our brand
- **Express + TypeScript** — separate API process, easier to demo as "backend" during presentation
- **PostgreSQL 16 + Prisma** — matches team's slide deck; Prisma = clean TS types + migrations
- **Docker Compose** — `docker compose up` = instant demo environment
- **Adminer** on `:8080` — show schema live during presentation
- **pnpm workspaces** — fast, reliable monorepo tooling
- **JWT in httpOnly cookie** — demo-grade auth; no OAuth complexity
- **react-hook-form + Zod** — shared Zod schemas between client and server
- **recharts** — dashboard charts
- **framer-motion** — subtle page transitions and hover lifts
- **canvas-confetti** — checkout success celebration

---

## 7. Non-Goals (explicit)

- No real payment gateway (mock button only)
- No real email / SMS / file upload
- No Thai i18n (English UI only)
- No OAuth / SSO
- No unit test suite (only smoke checks in the verification checklist)
- No production hardening (rate limiting, CSRF, security headers) — demo only

---

## 8. Demo Credentials (preview)

```
admin@metu.dev   / Admin#123
seller@metu.dev  / Seller#123
buyer@metu.dev   / Buyer#123
```

URLs after `docker compose up`:
- Web:    http://localhost:3000
- API:    http://localhost:4000
- Adminer: http://localhost:8081
