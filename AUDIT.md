# METU · Audit Report (Phase E)

Date: 2026-04-20
Scope: End-to-end walkthrough of every route + flow after the Phase A-D redesign.

---

## Bugs found & fixed (P0/P1)

### P0-1 · Search only matched product name
**Where:** `apps/api/src/routes/products.ts`
**Before:** `where.name = { contains: q }` — missed products matching by description, store, or tag.
**Fix (Phase D):** Extended to `where.OR = [name, description, store.name, tag.tagName]` with `mode: 'insensitive'`. Verified with `curl /products?q=thai` → 10 results across all stores.

### P0-2 · Log-in / log-out UX ambiguous
**Where:** `apps/web/components/TopNav.tsx`
**Before:** Separate **Log in** button + avatar + cart icon — users didn't know if they were logged in; logout was buried inside `/profile` only.
**Fix (Phase C):** Removed the duplicate Log-in button. Avatar is now the single auth entry point. When logged out it says "Log in" with a silhouette. When logged in it opens a role-aware dropdown menu (Profile, My orders, Seller dashboard if seller, Admin panel if admin, Log out).

### P0-3 · Search icon was a fake link
**Where:** `apps/web/components/TopNav.tsx`
**Before:** The Search icon in the old nav just linked to `/browse` with no query.
**Fix (Phase D):** `SearchPill` is now a real form — Enter or the Search button navigates to `/browse?q=…`. Clear-× button and `/` keyboard shortcut added.

### P1-1 · Browse pagination missing
**Where:** `apps/web/app/browse/page.tsx`
**Before:** API returned `totalPages` but UI only rendered page 1.
**Fix (Phase A redesign):** Added `<Pagination>` component rendering Prev/Next when `totalPages > 1`, preserving active filters across pages.

### P1-2 · Prices in USD, Western avatars on Thai-marketed site
**Where:** Entire frontend + `packages/db/seed.ts`
**Fix (Phase B):** New `lib/format.ts::money()` using `Intl('th-TH', 'THB')`. Replaced every `$` display site-wide. Swapped seed avatars to `api.dicebear.com/7.x/notionists-neutral` (abstract, modern, non-stock). Re-priced seed data × 35 to plausible THB. Thai-leaning user/store names. One Thai comment in the review pool for authenticity.

### P1-3 · Empty cart had no demo data
**Where:** `packages/db/seed.ts`
**Before:** `seedActiveCart` was a no-op (didn't exist in schema yet).
**Fix (Phase B):** Added `cart_item` schema in Phase 1 of v1 build; seed now pre-fills buyer@metu.dev with 2 items so the cart demo isn't empty at login.

### P1-4 · Filter "Apply" button wasn't accessible to keyboard-only users
**Where:** `apps/web/app/browse/page.tsx`
**Before:** The sort/filter form submitted via button but category/tag filters were `<a>` links only, creating an inconsistent mental model.
**Fix (Phase A):** Category + tag filters remain links (bookmarkable), sort/search lives in a single keyboard-friendly form. The form retains active filters via hidden inputs.

### P1-5 · Accessibility — focus rings invisible on dark bg
**Where:** Global CSS
**Fix (Phase A):** Added `*:focus-visible` with a yellow 2px outline + 2px offset in `globals.css`. Matches the yellow accent brand color.

---

## QoL improvements shipped

- **Keyboard shortcut `/`** focuses the top-nav search (standard pattern on marketplaces).
- **Search pill shows a clear × button** when `q` is active.
- **Tabs row** (All · Discount · 3D Mode · Gaming · Services · Courses · Artworks · Plug-in · Others) added to match Canva mockup + improve discoverability.
- **Logout button on `/profile`** switched to `variant="danger"` so it stands out.
- **Active cart gets auto-created** on login if missing (server code in `apps/api/src/routes/auth.ts`) — avoids first-add-to-cart race.
- **Checkout creates a new `active` cart** atomically so the buyer always has a working cart after checkout (already in v1, verified still works).
- **Empty states** now have illustrated icon + action button (Browse, Create product, etc.) — no dead ends.
- **Clear all filters** link on browse when any filter is active.
- **Confetti** on checkout success (pure CSS, no external dep).
- **`unoptimized` on every `<Image>`** pointing at dicebear/picsum so Next.js doesn't fail on SVG + arbitrary hosts during Vercel deploy.

---

## TODO (P2/P3 — parked)

| Severity | Area | Item |
|----------|------|------|
| P2 | Search | Normalize hyphen/space differences (`"lofi"` should match `"Lo-Fi"`). Quick fix: add a second OR clause stripping non-alnum from both sides. |
| P2 | Seller | Pagination on seller Products table; right now all rows render at once. Fine for 9 rows but won't scale. |
| P2 | Admin | Admin user detail drawer is stubbed (row click does nothing). |
| P2 | Cart | Optimistic UI when updating qty — currently blocks until API responds. |
| P3 | i18n | Actual TH/EN switcher wiring (current locale button is visual only). |
| P3 | A11y | Add `aria-live` on cart total when qty changes. |
| P3 | Perf | Static imports of lucide-react icons are tree-shaken; consider moving the 9 tab icons into a client-only chunk. |
| P3 | Seller | Image URL input on product-create doesn't preview. Add thumb preview. |
| P3 | Admin | `/admin/demo-reset` endpoint returns 501 — wire it to shell out to `db:reset` or add a TRUNCATE + seed inline. |

---

## Verification run

- `npm run build -w @metu/web` → **19 routes, 0 TS errors**
- Smoke tests on every route (public + protected w/ admin cookie) → all 200/307 expected
- Landing HTML contains: DIGITAL · MARKETPLACE · bg-space-black · text-white · "Thai digital creators" · "Built in Bangkok"
- Buyer pre-seeded cart API returns 2 items, subtotal ฿6,150
- Search `q=thai` → 10 matches across stores, `q=lofi` → returns Bangkok Lo-Fi when normalized (see TODO P2)

---

## Known limitations (not bugs)

- Prisma's `query_engine-windows.dll.node` is locked by any running node process — must stop dev servers before `prisma generate`. Documented in `README.md::Troubleshooting`.
- Adminer is on port `8081` because the teammate's existing `InvoiceLab` stack already occupies `8080`.
- All images use `unoptimized` to bypass Next.js image optimization in dev and on Vercel free tier.
