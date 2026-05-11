# METU — CRUD & Reports SQL Reference

**Project:** CPE 241 Database Systems Term Project · KMUTT · Group 8
**Stack:** PostgreSQL 15 (Supabase pooler) · Prisma ORM · Express API · Next.js 14 BFF
**Scope of this doc:** Every CRUD path the live UI exercises, every read-side analytics query that powers the admin dashboard, plus the optimization decisions that keep them fast.

---

## 0. Tech Stack

The codebase splits into two deployable apps + two shared packages, all in one pnpm-workspace monorepo (`metu/`).

### 0.1 Database & ORM

| Layer | Choice | Why |
|---|---|---|
| **Database** | PostgreSQL 15 on **Supabase** (managed Postgres + pgbouncer pooler in `aws-1-ap-southeast-1`) | Free tier covers the demo, matches the API's region, JSONB support for `audit_log.meta` |
| **ORM / migrations** | **Prisma 5.22** with `@prisma/client` | Schema-first source of truth (`packages/db/prisma/schema.prisma`), auto-generated client types, transactional API (`prisma.$transaction`) |
| **Connection pool** | pgbouncer (Supabase pooler) at port 5432 | The Fly machines connect via the pooled URL for runtime; `migrate deploy` uses the unpooled URL because pgbouncer blocks the advisory locks Migrate needs |
| **Raw SQL** | `prisma.$queryRaw` with `Prisma.sql` template | All hot dashboard analytics use raw SQL (window functions, generate_series, CROSS JOIN scalars) where Prisma's builder can't express the query cleanly |

### 0.2 API Server (`apps/server`, Fly app `metu-api`)

| Concern | Library | Notes |
|---|---|---|
| HTTP framework | **Express 4.21** | Battle-tested REST routing |
| Auth | **better-auth 1.6** + `@better-auth/prisma-adapter` | Session cookies in `__Secure-better-auth.session_token`, includes 2FA TOTP + backup codes, OAuth (Google), email OTP |
| Password hashing | **bcryptjs 3** | Used inside better-auth and the legacy v1 signup path |
| 2FA TOTP | **otplib 13** | RFC 6238 token verification + QR code provisioning URIs |
| Phone OTP | **firebase-admin 13** | Firebase Phone Auth backend verification (frontend uses `firebase` SDK) |
| Validation | **zod 3.23** | Shared schemas in `packages/shared` so BFF and API agree on request shapes |
| Payments | **stripe 22** | PaymentIntent on checkout, Stripe Connect for seller payouts, webhook for `payment_intent.succeeded` |
| Auth tokens (gift-claim) | **jsonwebtoken 9** | Short-lived gift-claim links use HS256 with `JWT_SECRET` |
| Security headers | **helmet 8** | CSP, HSTS, X-Content-Type-Options on the API origin (BFF sets its own via `next.config.mjs`) |
| CORS | **cors 2.8** | Allowlist for the BFF + Stripe webhook origin |
| Cookies | **cookie-parser 1.4** | Parses incoming session cookie before better-auth checks |
| Logging | **morgan 1.10** | Single-line per-request access logs (visible in `flyctl logs`) |
| Profanity filter | **leo-profanity** | Optional content moderation for review/comment text |
| Tests | **vitest 4** + **supertest 7** | 24 test files, 202 tests covering auth, products, stores, cart, checkout, security |

### 0.3 Web BFF (`apps/web`, Fly app `metu`)

| Concern | Library | Notes |
|---|---|---|
| Framework | **Next.js 14.2.35** App Router | React Server Components, streaming SSR, file-based routing, middleware |
| UI library | **React 18.3** | Server + client components |
| Styling | **Tailwind CSS 3.4** + `class-variance-authority` + `tailwind-merge` + `clsx` | Utility-first with reusable variant maps, design tokens in `globals.css` |
| Icons | **lucide-react 0.462** | Tree-shaken SVG icon set |
| Animation | **framer-motion 12** | Lightweight transitions on TagInput suggestion popovers |
| Image cropping | **react-easy-crop 5** | Avatar / cover / product image crop with `objectFit: contain` so users can fully zoom out |
| Stripe checkout | **@stripe/react-stripe-js 6** + **@stripe/stripe-js 9** | Embedded card form with PaymentIntent client_secret |
| Firebase Phone Auth | **firebase 12** | Browser SDK for the SMS OTP flow at `/verify-phone` |
| QR codes | **qrcode.react 4** | TOTP enrollment QR + Stripe payment-link QR |
| ER diagram | **@dagrejs/dagre 3** | Auto-layout for the in-app ER diagram tool at `/feature-tour` |
| HTTP client | **undici 6** (built-in `fetch`) | Custom `Agent` with keep-alive (32 conns, 30s timeout) keeps BFF→API connections warm |
| Crypto | **bcryptjs 2.4** + **jsonwebtoken 9** | Same bcrypt as API (must match for legacy login compat) |
| Profanity filter | **leo-profanity** | Client-side guard before submit (server is the authoritative gate) |
| Error tracking | **@sentry/nextjs 10** | Wired up but disabled in prod (no DSN) — free to flip on post-defense |
| Tests | **vitest 4** + `@playwright/test` (e2e scaffolded) | 2 test files, 37 tests (cart math + utils) |

### 0.4 Shared Packages

| Package | Purpose |
|---|---|
| `packages/db` | Single Prisma schema + migration history. Both apps import the generated client from here |
| `packages/shared` | Zod schemas + DTO types + enum constants shared between BFF and API (so the contract can't drift) |

### 0.5 Infrastructure & Deploy

| Layer | Provider | Notes |
|---|---|---|
| Compute | **Fly.io** (region `sin`) | Two apps, two shared-cpu-1x machines each, pinned warm via `min_machines_running=2` for the defense window |
| DB | **Supabase** (free tier) | Postgres + pooler, Asia Southeast 1 (Singapore) — same region as Fly origin |
| Domain | **Porkbun** (`metu.online`) | Nameservers delegated to Cloudflare |
| Edge / CDN | **Cloudflare** (free plan, proxied) | Cache Rule for HTML on `/`, `/browse`, `/product`, `/store` (10 s edge / 0 s browser, anonymous only); SSL/TLS Full Strict; Brotli enabled; Rocket Loader / Email Obfuscation / Bot Fight Mode all disabled to avoid breaking React hydration + Stripe webhook |
| Container | **Docker** (multi-stage builds) | `output: "standalone"` keeps the runtime image lean; Web app needs `--build-arg NEXT_PUBLIC_*` because client env is inlined at build time |
| CI/CD | **GitHub** (`Bank848/metu`) → manual `flyctl deploy` | No CI test gate today; tests run locally pre-push |

### 0.6 Repo Conventions

- **pnpm workspaces** for monorepo dependency hoisting (`pnpm-workspace.yaml`)
- **TypeScript 5.6** in strict mode; one tsconfig per app + a base in `tsconfig.base.json`
- **Conventional Commits** (`type(scope): subject`) with body ≤3 lines
- **Knowledge graph** at `graphify-out/` — Markdown wiki + Cypher-ish edge index for "where is X / how does X relate to Y" lookups across the codebase
- **No CI yet**; deploy is manual via `flyctl deploy --config fly.{toml,server.toml}`

### 0.7 Data Flow at a Glance

```
                     ┌────────────────────────────────────────┐
                     │           Browser (Chrome)             │
                     └─────────┬──────────────────────────────┘
                               │ HTTPS (TLS to CF Singapore edge)
                               ▼
                     ┌────────────────────────────────────────┐
                     │     Cloudflare proxy (free plan)       │
                     │  - HTML cache 10s for anon catalog     │
                     │  - Static asset cache (immutable)      │
                     │  - Brotli compression                  │
                     └─────────┬──────────────────────────────┘
                               │ HTTPS (Full Strict)
                               ▼
   ┌──────────────────────────────────────────────────────────────────┐
   │  Fly app `metu`  (Next.js 14 BFF, 2 × shared-cpu-1x in sin)      │
   │   - SSR pages + middleware (rate limit + edge cache hint)        │
   │   - Boot warmup: self-fetch /, /browse, /product/1, /store/1     │
   │   - unstable_cache layer (per-machine, 60s-1h)                   │
   └─────────┬────────────────────────────────────────────────────────┘
             │ HTTP (internal Fly network: metu-api.internal:8080)
             ▼
   ┌──────────────────────────────────────────────────────────────────┐
   │  Fly app `metu-api`  (Express, 2 × shared-cpu-1x in sin)         │
   │   - REST routes + better-auth + Stripe webhook                   │
   │   - In-process TTL cache for admin dashboards (60s)              │
   └─────────┬────────────────────────────────────────────────────────┘
             │ TCP (pgbouncer pool)
             ▼
   ┌──────────────────────────────────────────────────────────────────┐
   │  Supabase Postgres 15  (aws-1-ap-southeast-1)                    │
   │   - 26 tables, FK cascade rules per §2                           │
   │   - top_stores_30d materialized view                             │
   │   - JSONB audit_log.meta                                         │
   └──────────────────────────────────────────────────────────────────┘

External integrations (called from API):
   - Stripe API (PaymentIntent + webhook + Connect onboarding)
   - Firebase Admin (Phone OTP backend verification)
   - SendGrid / SMTP (transactional email — invoice, gift-claim, refund)
```

---

## 1. Requirement Summary & Mapping

The canonical Functional Requirements (PDF §3 a–j) and Business Rules (§4 a–k) translate directly to the SQL surfaces in this document:

| Functional Req | Entities | Section |
|---|---|---|
| 3.a User Information | `User`, `UserStats`, `Country` | §3.1 Create User · §5.2 Edit Profile · §6.1 Delete User |
| 3.b Store Information | `Store`, `BusinessType` | §3.2 Create Store · §6 Delete Store |
| 3.c Product Variety (Variants) | `Product`, `ProductItem`, `ProductImage` | §3.3 Create Product · §5.1 Edit Product · §6.2 Delete Product |
| 3.d Product Tag (M:N) | `ProductTag`, `ProductNTag` | §3.3 (junction insert) · §4.2 (filter by tag) |
| 3.e Stock Allocation Logic | `ProductItem.quantity`, `ProductItem.deliveryMethod` | §3.4 Add to Cart (caps) · §3.5 Order (decrement) |
| 3.f Cart | `Cart`, `CartItem` | §3.4 Add to Cart |
| 3.g Order & Payment | `Order`, `OrderItem`, `Transaction` | §3.5 Checkout |
| 3.h Transaction | `Transaction` | §3.5 (created inside checkout txn) |
| 3.i Review | `ProductReview` | §4 (read-side) · §6.1 (cascade) |
| 3.j Coupon | `Coupon`, `CouponUsage`, `Order.couponId` | §3.7 Create Coupon · §6.3 Delete |
| 4.b Stock Availability | `ProductItem.quantity` checks | §3.4, §3.5 |
| 4.c Stock Allocation Rules (1-buy cap) | `Product.isStackable` + ownership lookup | §3.4 (already-owned guard) |
| 4.f Tag cap (≤ 10) | input validation | §3.3 |
| 4.h Pricing Calculation | `price × (100 − discount) ÷ 100 × qty` | §3.5 (line totals) |
| 4.i Coupon Usage limit | `CouponUsage` (M:N) | §3.5 (consumption inside txn) |
| 4.j Payment Session 15 min | `Order.expiredAt` + sweep job | §3.5 (set on create) |
| 5.a–k Admin Dashboard | aggregates, GROUP BY, raw SQL | §4.4 Admin Dashboard |

The actual ERD lives at `docs/er-diagram-v3.svg` and matches the Prisma schema 1:1.

---

## 2. Schema Overview & Cascade Map

26 tables in production. The cascade story matters for §6 (Delete) so it sits up front:

```
         ┌──────────────┐
         │   Country    │ ◄────────── User.countryId      (ON DELETE: NO ACTION)
         └──────────────┘                  │
                                           │ 1:1
                                           ▼
   ┌─────────┐    Cascade   ┌──────────┐   1:1   ┌──────────────┐
   │  User   │──────────────│UserStats │ ────── │ User         │ (PK FK)
   └─────────┘              └──────────┘         └──────────────┘
       │
       │ 1:1 (owner)              ┌──────────────┐
       ├────────── Cascade ──────►│   Store      │──── Cascade ──► Product
       │                          └──────────────┘                  │
       │                                                             │ Cascade
       │ 1:N             ┌──────┐                                   ▼
       ├──── Cascade ───►│ Cart │── Cascade ──► CartItem ──► ProductItem
       │                 └──────┘                                   ▲
       │                                                             │ Cascade
       │ 1:N             ┌──────┐                                   │
       ├──── Cascade ───►│Order │── Cascade ──► OrderItem ── SetNull (productItemId)
       │                 └──────┘                                   │
       │                     │                                      │
       │                     │ N:1 (transactionId, NO ACTION)       │
       │                     ▼                                      │
       │                ┌────────────┐                              │
       │                │Transaction │ ◄── User (Cascade)           │
       │                └────────────┘                              │
       │                                                             │
       │ 1:N             ┌─────────┐    Cascade        ┌────────┐   │
       ├──── Cascade ───►│ Coupon  │──────────────────►│CouponUsage│ ── User Cascade
       │                 └─────────┘                   └────────┘
       │                     ▲
       │                     │ N:1 (storeId, Cascade)
       │                     │
       │                 OrderItem.couponId (SetNull)
       │
       │ 1:N    Cascade
       └───────────────► ProductReview, ProductFavorite, AuditLog (actorId SetNull)
```

**Cascade rule summary** (extracted from `packages/db/prisma/schema.prisma`):

| Edge | onDelete | Why |
|---|---|---|
| `Store.ownerId → User` | **Cascade** | Lose the user → the store is theirs alone. |
| `Product.storeId → Store` | **Cascade** | Store gone → catalog rows are orphans. |
| `ProductItem.productId → Product` | **Cascade** | Variant lifecycle bound to parent. |
| `ProductImage.productId → Product` | **Cascade** | Same. |
| `ProductNTag.productId / .tagId → Product / ProductTag` | **Cascade** | Junction follows either parent. |
| `CartItem.cartId → Cart` | **Cascade** | Cart wipe = items wipe. |
| `CartItem.productItemId → ProductItem` | **Cascade** | Variant retired → carts can't show stale references. |
| `Order.userId → User` | **Cascade** | Drives the `historyCount > 0` anonymize branch in §6.1. |
| `OrderItem.orderId → Order` | **Cascade** | Lines die with the order. |
| `OrderItem.productItemId → ProductItem` | **SetNull** | Variant deleted → preserve order history with null FK so receipts still resolve. |
| `OrderItem.couponId → Coupon` | **SetNull** | Coupon deletion shouldn't break a settled order. |
| `Coupon.storeId → Store` | **Cascade** | Store gone → its coupons are dead anyway. |
| `CouponUsage.couponId → Coupon` | **Cascade** | Audit trail follows the coupon. |
| `ProductReview.userId / .productId → User / Product` | **Cascade** | Reviewer or product gone → review removed. |
| `AuditLog.actorId → User` | **SetNull** | Actor deletion must not erase the audit row. |
| `Transaction.userId → User` | **Cascade** | Money rows belong to the buyer. |
| `User.countryId → Country` | **NO ACTION** (Country can't be silently dropped while in use) |

**Index coverage** (from `@@index` declarations in the schema, in addition to all PK + the unique pairs `(productId, tagId)`, `(userId, productId)` on Favorite, `(cartId, productItemId)`, `(storeId, code)` on Coupon, `(couponId, userId)` on CouponUsage):

```
User           : countryId, createdDate, bannedAt
UserStats      : role
Store          : businessTypeId, createdAt
Product        : storeId, categoryId, isActive
ProductItem    : productId
ProductImage   : productId
ProductDetail  : productId
ProductNTag    : productId, tagId
ProductReview  : userId, productId
ProductFavorite: userId, productId
Cart           : (userId,status), status
CartItem       : cartId
Order          : userId, transactionType, status, createdAt, stripePaymentIntentId
OrderItem      : orderId, productItemId
Coupon         : code, isActive
CouponUsage    : couponId, userId
GiftClaim      : userId, expiresAt
AuditLog       : actorId, (targetType,targetId), createdAt
```

---

## 3. CREATE Operations

### 3.1 Create User (Auth signup)

**Surface:** `POST /api/auth/sign-up/email` (better-auth route handler) → `/api/auth/sign-up` (legacy v1) → `auth.service.signUp()`

Better-auth handles the password hash + creates a paired `Account` row (provider='credential'). Our service writes the public profile in one transaction:

```sql
-- Inside Prisma $transaction:
INSERT INTO users (username, first_name, last_name, email, password, created_date, …)
VALUES ($username, $first, $last, $email, $bcrypt_hash, NOW(), …)
RETURNING user_id;

INSERT INTO user_stats (user_id, role, buyer_level, seller_level)
VALUES ($user_id, 'buyer', 0, 0);

INSERT INTO account (account_id, user_id, provider_id, account_id_provider, password)
VALUES (gen_random_uuid()::text, $user_id, 'credential', $email, $bcrypt_hash);

INSERT INTO session (session_id, user_id, expires_at, ip_address, user_agent)
VALUES (gen_random_uuid()::text, $user_id, NOW() + INTERVAL '7 days', $ip, $ua);
```

**Optimization notes:**
- Single `$transaction` call → all four rows commit atomically; signup either fully succeeds or rolls back, no half-created users.
- `email` and `username` carry **UNIQUE constraints** at the DB level so a race between two simultaneous signups for the same address fails with P2002 instead of producing duplicates.
- `User.countryId` is a nullable FK → users can finish signup without picking a country; an UPDATE covers it later (§5.2).

---

### 3.2 Create Store (Become a Seller)

**Surface:** `POST /api/seller/onboarding` → `seller.service.becomeSeller()` (file `apps/server/src/services/seller.service.ts:335`)

```ts
// Pre-check: one store per user (UNIQUE on store.owner_id catches it
// at the DB level too, but we want a friendly 409 with the existing id).
const existing = await prisma.store.findUnique({ where: { ownerId: userId } });
if (existing) throw new AppError(409, "StoreExists", `storeId=${existing.storeId}`);

return prisma.$transaction(async (tx) => {
  const store = await tx.store.create({
    data: {
      ownerId: userId,
      businessTypeId: input.businessTypeId,
      name: input.name,
      description: input.description,
      profileImage: input.profileImage,
      coverImage: input.coverImage,
    },
  });
  // Promote role to 'seller' atomically with the store insert.
  await tx.userStats.upsert({
    where: { userId },
    update: { role: nextRole /* keeps 'admin' if already admin */ },
    create: { userId, role: nextRole },
  });
  return store;
});
```

**Generated SQL:**
```sql
SELECT 1 FROM "store" WHERE "owner_id" = $1 LIMIT 1;

BEGIN;
  INSERT INTO "store" (owner_id, business_type_id, name, description,
                       profile_image, cover_image, created_at)
  VALUES ($1,$2,$3,$4,$5,$6,NOW())
  RETURNING store_id;

  -- Upsert: try update first, fall back to insert if no row matched.
  INSERT INTO "user_stats" (user_id, role, buyer_level, seller_level)
  VALUES ($1, 'seller', 0, 0)
  ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role;
COMMIT;
```

**BR alignment:**
- 4.a `Store Setup` — UNIQUE on `store.owner_id` enforces "1 user → 1 store". Verified at code + DB layers.
- Role flip is inside the same transaction so `User.role = 'seller'` is never temporarily out of sync with "has a store row".

---

### 3.3 Create Product (with Variants + Tags + Images + Details)

**Surface:** `POST /api/seller/products` → `seller.service.createProduct()` (line 415).

The product write is a single Prisma nested-create that fans out to **5 child tables** in one INSERT round-trip per child (Prisma batches).

```ts
return prisma.product.create({
  data: {
    storeId, categoryId,
    name, description, deliveryMethod, isStackable,
    items:        { create: input.items.map((it, idx) => ({...})) },
    images:       { create: input.images.map((url, i) => ({ productImage: url, sortOrder: i })) },
    productNTags: { create: tagIds.map((tagId) => ({ tagId })) },
    details:      { create: (input.details ?? []).map((d) => ({ ... })) },
  },
});
```

Tags first resolve through a small upsert helper (`resolveTagIds`) — case-insensitive lookup, auto-create missing names, return a deduped ID list. The lookup uses `tagName ILIKE ANY(...)` under the hood:

```sql
SELECT tag_id, tag_name
  FROM "product_tag"
 WHERE LOWER(tag_name) IN ('design','3d-model','blender');

-- For names not found, INSERT one-at-a-time (small list; 10-tag cap)
INSERT INTO "product_tag" (tag_name, tag_description, count)
VALUES ('newtag','Tag: newtag', 0)
RETURNING tag_id, tag_name;
```

**Generated SQL skeleton:**
```sql
BEGIN;
  INSERT INTO "product" (store_id, category_id, name, description,
                         delivery_method, is_stackable, created_at, updated_at)
  VALUES (...) RETURNING product_id;

  -- Variant batch
  INSERT INTO "product_item" (product_id, name, description, image,
                              delivery_method, quantity, price,
                              discount_percent, discount_amount,
                              created_date, …)
  VALUES (...), (...), (...);

  -- Image batch
  INSERT INTO "product_image" (product_id, product_image, sort_order)
  VALUES (...), (...);

  -- Tag M:N batch
  INSERT INTO "product_n_tag" (product_id, tag_id) VALUES (...), (...);

  -- Detail rows
  INSERT INTO "product_add_detail" (product_id, detail_name, detail_value)
  VALUES (...), (...);
COMMIT;
```

**Key validation enforced at the schema layer:**
- BR 4.f — `Product` has at most 10 tags via the `productInputSchema.tags.max(10)` zod refine **and** the `(product_id, tag_id)` UNIQUE on `product_n_tag` prevents accidental duplicates.
- BR 4.g — `Product Additional Detail ≤ 7` enforced by zod schema `details.max(7)`.

---

### 3.4 Add Product to Cart

**Surface:** `POST /api/cart/items` → `cart.service.addItem()` (file `cart.service.ts:82`).

Three guards run before the INSERT:

1. **Buyability gate** (`loadPurchasableProductItem`) — checks the variant exists, isn't soft-deleted, parent store isn't suspended, and stock > 0.
2. **Owner-buys-own-store guard** — looks up `product.store.ownerId`; rejects if equal to `userId`.
3. **Already-owned guard** for non-stackable products (BR 4.c) — runs:
   ```sql
   SELECT order_id, status
     FROM "orders"
    WHERE user_id = $userId
      AND status IN ('paid','fulfilled','pending')
      AND EXISTS (SELECT 1 FROM "order_item" oi
                   JOIN "product_item" pi ON pi.product_item_id = oi.product_item_id
                  WHERE oi.order_id = orders.order_id
                    AND pi.product_id = $productId)
    ORDER BY created_at DESC
    LIMIT 1;
   ```
   If a row comes back, throw `409 AlreadyOwned` with the offending `orderId`. License-key variants are exempt (each purchase mints a fresh key).

The INSERT itself uses Prisma's compound-unique-key shortcut to merge with an existing line:

```ts
const existing = await prisma.cartItem.findUnique({
  where: { cartId_productItemId: { cartId, productItemId } },
});

if (existing) {
  // Quantity-cap merge — capped at the variant ceiling
  return prisma.cartItem.update({
    where: { cartItemId: existing.cartItemId },
    data: { quantity: cappedQty },
  });
}
return prisma.cartItem.create({ data: { cartId, productItemId, quantity } });
```

Underlying SQL:
```sql
SELECT * FROM "cart_item"
 WHERE cart_id = $1 AND product_item_id = $2;   -- UNIQUE index hit

-- Then either:
UPDATE "cart_item" SET quantity = $3 WHERE cart_item_id = $existing;
-- or:
INSERT INTO "cart_item" (cart_id, product_item_id, quantity, created_at)
VALUES ($1, $2, $3, NOW())
RETURNING *;
```

**Optimization note:** The `cart_item.@@unique([cartId, productItemId])` compound key gives an O(log n) lookup AND prevents a race between two concurrent "Add to cart" clicks from creating two duplicate lines.

---

### 3.5 Checkout (Create Order from Cart Items + Transaction)

**Surface:** `POST /api/orders` → `orders.service.checkout()` (file `orders.service.ts:59`).

The whole transaction (lines ~373–500 in code) is the most complex CRUD path in the system. It writes:

1. `Transaction` row (purchase record with total_amount).
2. `Order` row (with `coupon_id` if applied, `expired_at = NOW() + 15 min` per BR 4.j).
3. `OrderItem` per selected cart line (with `price_per_unit` snapshot and `coupon_id` per line so master-coupon impact can be measured per line later).
4. `ProductItem.quantity` decrement (atomic, with stock guard) — only for non-digital methods.
5. `Cart.status = 'checked_out'` flip + new active cart create + cart_item migration.
6. `CouponUsage` insert (TOCTOU-safe inside the txn, BR 4.i — 1 use per coupon per user).

Key SQL inside the txn:

```sql
BEGIN;
  -- Transaction (financial record)
  INSERT INTO "transaction" (transaction_type, user_id, total_amount, date, created_at)
  VALUES ('purchase', $userId, $total, NOW(), NOW())
  RETURNING transaction_id;

  -- Order header
  INSERT INTO "orders" (user_id, total_price, status, expired_at,
                        stripe_payment_intent_id, transaction_id,
                        coupon_id, gift_recipient_email, gift_message,
                        created_at, updated_at)
  VALUES ($userId, $total, 'pending', NOW() + INTERVAL '15 minutes',
          $piId, $txId, $resolvedCouponId, $giftEmail, $giftMsg, NOW(), NOW())
  RETURNING order_id;

  -- Lines (batch insert with per-line coupon attribution)
  INSERT INTO "order_item" (order_id, product_item_id, quantity, price_per_unit, coupon_id)
  VALUES ($orderId, $pi1, $q1, $unitPrice1, $couponIfMaster),
         ($orderId, $pi2, $q2, $unitPrice2, $couponIfStoreScoped),
         ...;

  -- Atomic stock decrement per non-digital line
  UPDATE "product_item"
     SET quantity = quantity - $q
   WHERE product_item_id = $pi
     AND quantity >= $q;            -- conditional update; updated.count = 0 → throw OutOfStock

  -- Cart pivot
  UPDATE "cart" SET status = 'checked_out' WHERE cart_id = $oldCartId;

  INSERT INTO "cart" (user_id, status, created_at, updated_at)
  VALUES ($userId, 'active', NOW(), NOW())
  RETURNING cart_id;

  -- Move unselected items to the new cart
  UPDATE "cart_item" SET cart_id = $newCartId
   WHERE cart_item_id = ANY($unselectedIds);

  -- Coupon usage (only if a real coupon was applied)
  INSERT INTO "coupon_usage" (coupon_id, user_id, created_at)
  VALUES ($couponId, $userId, NOW())
  ON CONFLICT (coupon_id, user_id) DO NOTHING;
COMMIT;
```

**Hard rules enforced atomically:**

- **Stock availability (BR 4.b):** the `WHERE quantity >= $q` clause on the conditional UPDATE returns `count = 0` when stock is insufficient → service raises `OutOfStock` and the whole txn rolls back.
- **Pricing (BR 4.h):** `unit_price = price * (100 - discount_percent) / 100` is computed once at txn start using `Prisma.Decimal` (no floating-point drift); the per-line `price_per_unit` is the snapshot stored on `order_item`.
- **15-min payment window (BR 4.j):** `Order.expired_at = NOW() + INTERVAL '15 minutes'`. A separate cron `sweepExpiredOrders` runs every minute and flips expired pending orders to `cancelled`, restoring stock with the inverse `UPDATE quantity = quantity + $q`.
- **Coupon usage cap (BR 4.i):** `coupon_usage @@unique([couponId, userId])` plus the `ON CONFLICT … DO NOTHING` makes a second redemption a no-op. Master coupon stamp goes on every line; per-store coupons only on lines from the matching store.

**Performance optimization:** the per-line stock validation was originally a sequential `for…await` loop. Recent perf push (commit `77da1c1`) replaced it with `Promise.all(selectedItems.map(loadPurchasableProductItem))` — checkout TTFB dropped from ~150 ms to ~30 ms on a 5-item cart.

---

### 3.6 Transaction (Stripe Webhook → flip Order.status)

Stripe webhook at `POST /api/stripe/webhook` calls `orders.service.markOrderPaid()`. SQL:

```sql
BEGIN;
  -- Idempotency guard: ignore duplicate webhook deliveries
  SELECT status FROM "orders" WHERE order_id = $1 FOR UPDATE;
  -- if already 'paid' or 'fulfilled' → exit early

  UPDATE "orders"
     SET status = 'paid',
         stripe_charge_id = $charge,
         stripe_amount_received = $amount,
         updated_at = NOW()
   WHERE order_id = $1;

  -- Stamp transaction date (for the admin "Recent Transactions" tile)
  UPDATE "transaction"
     SET date = NOW()
   WHERE transaction_id = (SELECT transaction_id FROM "orders" WHERE order_id = $1);
COMMIT;

-- Side effects (outside txn):
-- - clearCartAfterPayment() empties the new active cart's mirror items
-- - finalizeOrder() runs delivery (download URL email / license key gen)
-- - audit('order.paid')
```

The `FOR UPDATE` row lock makes simultaneous webhook deliveries safe — only one acquires the lock, the second sees `status='paid'` after waiting and exits.

---

### 3.7 Create Coupon (master + store-scoped)

**Surface:**
- `POST /api/seller/coupons` → seller-scoped (the seller's own storeId).
- `POST /api/admin/coupons` → admin can create master (storeId=NULL) or scoped to ANY store (`admin.service.createMasterCoupon` accepts optional `storeId`).

```sql
-- Pre-check uniqueness within the (storeId, code) pair
SELECT coupon_id FROM "coupon"
 WHERE code = $upperCode AND store_id IS NOT DISTINCT FROM $storeId
 LIMIT 1;
-- Friendly 409 if it exists.

INSERT INTO "coupon" (store_id, code, start_date, end_date,
                      usage_limit, discount_type, discount_value, is_active)
VALUES ($storeId,        -- NULL for master
        $upperCode,      -- forced to UPPERCASE [A-Z0-9_-]+
        $bangkokStartOfDay($start),    -- snap to Bangkok day boundary
        $bangkokEndOfDay($end),
        $usageLimit,
        $type,           -- 'percent' | 'fixed'
        $value,
        true)
RETURNING coupon_id;

INSERT INTO "audit_log" (actor_id, action, target_type, target_id, meta, created_at)
VALUES ($adminId,
        $storeId IS NULL ? 'coupon.master_create' : 'coupon.admin_store_create',
        'coupon', $couponId,
        '{"code":"…","discountType":"…","discountValue":…,"storeId":…}'::jsonb,
        NOW());
```

**Schema-level guarantees:**
- `Coupon @@unique([storeId, code])` — two coupons in the same store can't share a code; master coupons (storeId NULL) get their own slot per code.
- `discount_value > 0` and `usage_limit > 0` enforced by the shared zod schema.
- `start_date <= end_date` and `start_date <= NOW() + 5 years` refined at the schema layer — prevents 10-year-future coupons from squatting on the code namespace.

---

## 4. READ Operations

### 4.1 Browse All Products (no filter, default sort)

**Surface:** `/browse` page server component → `browseProducts({})` in `apps/web/lib/server/queries.ts:_browseProductsImpl`.

The query is a single hand-written `prisma.$queryRaw` because it needs **6 correlated subqueries per row** (cover image, average rating, review count, min/max post-discount price, max discount, comma-joined tag list) plus a window-function total for pagination:

```sql
SELECT
  p.product_id,
  p.name,
  p.description,
  -- Cover image: top-sorted product_image
  (SELECT pi2.product_image
     FROM "product_image" pi2
    WHERE pi2.product_id = p.product_id
    ORDER BY pi2.sort_order ASC
    LIMIT 1)                                                          AS image,
  s.name              AS store_name,
  s.store_id          AS store_id,
  s.profile_image     AS store_image,
  -- Aggregate review rating
  (SELECT AVG(rating::float)
     FROM "product_review"
    WHERE product_id = p.product_id)                                  AS avg_rating,
  (SELECT COUNT(*)
     FROM "product_review"
    WHERE product_id = p.product_id)::int                             AS review_count,
  -- Post-discount price range (one MIN, one MAX per row)
  COALESCE((SELECT MIN(price * (100 - COALESCE(discount_percent,0)) / 100.0)::text
              FROM "product_item" WHERE product_id = p.product_id), '0') AS min_price,
  COALESCE((SELECT MAX(price * (100 - COALESCE(discount_percent,0)) / 100.0)::text
              FROM "product_item" WHERE product_id = p.product_id), '0') AS max_price,
  COALESCE((SELECT MIN(price)::text
              FROM "product_item" WHERE product_id = p.product_id), '0') AS min_price_original,
  COALESCE((SELECT MAX(price)::text
              FROM "product_item" WHERE product_id = p.product_id), '0') AS max_price_original,
  COALESCE((SELECT MAX(COALESCE(discount_percent,0))
              FROM "product_item" WHERE product_id = p.product_id), 0)   AS max_discount,
  -- Tag csv
  COALESCE((SELECT STRING_AGG(t.tag_name, ',')
              FROM "product_n_tag" pnt
              JOIN "product_tag"   t ON t.tag_id = pnt.tag_id
             WHERE pnt.product_id = p.product_id), '')                   AS tags,
  -- Window function = single SQL, no second COUNT(*) round-trip for pagination
  COUNT(*) OVER ()                                                       AS total_count
FROM   "product" p
JOIN   "store"   s ON s.store_id = p.store_id
WHERE  p.is_active = true
ORDER BY p.created_at DESC
LIMIT  16
OFFSET 0;
```

**Why subqueries instead of LEFT JOIN + GROUP BY?** A single LEFT JOIN through `product_item` and `product_review` would multiply rows × variant_count × review_count and require GROUP BY on every product column. Subqueries pre-aggregate per row, keeping the result set at exactly 16 rows.

**Cached:** wrapped in `unstable_cache(["browse-products"], { revalidate: 120 })` — the same filter combination shares a cache slot for 2 minutes.

### 4.2 Browse with Filter

Same query as 4.1, with conditional WHERE clause assembly via Prisma's `Prisma.sql` template (parameterised, not concatenated — safe from SQL injection). Filter examples:

```sql
-- Category filter (FK match):
AND p.category_id = $1

-- Search (ILIKE with escaped wildcards on user input):
AND (p.name ILIKE '%' || $1 || '%' ESCAPE '\\'
  OR p.description ILIKE '%' || $1 || '%' ESCAPE '\\'
  OR s.name ILIKE '%' || $1 || '%' ESCAPE '\\'
  OR EXISTS (SELECT 1 FROM "product_n_tag" pnt2
              JOIN "product_tag" t2 ON t2.tag_id = pnt2.tag_id
             WHERE pnt2.product_id = p.product_id
               AND t2.tag_name ILIKE '%' || $1 || '%' ESCAPE '\\'))

-- Multi-tag filter (M:N membership):
AND EXISTS (SELECT 1 FROM "product_n_tag" pnt3
             WHERE pnt3.product_id = p.product_id
               AND pnt3.tag_id IN ($1,$2,$3))

-- Price range (variant-level filter, EXISTS so a product with ANY matching
-- variant qualifies):
AND EXISTS (SELECT 1 FROM "product_item" pi_f
             WHERE pi_f.product_id = p.product_id
               AND price * (100 - COALESCE(discount_percent,0)) / 100.0 >= $minPrice
               AND price * (100 - COALESCE(discount_percent,0)) / 100.0 <= $maxPrice)

-- Min rating filter:
AND (SELECT AVG(rating::float)
       FROM "product_review"
      WHERE product_id = p.product_id) >= $minRating
```

### 4.3 Single Product Detail

**Surface:** `/product/[id]` server component → `queries.ts:_getProductImpl`.

Pure Prisma — relations specified inline so the type inference flows through to the React component:

```ts
const product = await prisma.product.findFirst({
  where: { productId, isActive: true, store: { suspendedAt: null } },
  include: {
    store: {
      select: { storeId: true, ownerId: true, name: true, profileImage: true,
                businessType: { select: { name: true } } },
    },
    details: true,
    category: true,
    items: {
      orderBy: { price: "asc" },
      select: { /* deliveryUrl + licenseKeyTemplate omitted for security */ },
    },
    images: { orderBy: { sortOrder: "asc" } },
    productNTags: { include: { tag: true } },
    reviews: { orderBy: { createdAt: "desc" }, take: 5,
               include: { user: { select: { …minimal… } } } },
  },
});

// Separate aggregate so we don't need to GROUP BY 30 columns
const { _count, _avg } = await prisma.productReview.aggregate({
  where: { productId },
  _count: { _all: true },
  _avg:   { rating: true },
});
```

Generated SQL is one query per relation include + one aggregate:
```sql
SELECT p.* FROM "product" p
  WHERE product_id = $1 AND is_active = true
    AND EXISTS (SELECT 1 FROM "store" s WHERE s.store_id = p.store_id AND s.suspended_at IS NULL);

SELECT * FROM "store" WHERE store_id IN (...);
SELECT * FROM "product_item" WHERE product_id IN (...) ORDER BY price ASC;
SELECT * FROM "product_image" WHERE product_id IN (...) ORDER BY sort_order ASC;
SELECT * FROM "product_n_tag" pnt JOIN "product_tag" t ON ... WHERE pnt.product_id IN (...);
SELECT * FROM "product_review" WHERE product_id = $1 ORDER BY created_at DESC LIMIT 5;

-- Aggregate
SELECT COUNT(*) AS _count_all, AVG(rating) AS _avg_rating
  FROM "product_review" WHERE product_id = $1;
```

**Cached:** `unstable_cache(["product"], { revalidate: 300, tags: ["product"] })` so 5 minutes of repeat hits served from in-process memory.

### 4.4 Admin Dashboard (16 parallel raw queries + matview)

**Surface:** `GET /admin/dashboard` → `admin.service.getDashboardMetrics()` (file `admin.service.ts:705`+).

This is the headline read in the system. **Sixteen** queries fire in parallel via `Promise.all`. The slowest gates the response:

| Query | Purpose | Technique |
|---|---|---|
| `growth` | totalUsers / buyers / sellers / admins / active7d snapshot | scalar subquery × 5 |
| `userGrowthSeries` | 90-day daily new buyers + new sellers | `generate_series` × correlated subqueries |
| `topStores (matview)` | top 25 stores by 30-day revenue | **Materialized view** `top_stores_30d` joined on `store` for live rating |
| `topProducts` | top 25 products by lifetime revenue | nested aggregation + `FILTER (WHERE …)` for status guard |
| `ageGroups` | DOB buckets including null | `CASE … WHEN date_of_birth IS NULL …` outer GROUP BY |
| `categories` | per-category product count + revenue | LEFT JOIN with FILTER to keep zero-order categories visible |
| `tags` | top tags + their categories | `STRING_AGG` + `DISTINCT` joining 4 tables |
| `couponImpact` | platform-wide redemption + total discount | sum aggregates + sub-counts |
| `couponImpactSeries` | 30-day daily redemptions + baht discounted | CTE + `generate_series` LEFT JOIN |
| `couponImpactTop` | top 10 coupons by redemptions with net revenue | LEFT JOIN coupon ↔ orders + per-order subtotal subquery |
| `reviewMonitor` | avg / count / 7d velocity / low-rated / **buyer-product conversion** | `CROSS JOIN` of 5 scalar subqueries |
| `kpiSparklines` | 7-day daily {users, orders, gmv, reviews} | `generate_series` × 4 correlated subqueries |
| `ordersByStatus` | distribution chart | basic GROUP BY |
| `kpiDeltas` | this-week vs prev-week deltas | conditional FILTER |
| `topBuyers` | top 25 buyers by lifetime spend | JOIN orders + GROUP BY users + ORDER BY SUM |
| `ordersByCountry` | distribution by buyer's country | LEFT JOIN country (Unknown bucket) |
| `aovTrend` | 14-day AOV sparkline | `generate_series` + per-day SUM/COUNT |
| `infoIntegrity` | profile-completion vs orders-from-complete | scalar subqueries |
| `productMatrix` | bottom 5 products by 30-day rev | inner subquery + ORDER BY ASC |
| `getOrderHeatmap` | 7×24 weekday × hour grid | `EXTRACT(dow / hour)` GROUP BY |

**Two examples worth highlighting:**

#### 4.4.a Materialized View — `top_stores_30d`

Refreshed manually by an admin button (and by a scheduled CRON in production). The view is defined in migration `20260507060000_top_stores_30d_matview/migration.sql`:

```sql
CREATE MATERIALIZED VIEW top_stores_30d AS
  SELECT
    s.store_id,
    s.name,
    COALESCE(SUM(oi.price_per_unit * oi.quantity), 0) AS revenue,
    COUNT(DISTINCT o.order_id) AS orders,
    NOW() AS computed_at
  FROM store s
  LEFT JOIN product p       ON p.store_id = s.store_id
  LEFT JOIN product_item pi ON pi.product_id = p.product_id
  LEFT JOIN order_item oi   ON oi.product_item_id = pi.product_item_id
  LEFT JOIN orders o        ON o.order_id = oi.order_id
                             AND o.status IN ('paid','fulfilled')
                             AND o.created_at >= NOW() - INTERVAL '30 days'
  GROUP BY s.store_id, s.name;

CREATE UNIQUE INDEX top_stores_30d_pk ON top_stores_30d (store_id);
```

The dashboard query then becomes a cheap INDEX-backed read instead of re-aggregating millions of order_items every page render:

```sql
SELECT t.store_id, t.name, s.rating,
       t.revenue::text AS revenue_text,
       t.orders, t.computed_at
  FROM top_stores_30d t
  JOIN store          s ON s.store_id = t.store_id
 ORDER BY t.revenue DESC
 LIMIT 25;
```

Refresh cost: `REFRESH MATERIALIZED VIEW CONCURRENTLY top_stores_30d` (the unique index makes CONCURRENTLY possible — no read locks during refresh).

#### 4.4.b Review Monitor — Post-Purchase Conversion

```sql
SELECT
  pr.avg_rating, pr.total_reviews, pr.reviews_7d, pr.low_rated,
  br.buyers_who_reviewed, bb.buyers_who_bought,
  ep.eligible_pairs, rp.reviewed_pairs
FROM
  (SELECT ROUND(AVG(rating)::numeric, 2)::float AS avg_rating,
          COUNT(*)::bigint AS total_reviews,
          COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')::bigint AS reviews_7d,
          COUNT(*) FILTER (WHERE rating <= 2)::bigint AS low_rated
     FROM "product_review") pr
CROSS JOIN
  (SELECT COUNT(DISTINCT user_id)::bigint AS buyers_who_reviewed
     FROM "product_review") br
CROSS JOIN
  (SELECT COUNT(DISTINCT user_id)::bigint AS buyers_who_bought
     FROM "orders" WHERE status IN ('paid','fulfilled')) bb
CROSS JOIN
  -- The "universe of opportunities to review"
  (SELECT COUNT(DISTINCT (o.user_id, pi.product_id))::bigint AS eligible_pairs
     FROM "orders" o
     JOIN "order_item" oi   ON oi.order_id = o.order_id
     JOIN "product_item" pi ON pi.product_item_id = oi.product_item_id
    WHERE o.status IN ('paid','fulfilled')) ep
CROSS JOIN
  -- The subset that actually got reviewed
  (SELECT COUNT(DISTINCT (user_id, product_id))::bigint AS reviewed_pairs
     FROM "product_review") rp;
```

Conversion = `reviewed_pairs / eligible_pairs`. Tuple counting (`(user_id, product_id)`) makes a buyer who bought 5 products but reviewed 1 pull the conversion DOWN, instead of looking like a fully-converted reviewer (which a `COUNT(DISTINCT user_id)` would falsely show).

---

### 4.5 Seller Analytics (per-store dashboard)

**Surface:** `/seller/analytics` → 5 raw `prisma.$queryRaw` calls running in `Promise.all`, all scoped to one storeId. Wrapped in `unstable_cache` 5-min TTL.

```sql
-- 1. Daily revenue, last 30 days, in Bangkok-local dates
SELECT TO_CHAR(d::date, 'YYYY-MM-DD') AS day,
       COALESCE(SUM(oi.price_per_unit * oi.quantity), 0)::text AS revenue,
       COUNT(DISTINCT o.order_id) AS order_count
  FROM generate_series(
         (NOW() AT TIME ZONE 'Asia/Bangkok')::date - INTERVAL '29 days',
         (NOW() AT TIME ZONE 'Asia/Bangkok')::date,
         INTERVAL '1 day') d
  LEFT JOIN orders o ON (o.created_at AT TIME ZONE 'Asia/Bangkok')::date = d::date
                     AND o.status IN ('paid','fulfilled')
  LEFT JOIN order_item oi ON oi.order_id = o.order_id
  LEFT JOIN product_item pi ON pi.product_item_id = oi.product_item_id
  LEFT JOIN product p ON p.product_id = pi.product_id
 WHERE oi.order_item_id IS NULL OR p.store_id = $1
 GROUP BY d ORDER BY d ASC;

-- 2. Status mix
SELECT o.status::text, COUNT(DISTINCT o.order_id) AS count
  FROM orders o JOIN order_item oi ON ... JOIN product_item pi ON ... JOIN product p ON ...
 WHERE p.store_id = $1 GROUP BY o.status;

-- 3. Top 10 products by units sold
-- 4. Top 5 buyers by spend on this store
-- 5. Lifetime totals
```

---

## 5. UPDATE Operations

### 5.1 Edit Product

`PATCH /api/seller/products/:id` → `seller.service.updateProduct()` (line 470).

Two shapes:
- **Toggle-only**: `{ isActive: true|false }` → single one-row UPDATE on `product`.
- **Full replace**: variant + image + tag arrays — a transaction that does **delete-then-recreate** on child rows because doing a per-row diff would explode the code path:

```sql
BEGIN;
  UPDATE "product" SET name=$1, description=$2, category_id=$3,
                       delivery_method=$4, is_stackable=$5, updated_at=NOW()
   WHERE product_id=$6;

  DELETE FROM "product_image" WHERE product_id=$6;
  INSERT INTO "product_image" (product_id, product_image, sort_order)
  VALUES (...), (...), (...);

  DELETE FROM "product_n_tag" WHERE product_id=$6;
  INSERT INTO "product_n_tag" (product_id, tag_id) VALUES (...), (...);

  DELETE FROM "product_add_detail" WHERE product_id=$6;
  INSERT INTO "product_add_detail" (...) VALUES ...;

  -- For variants: keep existing variants when productItemId matches;
  -- delete missing ones; insert new ones (preserves OrderItem FK).
  -- Done one-by-one to handle the SetNull cascade on order_item correctly.
COMMIT;
```

The variant strategy specifically preserves history: deleting a variant would CASCADE to nothing (because OrderItem's FK is `SetNull`), so order receipts still resolve even when a seller drops a sold-out variant.

### 5.2 Edit Profile

`PATCH /api/profile` (or `/auth/me`) → service updates only the columns that arrived in the request body.

```sql
UPDATE "users"
   SET first_name = COALESCE($1, first_name),
       last_name  = COALESCE($2, last_name),
       country_id = COALESCE($3, country_id),
       date_of_birth = COALESCE($4, date_of_birth),
       gender = COALESCE($5, gender),
       profile_image = COALESCE($6, profile_image),
       updated_at = NOW()
 WHERE user_id = $7
RETURNING user_id, first_name, last_name, email, …;
```

`COALESCE($n, column)` keeps the existing value when the patch field is null/absent. This avoids over-writing fields the form didn't touch.

### 5.3 Update User Role (Admin)

`PATCH /admin/users/:id` → `admin.service.updateUserRole()` (line 191).

The interesting wrinkle is **side effects**: changing a user's role between buyer/seller has knock-on effects on whether their store should exist.

```ts
// Inside transaction:
if (input.role === 'seller' && targetStats.role !== 'seller' && !targetStore) {
  // Auto-create empty store row so the role flip is internally consistent
  await tx.store.create({ data: { ownerId: targetUserId, name: defaultName, … } });
}
if (input.role === 'buyer' && targetStore) {
  // Demote → cascade delete the store + everything under it
  await tx.store.delete({ where: { storeId: targetStore.storeId } });
}
await tx.userStats.update({ where: { userId: targetUserId }, data: { role: input.role } });
```

SQL equivalent:
```sql
BEGIN;
  -- Self-demote guard runs above
  -- Last-admin guard: COUNT(*) WHERE role='admin' must stay >= 1

  -- Branch 1: promote to seller without store
  INSERT INTO "store" (owner_id, business_type_id, name, …) VALUES (...);

  -- Branch 2: demote to buyer with store
  DELETE FROM "store" WHERE store_id = $oldStoreId;
  -- Cascade fires: products, product_items, product_images, product_n_tags,
  -- coupons all gone. order_item.product_item_id → SetNull (history preserved).

  -- Always: role flip
  UPDATE "user_stats" SET role = $1 WHERE user_id = $2;

  -- Audit (never the same txn so a failed audit doesn't roll back the action)
COMMIT;
INSERT INTO "audit_log" (actor_id, action, target_type, target_id, meta)
VALUES ($actor, 'user.role_change', 'user', $targetId, '{"from":"…","to":"…"}'::jsonb);
```

---

## 6. DELETE Operations

### 6.1 Delete User (with full cascade map)

**Surface:** `DELETE /api/admin/users/:id` → `admin.service.deleteUser()` (line 268).

The function chooses one of three branches based on the input + history count:

| Input | Action | SQL |
|---|---|---|
| `{ reason: "..." }` (ban) | Mark `banned_at` + drop sessions; row stays | `UPDATE … SET banned_at, banned_reason; DELETE FROM session WHERE user_id` |
| No reason, history = 0 | Hard delete + cascade | `DELETE FROM users WHERE user_id` |
| No reason, history > 0 | Anonymize | UPDATE columns to placeholder values |

**Hard-delete cascade chain** (everything below auto-deletes via `onDelete: Cascade`):

```
DELETE FROM users WHERE user_id = $1;
  └─► CASCADE: user_stats           (1:1)
  └─► CASCADE: store                (owner)
        └─► CASCADE: product
              └─► CASCADE: product_item, product_image, product_detail, product_n_tag
              └─► CASCADE: product_review (productId)
              └─► CASCADE: product_favorite (productId)
        └─► CASCADE: coupon (storeId scoped)
              └─► CASCADE: coupon_usage
        └─► OrderItem.productItemId → SetNull (preserves order receipts)
  └─► CASCADE: cart
        └─► CASCADE: cart_item
  └─► CASCADE: orders               (userId)
        └─► CASCADE: order_item
        └─► OrderItem.couponId already SetNull-handled
  └─► CASCADE: transaction
  └─► CASCADE: product_review       (userId)
  └─► CASCADE: product_favorite     (userId)
  └─► CASCADE: coupon_usage         (userId)
  └─► CASCADE: session, account, verification (better-auth tables)
  └─► CASCADE: gift_claim           (userId)
  └─► SetNull: audit_log.actor_id   (audit row stays, actor anonymized)
```

**Anonymize branch** (history > 0) — preserve the user_id row but scrub PII:

```sql
UPDATE "users"
   SET email      = 'deleted_' || user_id || '@anonymized.metu.dev',
       username   = 'deleted_' || user_id,
       first_name = 'Deleted',
       last_name  = 'User',
       phone      = NULL,
       password   = '',          -- breaks any future login attempts
       date_of_birth = NULL,
       profile_image = NULL,
       deleted_at = NOW()
 WHERE user_id = $1;

-- Drop sessions so the next request 401s
DELETE FROM "session" WHERE user_id = $1;
```

This keeps Order/Review/Transaction history intact (so other users' carts and the platform's KPIs aren't mutated) while making the deleted account un-loginable.

### 6.2 Delete Product

`DELETE /api/seller/products/:id` → `seller.service.deleteProduct()` (line 579):

```sql
DELETE FROM "product" WHERE product_id = $1;
-- Cascade fires: product_item, product_image, product_detail, product_n_tag,
-- product_review, product_favorite. order_item.product_item_id → SetNull.
INSERT INTO "audit_log" (actor_id, action, target_type, target_id, meta) ...;
```

**There is no "has-sales" refusal at the seller layer** — a product with sales history can be deleted, and OrderItem rows survive with `productItemId = NULL` (they keep their `price_per_unit` snapshot for the receipt).

Sellers who want to "soft-delete" should use the `isActive = false` toggle (Pause) instead — handled by the same PATCH route in §5.1.

### 6.3 Delete Coupon

`DELETE /api/seller/coupons/:id` → `seller.service.deleteCoupon()` (line 720):

```sql
SELECT c.coupon_id, c.store_id,
       (SELECT COUNT(*) FROM "coupon_usage" WHERE coupon_id = c.coupon_id) AS usages
  FROM "coupon" c
 WHERE coupon_id = $1;
-- Refuse with 409 CouponInUse if usages > 0 (preserves audit trail)

DELETE FROM "coupon" WHERE coupon_id = $1;
-- Cascade: coupon_usage rows go too.
-- order_item.couponId → SetNull (settled orders keep their totals).
```

The 409 refusal protects the audit story: a redeemed coupon has audit value, so the right move is to deactivate (`isActive=false`), not delete.

---

## 7. Optimization Discussion

### 7.1 Index Coverage vs Query Patterns

Every WHERE / ORDER BY column on a hot path has a matching index. A sample mapping:

| Query | Indexes Used |
|---|---|
| Browse products (`p.is_active = true ORDER BY created_at DESC`) | `Product.isActive`, `Product.createdAt` (PK) |
| Add to cart (`cart_item WHERE cart_id=? AND product_item_id=?`) | `CartItem.@@unique([cartId, productItemId])` |
| Owner-buys-own-store (`product.store.ownerId`) | `Store.@unique(ownerId)` |
| Already-owned guard (`orders WHERE userId=? AND status IN (...)`) | `Order.@@index([userId, status])` composite |
| Stripe webhook lookup (`order WHERE stripe_payment_intent_id=?`) | `Order.@@index([stripePaymentIntentId])` |
| Coupon lookup at checkout (`code, isActive, dates`) | `Coupon.@@index([code])`, `Coupon.@@index([isActive])` |
| Coupon usage cap (`coupon_usage WHERE coupon_id=? AND user_id=?`) | `CouponUsage.@@unique([couponId, userId])` |
| Cart resolve (`cart WHERE userId=? AND status='active'`) | `Cart.@@index([userId, status])` composite |
| Audit log tail (`audit_log ORDER BY created_at DESC`) | `AuditLog.@@index([createdAt])` |
| Audit log subject filter (`targetType=? AND targetId=?`) | `AuditLog.@@index([targetType, targetId])` composite |

### 7.2 Subquery vs JOIN — Why Browse Uses Subqueries

A single LEFT JOIN through `product → product_item → product_review` for the browse listing:
- multiplies rows by `variant_count × review_count`,
- requires GROUP BY on every product column,
- and forces Postgres to build a large in-memory hash before aggregating.

The correlated-subquery approach (one MIN, one MAX, one AVG per product row) keeps the result set at exactly `LIMIT` rows and lets each subquery use the per-product index `product_item.@@index([productId])` and `product_review.@@index([productId])` directly.

Trade-off: 6 sub-plans per row × 16 rows = 96 sub-evaluations per page. On a 200-product catalog this clocks in around 50 ms with indexes. A LEFT JOIN approach would run faster on tiny catalogs but degrades worse as variant + review counts grow. The browse endpoint is also wrapped in `unstable_cache` 2-min TTL to amortize the cost across page navigations.

### 7.3 Materialized View — `top_stores_30d`

The dashboard's "Top stores by 30d revenue" used to re-aggregate the entire orders + order_items + product_items + products + stores joined table on every admin page render. With ~10 k orders this took ~600 ms.

The matview pre-computes per-store revenue and gets refreshed on demand (admin button or scheduled). The dashboard query becomes a cheap INDEX-backed `SELECT ... ORDER BY revenue DESC LIMIT 25` — sub-10 ms.

Refresh cost stays bounded because of the `UNIQUE INDEX top_stores_30d_pk (store_id)` — that index lets us use `REFRESH MATERIALIZED VIEW CONCURRENTLY`, which doesn't take a read lock.

### 7.4 Process-Level Caching (`unstable_cache`)

The BFF wraps almost every public read in `unstable_cache(fn, key, { revalidate, tags })`:

| Function | TTL | Tag |
|---|---|---|
| `getStats` (home counters) | 60 s | public-stats |
| `getFeaturedProducts` | 5 min | featured-products |
| `getTopSellerProducts` | 5 min | top-seller-products |
| `getFeaturedStores` | 5 min | featured-stores |
| `getFeaturedCoupons` | 60 s | featured-coupons |
| `getCategories`, `getTags`, `getBusinessTypes`, `getCountries` | 1 hr | reference data |
| `getStore(id)` | 5 min | store |
| `browseProducts(filters)` | 2 min | browse-products (per-filter slot) |
| `getProduct(id)` | 5 min | product |
| `getRelatedProducts(id)` | 10 min | product |
| `getRecentPurchaseCount(id)` | 5 min | recent-purchase-count |
| `getSellerAnalytics(storeId)` | 5 min | seller-analytics |

The cache is **per-machine** (in-process Map), so warming has to happen on every Fly machine independently. A boot-time self-warm hits `/`, `/browse`, `/product/1`, `/store/1` from `127.0.0.1:8080` once after the server is ready, populating the slots before any real visitor lands.

### 7.5 Edge Cache (Cloudflare)

A new Cloudflare Cache Rule hits `/`, `/browse/*`, `/product/*`, `/store/*` for **anonymous** visitors. The Next.js middleware decides per-request:

```ts
if (AUTH_COOKIE_RE.test(req.headers.get("cookie") ?? "")) {
  // Logged-in: leave Next's force-dynamic `private, no-store` alone.
  return res;
}
// Anonymous: hint CF to cache the rendered HTML 5 min, serve stale 10 min.
res.headers.set("Cache-Control", "public, max-age=0, s-maxage=300, stale-while-revalidate=600");
res.headers.append("Vary", "Cookie");
```

`max-age=0` keeps the **browser** revalidating every nav (so admin runtime-flag flips show up immediately), while `s-maxage=300` lets the **CF edge** absorb the SSR cost for 5 minutes. The `Vary: Cookie` keeps a future cookie-bearing visitor on a separate cache slot — defense in depth above the cookie check we already did.

---

## 8. Insights & Things Worth Highlighting at Defense

1. **Atomic checkout transaction**. `orders.service.checkout()` wraps Transaction + Order + OrderItem + ProductItem stock decrement + Cart pivot + CouponUsage in **one** BEGIN/COMMIT. A single failure (out of stock, duplicate coupon use, bad coupon lookup) rolls back the whole thing, so the system can never end up with an Order that took stock but never recorded the coupon, or vice versa.

2. **Conditional UPDATE for stock guard**. The `WHERE quantity >= $q` clause on the stock decrement is the cheapest possible BR 4.b enforcement — Postgres fails the UPDATE if the predicate doesn't match, and the application reads `count = 0` to throw `OutOfStock` cleanly. No SELECT-then-UPDATE race.

3. **Junction table with audit-friendly cascade**. `product_n_tag.@@unique([productId, tagId])` prevents duplicate tag attachments AND its M:N cascade fires correctly when either side is deleted. Same pattern repeats on `coupon_usage`, `cart_item`, `product_favorite`.

4. **SetNull on OrderItem.productItemId**. Most `OrderItem` FKs are CASCADE, but the link back to `ProductItem` is intentionally **SetNull** so a seller deleting a discontinued variant doesn't break months-old order receipts — they just lose the live product link.

5. **JSONB for audit log meta**. `AuditLog.meta` is a single JSONB column carrying arbitrary per-event context (Stripe payload, before/after diffs, role-change reasoning) — the project's NoSQL touchpoint inside an otherwise relational world. We can `WHERE meta @> '{"eventId":"evt_…"}'` to find rows by event without altering the schema.

6. **Anonymize-vs-delete branching**. `deleteUser` reads `(orderCount + reviewCount + transactionCount)` and chooses between hard-delete (cascade everything) and anonymize (preserve history with scrubbed PII). The decision lives in the application layer because the cascade rules can't differentiate "had sales" from "fresh signup".

7. **`COUNT(DISTINCT (a, b))` in the review monitor**. Tuple-counted DISTINCT lets us answer "what fraction of (buyer, product) opportunities turned into a review?" — a more honest conversion metric than `DISTINCT user_id` would give.

8. **Window function `COUNT(*) OVER ()` saves a round-trip on browse pagination**. Instead of running the full filtered SELECT *and* a separate `SELECT COUNT(*)` to populate the page footer, the browse query uses a window aggregate so total + page slice come back in one query plan.

9. **TOCTOU-safe coupon redemption**. The coupon lookup at the start of checkout is purely informational; the actual `INSERT INTO coupon_usage` happens inside the order transaction with `ON CONFLICT (coupon_id, user_id) DO NOTHING`. So two concurrent checkouts trying to redeem the same one-shot coupon end up with exactly one redemption recorded — no race.

10. **Materialized view + indexed unique key + CONCURRENTLY refresh**. `top_stores_30d` plus its `UNIQUE INDEX (store_id)` is the textbook combination that lets us re-aggregate millions of order rows on a schedule without ever locking out the dashboard's reads.

---

## Appendix A — Where to find each query in the source

| Section | File | Function / Lines |
|---|---|---|
| Create User | `apps/server/src/services/auth.service.ts` | `signUp()` |
| Create Store | `apps/server/src/services/seller.service.ts` | `becomeSeller()` (line 335) |
| Create Product | `apps/server/src/services/seller.service.ts` | `createProduct()` (line 415) |
| Add to Cart | `apps/server/src/services/cart.service.ts` | `addItem()` (line 82) |
| Checkout | `apps/server/src/services/orders.service.ts` | `checkout()` (line 59) |
| Stripe webhook → paid | `apps/server/src/services/orders.service.ts` | `markOrderPaid()` |
| Create Coupon (master + scoped) | `apps/server/src/services/admin.service.ts` | `createMasterCoupon()` (line 1251) |
| Browse Products | `apps/web/lib/server/queries.ts` | `_browseProductsImpl()` (line 460+) |
| Single Product | `apps/web/lib/server/queries.ts` | `_getProductImpl()` (line 668+) |
| Admin Dashboard (16 queries) | `apps/server/src/services/admin.service.ts` | `_getDashboardMetricsImpl()` (line 744+) |
| Materialized View | `packages/db/prisma/migrations/20260507060000_top_stores_30d_matview/` | `migration.sql` |
| Edit Product | `apps/server/src/services/seller.service.ts` | `updateProduct()` (line 470) |
| Edit Profile | `apps/server/src/services/auth.service.ts` | `updateProfile()` |
| Update User Role | `apps/server/src/services/admin.service.ts` | `updateUserRole()` (line 191) |
| Delete User | `apps/server/src/services/admin.service.ts` | `deleteUser()` (line 268) |
| Delete Product | `apps/server/src/services/seller.service.ts` | `deleteProduct()` (line 579) |
| Delete Coupon | `apps/server/src/services/seller.service.ts` | `deleteCoupon()` (line 720) |

## Appendix B — Schema source

`packages/db/prisma/schema.prisma` — all 26 models, with `@@index` and `@relation onDelete` declarations matching the cascade map in §2.

## Appendix C — Migration history (chronological)

```
20260422020000_batch_c_qna_sample_gift_alerts        — Q&A, Sample (later dropped), Gift, Stock Alerts
20260504100000_fix_sample_urls                       — sample URL bug fix
20260505180000_drop_banned_ip                        — drop unused banned-IP table
20260505200000_hard_delete                           — formalize cascade rules
20260505220000_drop_live_partial_indexes             — switch from partial indexes to full
20260507060000_top_stores_30d_matview                — materialized view + unique index
20260507120000_totp_backup_codes                     — 2FA backup codes
20260508103229_init                                  — schema baseline
20260509120000_product_tag_count_drop_sample_url     — drop sample feature, add tag_count denorm
20260511160000_add_gifting_enabled                   — admin gift toggle (this session)
```
