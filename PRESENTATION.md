# METU — 5-Minute Live Demo Script

> CPE241 Database Systems · KMUTT · Group 8
> For use during in-class presentation. Times are cues, not deadlines.

---

## Pre-flight (before you walk on stage)

Open **four browser tabs** in this order:

1. `http://localhost:3000` (METU home — logged out)
2. `http://localhost:4000/health` (proof the API is live)
3. `http://localhost:8081` (Adminer — login `metu/metu` to DB `metu`)
4. This file (`PRESENTATION.md`) as your speaker notes

Ensure `docker compose ps` shows `metu-db (healthy)` and `metu-adminer (Up)`.
Run `npm run db:reset` if you want a clean slate between dry runs.

---

## 0:00 — 0:30 · Hook

> "This is **METU**, a digital marketplace platform our team built
> around the ER diagram we designed for CPE241."

Point at the hero with **Sellers / Products / Orders / Reviews** counters.

> "These numbers come from live SQL against 19 normalized tables — nothing hard-coded."

**DB link:** The stats endpoint (`/api/stats`) runs 4 `COUNT(*)` queries,
one per source table, proving the data model is actually populated.

---

## 0:30 — 1:30 · Buyer flow

Click **Browse marketplace** in the hero.

> "Browse joins 6 tables: `product`, `product_item`, `product_image`,
> `product_n_tag`, `product_tag`, and `product_review` — all in one query,
> filtered by category and tag."

Apply one filter (e.g. click **Templates** in the sidebar). Point out the
URL changing to `?category=N` — filters are stateful and shareable.

Click a product (Figma Dashboard Kit). On the detail page:

> "The variant picker renders `product_item` rows. Each variant has its own
> `delivery_method` enum — `download`, `email`, `license_key`, `streaming` —
> and its own price and discount."

Click **Log in** (top-right). Use the **Buyer** demo account chip.

> "Cookie-based JWT auth sets a `metu_auth` httpOnly cookie. Nothing exotic."

Back to product page → **Add to cart**. Then **cart icon** → `/cart`.

> "The cart page groups `cart_item` rows by store and sums each line.
> Coupons get validated against `coupon.is_active`, `start_date`, `end_date`,
> and `usage_limit < count(coupon_usage)`."

Type `METU10` → **Apply**. Discount appears. **Checkout**.

> "Checkout is a single `prisma.$transaction` — we create the `orders` row,
> N `order_item` rows, one `transaction`, flip the old cart to `checked_out`,
> spin up a fresh `active` cart, and record a `coupon_usage` — all atomic."

Confetti. Point at **Order #X confirmed**. Click **All orders**.

---

## 1:30 — 3:00 · Seller dashboard

**Log out** via profile → top-right → Log out. Then log in as **Seller**.

Go to `/seller`.

> "This is a different view for the same data. `seller@metu.dev` owns
> Glasswave Studio. Revenue and daily-order counts come from raw SQL
> with `GROUP BY DATE_TRUNC`, scoped to `store_id`."

Hover over the line chart. Click **Products** in the sidebar.

> "Each row shows the min/max price range across variants — a classic
> MIN/MAX aggregation across `product_item`."

Click **Coupons**.

> "We seeded `METU10` (active) and `LAUNCH25` (expired) so you can see
> the badge logic comparing `is_active` and date windows."

Click **Orders**.

> "This is the seller's inbox — every order that contains any product
> from their store, joined through `product → product_item → order_item → orders`."

---

## 3:00 — 4:15 · Admin panel (the money shot for the database class)

Log out → log in as **Admin**.

Navigate to `/admin`.

> "Admin sees marketplace-wide numbers. GMV = sum of `total_price` where
> `status IN ('paid', 'fulfilled')`."

Click **Users** → point at role column.

> "Role lives on `user_stats`, not on `users` — a 1:1 extension so that
> role changes don't touch the core user record."

Click **Stores** → let the cards load. Explain CTR = `ctr / 100` basis points.

Click **Reports** — **this is the slide for the professor**.

> "Every one of these charts runs a hand-written SQL query against the
> warehouse. Click **View SQL** on any card."

Open the **Revenue by category** SQL panel. Read a line out loud:

> "`JOIN product_item ... JOIN product ... JOIN category`. Five joins
> and a `GROUP BY` — this is exactly the kind of query our ER diagram
> was designed to support."

Open **Top stores by revenue**. Point at the outer `LEFT JOIN` on `orders`
with `status IN ('paid', 'fulfilled')` — so stores with zero sales still appear.

---

## 4:15 — 4:45 · The database itself

Alt-tab to **Adminer** (`http://localhost:8081`).

> "Because the whole thing runs in Docker, I can show you the live schema."

Click **orders** → **Select data**. Show the 16 seeded rows.

> "Notice `cart_id` is a `UNIQUE` FK — one cart, one order. `transaction_id`
> is nullable because `pending` and `cancelled` orders have no payment yet."

Click the **ER** link (or **Tables** → see 19 tables listed).

---

## 4:45 — 5:00 · Wrap

Back to `/admin`.

> "That's METU — the full ER diagram, made clickable.
> Thanks for watching, Group 8 out."

---

## Per-feature mapping to ER diagram

| Feature in demo                | Entities exercised                                                    |
|--------------------------------|-----------------------------------------------------------------------|
| Landing stats                  | user_stats, product, orders, product_review                           |
| Browse filters                 | product, category, product_tag, product_n_tag, product_item, product_review |
| Product detail page            | product, store, category, product_item, product_image, product_review, product_n_tag, product_tag, store_stats |
| Add-to-cart                    | cart, cart_item (our extension), product_item                         |
| Coupon validate                | coupon, coupon_usage                                                  |
| Checkout (transaction)         | cart, orders, order_item, transaction, coupon_usage                   |
| Seller dashboard               | store, store_stats, product, product_item, orders, order_item, product_review |
| Seller orders inbox            | orders, order_item, product_item, product, cart, users                |
| Admin users / stores           | users, user_stats, country, store, business_type, store_stats         |
| Admin reports                  | All of the above, via raw SQL                                         |

## "Database moments" — pauses to call out a query

Rehearse these so they feel natural on stage.

1. **Landing page** → "Four `COUNT(*)` queries. Simplest demo of live data."
2. **Browse filter** → "`JOIN product_n_tag` when tags are applied — that's the N:M junction working."
3. **Cart coupon** → "Validation checks 5 conditions in a single query — active, date window, usage count below limit."
4. **Checkout** → "`prisma.$transaction` wraps 5 mutations atomically. If any fails, nothing commits."
5. **Seller line chart** → "`DATE_TRUNC('day', created_at)` is the textbook grouping for time-series."
6. **Admin revenue-by-category** → "Five joins. This is what normalization pays us back with — flexible aggregation without data duplication."
7. **Admin coupon-usage** → "`LEFT JOIN coupon_usage` + `COUNT` to show usage-vs-limit. Classic reporting pattern."

## If something breaks live

- **Web tab says 500** → API crashed. Run `docker compose logs db` in a terminal; restart with `npm run dev` inside `apps/api`.
- **Login button spins forever** → cookie domain mismatch. Make sure you're on `localhost`, not `127.0.0.1`.
- **Empty stats** → re-seed: `npm run db:reset`.
- **Docker not running** → `docker compose up -d` + wait 10s for healthcheck.
