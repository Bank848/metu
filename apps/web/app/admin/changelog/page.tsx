import { Sparkles, Zap, Store, ShoppingBag, Shield, Wrench, GitCommit, ExternalLink, Palette, Activity, FlaskConical, MessageSquare, Database, Bug, Filter, Wallet, ShieldAlert, AlertTriangle, Layers, KeyRound, ShoppingCart, Mail, Receipt, Star, HelpCircle } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/Badge";

// Must be dynamic so the parent admin layout's getMe() cookie read
// runs per-request. If we let this prerender at build time the layout
// sees no cookie, redirects to /login, and bakes that redirect into a
// static page that everyone hits.
export const dynamic = "force-dynamic";

/**
 * Admin-only changelog — every batch we ship gets a card here so the
 * team has a single place to point at when asked "what actually changed
 * today?". Server-component, no JS shipped to the browser.
 *
 * Sits behind the admin layout's `me.role !== "admin"` redirect, so
 * non-admins never see it even if they guess the URL.
 */

type Item = { title: string; detail?: string; commit?: string };

type Batch = {
  id: string;
  title: string;
  subtitle: string;
  icon: React.ElementType;
  tone: "yellow" | "purple" | "info" | "success" | "warning" | "danger";
  shippedAt: string; // local time, free-form
  commitSha: string;
  items: Item[];
};

const BATCHES: Batch[] = [
  {
    id: "phase-13-6-5",
    title: "Phase 13.6.5 · CPE241 rubric retrofit (Lecture 10)",
    subtitle:
      "Plugs the four classical RDBMS topics from Lecture 10 (Triggers, Views, Permissions, Check Constraints) that the codebase had zero coverage for. One additive SQL migration — no API change, no test churn, all 42 server tests stay green. Demo viva can now answer 'where do you do X?' for every Lecture 10 slide in one sentence (see docs/rubric-coverage.md).",
    icon: Database,
    tone: "info",
    shippedAt: "today",
    commitSha: "phase-13-6-5",
    items: [
      { title: "Trigger 1 — touch_updated_at: BEFORE UPDATE on product, auto-maintains the new product.updated_at column at the database level. Schema annotation explicitly notes the trigger owns the column (no Prisma @updatedAt — the trigger is the only writer)" },
      { title: "Trigger 2 — review_delete_audit: AFTER DELETE on product_review, writes a fallback 'review.delete.trigger' row to audit_log. Two-layer audit — app writes the rich row (with actor + before-snapshot), trigger writes the safety net only when a manual SQL DELETE bypasses the API" },
      { title: "View 1 — live_stores_view: reifies the soft-delete predicate (deleted_at IS NULL) so analytics consumers don't have to remember it. Single source of truth for 'public stores'" },
      { title: "View 2 — product_with_avg_rating_view: denormalised JOIN+AGGREGATE so 'WHERE avg_rating > 4' becomes one clause. Solves the Phase 11 bug #1 minRating problem at the database layer" },
      { title: "Permissions — three-role separation: existing 'metu' (Neon admin, migrations only), new 'metu_app' (runtime SELECT/INSERT/UPDATE/DELETE on app tables), new 'metu_analytics' (read-only + explicitly DENIED audit_log so reporting can't see who did what). Both new roles created NOLOGIN — migration carries no secret; runbook in docs/rubric-coverage.md covers post-migration password rotation" },
      { title: "Check constraints — defence-in-depth bounds: product.name non-empty, product_item.price ≥ 0, product_item.quantity ≥ 0, product_item.discount_percent in 0–100, product_review.rating in 1–5, order_item.quantity > 0. Database refuses garbage even if zod is bypassed" },
      { title: "New file: docs/rubric-coverage.md — one-page matrix mapping every Lecture 9 + 10 topic to file:line. Designed for the demo viva: examiner asks 'where do you do triggers?', you read the row" },
      { title: "schema.prisma: adds Product.updatedAt (DateTime, @default(now()), no @updatedAt — owned by the touch_updated_at trigger). Triggers + views + roles + check constraints all live in the migration SQL only (Prisma-invisible, doesn't introspect them — that's fine)" },
    ],
  },
  {
    id: "phase-13-6",
    title: "Phase 13.6 · Q&A + admin moderation migrated",
    subtitle:
      "Public list / ask / edit / delete / answer all live as a layered Express resource. Field-level permission gates: question body (admin OR asker), answer field via PATCH (admin only — sellers must use the dedicated /answer endpoint so answeredAt + answererId stamp correctly), answer endpoint (product's seller OR admin).",
    icon: HelpCircle,
    tone: "info",
    shippedAt: "today",
    commitSha: "phase-13-6",
    items: [
      { title: "Layered q&a resource: routes/qna.routes.ts (TWO routers — productQuestionsRouter for /products/:productId/questions, default for /questions/:id family) → controllers/qna.controller.ts → services/qna.service.ts → models/qna.model.ts" },
      { title: "GET /products/:productId/questions: PUBLIC (no auth). Includes answerer.stats.role so the UI can render 'Admin answered' vs 'Seller answered' without a follow-up call (Phase 10 / F23)" },
      { title: "POST /products/:productId/questions: 404 for soft-deleted/orphan products" },
      { title: "PATCH /questions/:id: field-level gate — admin OR asker for body, admin-only for answer (sellers must use /answer to stamp answeredAt + answererId)" },
      { title: "PATCH /questions/:id/answer: only the product's seller (verified via auth-loaded req.user.store.storeId) OR admin may answer. Stamps answer + answeredAt + answererId together" },
      { title: "DELETE /questions/:id: admin OR asker. Admin deletes write 'question.delete' AuditLog with full snapshot. Admin edits write 'question.edit' with before/after" },
      { title: "@metu/shared: new questionAskSchema + questionEditSchema + questionAnswerSchema (in new packages/shared/src/schemas/qna.ts)" },
      { title: "Vitest 34 → 42 (added public list + 401 + 404 + non-admin/non-asker 403 + non-admin-cant-edit-answer 403 + non-seller cant answer + admin can answer ANY + admin delete writes audit)" },
      { title: "Next /api/products/[id]/questions/route.ts + /api/questions/[id]/route.ts + /api/questions/[id]/answer/route.ts converted to forwardToApi proxies" },
    ],
  },
  {
    id: "phase-13-5",
    title: "Phase 13.5 · Reviews + admin moderation migrated",
    subtitle:
      "Create / edit / delete reviews now live as a layered Express resource. Admin-OR-author gate enforced server-side; admin moderation actions write AuditLog rows with before/after snapshots so the moderation paper trail survives even after a hard delete.",
    icon: Star,
    tone: "info",
    shippedAt: "today",
    commitSha: "phase-13-5",
    items: [
      { title: "Layered reviews resource: routes/reviews.routes.ts (TWO routers — POST nested at /products/:productId/reviews via mergeParams, PATCH/DELETE at /reviews/:id) → controllers/reviews.controller.ts → services/reviews.service.ts → models/reviews.model.ts" },
      { title: "POST /products/:productId/reviews: 404 for soft-deleted / orphan products (store removed). Author + product info included in the response so the moderation UI doesn't need a refetch" },
      { title: "PATCH /reviews/:id + DELETE /reviews/:id: admin OR author can act. Sellers explicitly CANNOT edit reviews on their own products (would be obvious manipulation)" },
      { title: "Audit trail: when admin reaches into someone else's review, services/reviews.service.ts writes 'review.edit' with before/after snapshot OR 'review.delete' with the full row snapshot in meta. Self-edits / self-deletes are NOT audited (not moderation events)" },
      { title: "@metu/shared: new reviewEditSchema (rating + comment both optional; controller rejects 400 when both are undefined — no-op edits aren't useful)" },
      { title: "Vitest 29 → 34 (added 401 + 404 + happy create + 403 non-admin/non-author + admin-delete-writes-audit)" },
      { title: "Next /api/products/[id]/reviews/route.ts + /api/reviews/[id]/route.ts converted to forwardToApi proxies (~12 lines each)" },
    ],
  },
  {
    id: "phase-13-4",
    title: "Phase 13.4 · Orders + checkout migrated to Express",
    subtitle:
      "POST /orders (checkout — pulls cart + coupon + transaction together in one Prisma transaction), GET /orders (history), GET /orders/:id (receipt). Ownership gate via cart.userId join — another user's orderId returns 404, not 403, so we don't leak existence.",
    icon: Receipt,
    tone: "info",
    shippedAt: "today",
    commitSha: "phase-13-4",
    items: [
      { title: "Layered orders resource: routes/orders.routes.ts → controllers/orders.controller.ts → services/orders.service.ts → models/orders.model.ts. requireAuth() at the router level — every endpoint authed" },
      { title: "Checkout: 7-step single Prisma transaction — resolve active cart + selected vs unselected lines (partial checkout) → resolve coupon (active + within date window) → Decimal arithmetic for unit price + subtotal + coupon-eligible subtotal (only lines from coupon's store count) → create transaction + order + order_items (couponId stamped only on eligible lines) → flip cart to checked_out + create fresh active cart → re-parent unselected items → record CouponUsage" },
      { title: "Discount cap: coupon discount can never exceed the eligible subtotal (e.g. ฿1000 off ฿200 → capped at ฿200)" },
      { title: "Vitest 25 → 29 (added orders 401, EmptyCart 400, list happy, ownership 404)" },
      { title: "Next /api/orders/route.ts + /api/orders/[id]/route.ts converted to forwardToApi proxies. POST /api/orders still calls revalidatePath('/', '/health', '/admin') BFF-side after a 2xx so the public KPI tiles bump immediately (Express has no notion of Next's data cache)" },
      { title: "Legacy apps/server/src/routes/orders.ts deleted. tsconfig exclusions narrowed to seller/admin/stats only — Phase 13.5+ picks them up" },
    ],
  },
  {
    id: "phase-13-2-1",
    title: "Phase 13.2.1 · forgot/reset password migrated",
    subtitle:
      "Closes the Phase 13.2 deferral — the auth module is complete on the layered server. Tokens hashed with SHA-256 before storage, 30-min TTL, no email enumeration on /forgot-password, single failure code (InvalidToken) on /reset-password so attackers can't tell consumed/expired/missing apart.",
    icon: Mail,
    tone: "info",
    shippedAt: "today",
    commitSha: "phase-13-2-1",
    items: [
      { title: "POST /auth/forgot-password — silent no-op for unknown / soft-deleted emails. Always returns the same generic message so an attacker can't probe whether an account exists" },
      { title: "POST /auth/reset-password — 3-statement transaction marks the consumed token + invalidates other outstanding tokens for the same user (so an attacker who grabbed a separate fresh token can't use it after the password rotates)" },
      { title: "utils/email.ts ported from BFF — console provider by default, Resend when RESEND_API_KEY set, falls back to console on Resend failure" },
      { title: "utils/audit.ts ported — fire-and-forget AuditLog row writes 'auth.password_reset' on a successful reset" },
      { title: "@metu/shared schemas: forgotPasswordSchema, resetPasswordSchema (token min 20 max 200 + newPassword)" },
      { title: "Vitest 23 → 25 (added forgot-password no-enum-leak + reset-password InvalidToken)" },
      { title: "Next /api/auth/forgot-password + /api/auth/reset-password converted to forwardToApi proxies" },
    ],
  },
  {
    id: "phase-13-3",
    title: "Phase 13.3 · Cart + coupons migrated to Express",
    subtitle:
      "GET /cart, POST/PATCH/DELETE /cart/items, and POST /coupons/validate now live as layered Express resources on metu-api. Cart line shape preserved (cartId + items[] with stock + computed unit price + lineTotal + subtotal). The Next /api/cart/** + /api/coupons/validate routes are now thin forwardToApi proxies.",
    icon: ShoppingCart,
    tone: "info",
    shippedAt: "today",
    commitSha: "phase-13-3",
    items: [
      { title: "Layered cart resource: routes/cart.routes.ts → controllers/cart.controller.ts → services/cart.service.ts → models/cart.model.ts. requireAuth() applied at the router level (every endpoint authed)" },
      { title: "GET /cart returns the same envelope as the legacy BFF: cartId + items[] (with stock snapshot for input-cap UX) + subtotal" },
      { title: "POST /cart/items merges quantity on duplicate productItemId (no row duplication, single row + bumped qty)" },
      { title: "PATCH/DELETE /cart/items/:id enforce ownership server-side — return 404 (not 403) when the item belongs to a different user, so we don't leak whether the id exists" },
      { title: "Layered coupons resource: POST /coupons/validate. Always 200 with { valid, reason? } so the cart UI surfaces the rejection reason inline (not-found / not-active / expired / limit-reached)" },
      { title: "Vitest 16 → 23 (added cart get + cart merge + cart ownership-404 + coupon validate happy / missing / limit-reached)" },
      { title: "Next /api/cart/route.ts, /api/cart/items/route.ts, /api/cart/items/[id]/route.ts, /api/coupons/validate/route.ts converted to ~12-line forwarders via lib/server/proxy.ts" },
      { title: "Legacy apps/server/src/routes/cart.ts + coupons.ts deleted. tsconfig exclusions narrowed — orders/seller/admin/stats are the remaining legacy flat routes (Phase 13.4+)" },
    ],
  },
  {
    id: "phase-13-2",
    title: "Phase 13.2 · Auth migrated to Express + cookie boundary",
    subtitle:
      "Login / register / me / logout / change-password now live as a layered Express resource on metu-api. Express owns the JWT cookie; the Next /api/auth/* routes became thin proxies that forward Set-Cookie back to the browser so the cookie scopes correctly to metu.fly.dev. getMe() in server components delegates to GET /auth/me on the API.",
    icon: KeyRound,
    tone: "info",
    shippedAt: "today",
    commitSha: "phase-13-2",
    items: [
      { title: "Layered auth resource: routes/auth.routes.ts → controllers/auth.controller.ts → services/auth.service.ts → models/auth.model.ts (re-exports zod from @metu/shared)" },
      { title: "Endpoints live: POST /auth/login, POST /auth/register, POST /auth/logout, GET /auth/me, PATCH /auth/me, POST /auth/change-password" },
      { title: "middleware/auth.ts rewritten to throw AppError (was returning 401 directly). Server-side helpers preserved: issueToken / clearToken / readToken / requireAuth(roles) / softAuth() / currentUser / currentAuth" },
      { title: "Profanity guard + Turnstile verify ported to apps/server/src/utils — same dictionary as Phase 11/F3, no-op when TURNSTILE_SECRET unset" },
      { title: "Next /api/auth/{login,register,logout,me,change-password} converted to thin forwarders via lib/server/proxy.ts. Set-Cookie passed through using Headers#getSetCookie() so the browser scopes the cookie to metu.fly.dev (not metu-api)" },
      { title: "lib/session.ts getMe() now calls /auth/me on Express via apiFetch (cookie forwarded server-side). Return shape preserved 1:1 — every page that gates on me?.role works unchanged" },
      { title: "Vitest: 5 new auth tests (login happy, login wrong-password, login unknown-email, register dupe-email 409, register profanity 400, /me 401). Server suite 9 → 15 tests" },
      { title: "Deferred to Phase 13.2.1: forgot-password + reset-password (need a tiny email/token module of their own)" },
    ],
  },
  {
    id: "phase-13-1",
    title: "Phase 13.1 · Backend separation — Express API + Next BFF",
    subtitle:
      "Splits the monolith into two Fly apps: metu (Next.js BFF, owns UI + SSR) and metu-api (Express, owns Prisma + routes/controllers/services). Catalog (products, stores, categories, tags, health) is the first vertical slice. Auth, cart, orders, etc. follow in 13.2+.",
    icon: Layers,
    tone: "info",
    shippedAt: "today",
    commitSha: "phase-13-1",
    items: [
      { title: "New @metu/server workspace at apps/server with the routes/controllers/services/models/middleware/db/utils layout. One file per resource per layer (products.routes.ts → products.controller.ts → products.service.ts → products.model.ts)" },
      { title: "5 layered resources live: GET /health, GET /products[?…], GET /products/:id, GET /products/featured, GET /stores[?limit=N], GET /stores/:id, GET /categories, GET /tags" },
      { title: "Vitest 14/14 across both workspaces (5 server + 9 web). Server tests mock Prisma + drive supertest(buildApp())" },
      { title: "Next BFF rewired: lib/server/api.ts wraps fetch + cookie forwarding; lib/server/queries.ts catalog functions delegate via apiFetch(). 5 of 6 catalog reads migrated; getProduct stays direct-Prisma until Reviews module ports the soft-delete-cascade selector" },
      { title: "Deploy: apps/server/Dockerfile (multi-stage Node 20) + fly.server.toml. New Fly app metu-api in sin region. release_command runs prisma migrate deploy on every release" },
      { title: "BFF picks API base from INTERNAL_API_URL env (https://metu-api.fly.dev in prod, http://localhost:4000 locally via concurrently)" },
      { title: "Live verified: /, /browse, /browse?sort=price_asc, /browse?category=fonts, /store/18 all served by Next + delegate to metu-api (visible in Fly logs as GET /products?…, /stores/18, /categories, /tags)" },
      { title: "apps/server/README.md documents the why + the 5-step add-an-endpoint template for the next migration" },
    ],
  },
  {
    id: "qa-r3-f1",
    title: "QA round #3 / F1 — silent React hydration errors fixed",
    subtitle:
      "Round #3 of the Phase 11 QA workflow opened DevTools on every persona route and found two minified React errors (#418 + #422) firing on /, /browse, /cart. The pages rendered correctly to users but React was falling back to client-rendering the affected boundaries. Root-caused to Next 14 App Router's documented multi-`<Image priority>` hydration bug — narrowed every route to ≤1 priority image.",
    icon: AlertTriangle,
    tone: "warning",
    shippedAt: "today",
    commitSha: "907ee5b",
    items: [
      { title: "QA round #3: HTTP sweep (23/23 routes correct), Phase 11.2 ฿45.6K compact format verified, F19 mobile sheet trigger DOM verified, Phase 12.2.1 ban metadata re-verified via SSH+Prisma. Report: reports/qa-2026-04-26-r3.md" },
      { title: "F1 root cause: Next 14 fires React #418 + #422 when ≥2 <Image priority fill> render on the same route. The multiple <link rel=\"preload\"> injections post-render don't match the SSR snapshot" },
      { title: "/cart line thumbnails: priority → loading=\"lazy\" (small N at 80×80, no LCP impact)" },
      { title: "/browse first-row tiles: priority={i<4} → priority={i===0} (only the LCP card preloads; the next 3 drop to lazy and arrive a tick later, invisible on 4G/wifi)" },
      { title: "/ trending grid: dropped priority={i<2} entirely. The feature card auto-promotes via ProductCard's eagerLoad logic, so the LCP element stays priority — the grid below drops to lazy" },
      { title: "Defensive: also added suppressHydrationWarning to <html> in app/layout.tsx (themeBootstrapScript modifies className pre-hydration; standard next-themes pattern even though not the actual culprit here)" },
      { title: "Verified post-fix: /, /browse, /browse?sort=price_asc, /browse?category=fonts&minRating=4, /cart all log 0 console errors. Vitest 37/37, build clean (89.8 kB shared)" },
    ],
  },
  {
    id: "phase-12-2",
    title: "Phase 12.2 · User ban metadata",
    subtitle:
      "Schema-level distinction between 'user self-deleted' and 'admin removed for cause'. Today the AuditLog already records the reason in meta JSON, but it's not queryable as a first-class field on User and the moderation UI couldn't see it on the row. Now banned users wear a coral 'Banned' badge with the reason underneath.",
    icon: ShieldAlert,
    tone: "danger",
    shippedAt: "today",
    commitSha: "b787f66",
    items: [
      { title: "New migration: 20260426040000_phase_12_2_user_ban_metadata — adds banned_at + banned_reason columns + index, fully additive (no backfill, all existing rows stay NULL)" },
      { title: "DELETE /api/admin/users/[id] accepts optional { reason } body. With reason → bannedAt + bannedReason populated, audit becomes 'user.ban' + meta. Without reason → unchanged behaviour (deletedAt only, audit stays 'user.delete')" },
      { title: "UserRowActions: 'Delete user' → 'Remove user'. Opens a ConfirmDialog with a 120-char textarea for the reason. Confirm button label flips between 'Remove user' (no reason) and 'Ban user' (reason typed)" },
      { title: "/admin/users rows: banned users get a coral Badge + reason text underneath; soft-deleted-only users get a mist 'Deleted' badge. Hover any badge for full reason" },
      { title: "Convention: bannedAt SET ⇒ admin removal for cause; bannedAt NULL + deletedAt SET ⇒ user self-deleted (or pre-12.2 removal)" },
      { title: "Closes S8's 'User moderation fields (bannedAt / bannedReason)' proposal from Phase 11 run #2" },
    ],
  },
  {
    id: "phase-11-f19",
    title: "Phase 11 · F19 — /browse mobile bottom-sheet",
    subtitle:
      "Three layout improvements that the run #2 ux-polish specialist deferred as 'needs real layout work, not a polish pass'. Mobile gets a slide-up filter sheet with active-count badge; sidebar filter toggles preserve scroll position; sticky sidebar caps to viewport height.",
    icon: Filter,
    tone: "info",
    shippedAt: "today",
    commitSha: "aba77ed",
    items: [
      { title: "Mobile gets a 'Filters (N)' pill instead of stacking 4 filter cards above the product grid — opens a slide-up bottom-sheet (max 85vh, ESC + backdrop close, body scroll locked)" },
      { title: "Active-filter count badge on the trigger pill (computed server-side from search params: category + each tag + minRating + delivery)" },
      { title: "Every filter <a> converted to <Link scroll={false}> — toggling a tag/rating no longer slams the user back to the top of the grid" },
      { title: "Sticky sidebar gets max-h:calc(100vh-7rem) + overflow-y-auto so a long tag list doesn't run off-screen on shorter laptops" },
      { title: "Pagination intentionally KEEPS scroll-to-top — moving to a new page should land at the top of the new grid" },
      { title: "New sheet-rise keyframe (220ms platform-feeling cubic-bezier) added to globals.css" },
    ],
  },
  {
    id: "phase-11-2",
    title: "Phase 11.2 · moneyCompact() for KPI revenue cards",
    subtitle:
      "Phase 11.1 capped overflow with truncate but the result still ellipsed mid-number ('฿45,6…'). User asked for K/M abbreviations + smaller font. Now Total revenue / GMV / Lifetime revenue render as '฿45.6K' / '฿1.2M' and stay readable on every viewport.",
    icon: Wallet,
    tone: "warning",
    shippedAt: "today",
    commitSha: "b873994",
    items: [
      { title: "New moneyCompact() helper in lib/format.ts — below ฿1,000 falls through to money(); above uses en-US compact notation (฿45.6K, ฿1.2M, ฿1.5B)" },
      { title: "StatCard gains an optional valueTooltip prop — when value has been compacted, callers pass the precise figure so hover surfaces the exact amount" },
      { title: "StatCard highlight ramp dropped one notch (text-2xl→xl, sm:text-3xl→2xl, md:text-4xl→3xl, xl:text-5xl→4xl) — default + zero variants unchanged" },
      { title: "Wired into /seller (Total revenue), /admin (GMV paid), /seller/analytics (Revenue lifetime)" },
    ],
  },
  {
    id: "phase-12-1",
    title: "Phase 12.1 · Store live-rows partial index",
    subtitle:
      "Schema-only ship. Adds a Postgres partial index on store(created_at DESC) WHERE deleted_at IS NULL — covers every admin / public query that filters by the soft-delete flag (introduced by Phase 11 run #2 fixes F1, F12, F14). Free query-plan upgrade for /admin/stores, /admin/reports leaderboards, /, /health, public store browse. No app code change; Postgres planner picks the partial index automatically.",
    icon: Database,
    tone: "info",
    shippedAt: "today",
    commitSha: "912fc08",
    items: [
      { title: "New migration: 20260426030000_phase_12_1_store_live_partial_index" },
      { title: "CREATE INDEX store_live_idx ON store(created_at DESC) WHERE deleted_at IS NULL" },
      { title: "Existing store_deleted_at_idx preserved for moderation views that need to enumerate soft-deleted rows" },
      { title: "Skipped CONCURRENTLY (Prisma migrations run in a transaction); at current scale (~8 stores) the index builds instantly" },
      { title: "Cost: ~16 KB index storage at current scale, scales linearly with live store count. O(log n) vs O(n) on the live-stores filter" },
      { title: "Closes S8's 'Store index for KPI / soft-delete queries' proposal from Phase 11 run #2" },
    ],
  },
  {
    id: "phase-11-1",
    title: "Phase 11.1 · Post-deploy hotfixes",
    subtitle:
      "Two visual regressions caught after Phase 11 run #2 shipped — both CSS-only, single commit. /browse stopped overflowing the viewport on wide desktops; /seller's Total revenue StatCard stopped clipping when the number got large. Shared First Load JS unchanged (89.8 kB).",
    icon: Bug,
    tone: "warning",
    shippedAt: "today",
    commitSha: "362853d",
    items: [
      { title: "/browse parent grid: 1fr → minmax(0,1fr) so the column honours the viewport (the inner auto-fill product grid was pushing the layout past the right edge)" },
      { title: "StatCard highlight: shrink ramp text-3xl/text-5xl → text-2xl/sm:text-3xl/md:text-4xl/xl:text-5xl + tabular-nums for digit alignment" },
      { title: "StatCard value div: add min-w-0 + truncate + title attr so oversized baht values ellipse inside the card instead of pushing the layout sideways" },
      { title: "Bonus: also dropped the routable /not-found page so the URL falls through to the framework 404 (status code now matches the screen)" },
    ],
  },
  {
    id: "phase-11-run-2",
    title: "Phase 11 · QA workflow run #2",
    subtitle:
      "Second end-to-end QA pass. 22 findings ingested from a fresh live walk (0 P0 / 0 regressions / 17 NEW · 5 carry-over). 20 closed in one session, 1 deferred (user-53 prod soft-delete needs admin shell), 1 deferred (F19 layout restructure out-of-scope). 5 commits, no schema migration.",
    icon: FlaskConical,
    tone: "success",
    shippedAt: "yesterday",
    commitSha: "phase-11-r2",
    items: [
      { title: "F1 + F12 + F14 — Surgical deletedAt:null predicate on every admin query that surfaces stores/products (admin/stores, reports, stats, /health). Counts now agree across pages." },
      { title: "F2 — POST /api/orders revalidates / and /health so the homepage trending counts refresh without a manual reload" },
      { title: "F3 — leo-profanity guard wired into POST /api/auth/register + PATCH /api/auth/me (server-only, ~25 kB, zero client bundle impact)" },
      { title: "F4 + F10 — Image priority hints on first 4 /browse cards, first 2 trending cards, and cart line thumbnails — kills the placeholder flash above the fold" },
      { title: "F5 — ImageGallery thumbnail onError fallback (broken thumb URLs swap to placeholder instead of 0×0 gap)" },
      { title: "F6 — Multi-role badges in AuthMenu + /profile (mist Buyer + mint Seller when hasStore=true OR role=seller, yellow Admin override)" },
      { title: "F7 + F16 — DollarSign → Banknote on every baht StatCard ('USD' read by Thai users); equalize home stats grid columns" },
      { title: "F8 — New CartNavIcon (60s poll + cart:update window event) wired into TopNav + dispatched from PDP / cart mutations" },
      { title: "F9 — Coupon hint i18n: placeholder 'e.g. METU10' + 'not found' error now route through useI18n (10 EN + 10 TH new keys total)" },
      { title: "F11 — Sort dropdown's redundant Apply button removed (run #1 wired auto-submit; this rips out the leftover button)" },
      { title: "F13 — /admin/stores skeleton flash gone: getAdminStores helper replaces same-host HTTP hop with a direct Prisma call" },
      { title: "F15 — New <Avatar> primitive (xs/sm/md/lg/xl) with deterministic HSL hue + AA-contrast initials, wired into AuthMenu / admin users / messages / profile" },
      { title: "F17 — /admin/changelog header + TL;DR derive counts from BATCHES.shippedAt='today' (was the entire log) — singular/plural inline" },
      { title: "F18 — UK 'favourites' → US 'favorites' across every user-visible string (full i18n family added; nav.favorites EN value flipped)" },
      { title: "F21 — /not-found now emits HTTP 404 (was 200 OK) via app/not-found/page.tsx → notFound()" },
      { title: "F22 — Seller OrderStatusActions z-index + stopPropagation: Refund / Mark-fulfilled / Cancel buttons no longer get swallowed by the row click handler" },
      { title: "11 new Vitest tests for getInitials + avatarHue (26 → 37) · build clean (89.8 kB shared First Load JS, unchanged)" },
    ],
  },
  {
    id: "phase-11",
    title: "Phase 11 · QA workflow run #1",
    subtitle:
      "First end-to-end run of the user-tester → CEO → 8-specialist QA workflow. 28 findings ingested from a live walk; 27 closed in one session, 1 escalated + resolved (F22 sort/apply). 8 commits, no schema migration.",
    icon: FlaskConical,
    tone: "success",
    shippedAt: "yesterday",
    commitSha: "phase-11",
    items: [
      { title: "F1 — Soft-deleted offensive review on /product/100 (user 53 + cascade fix on getProduct reviews include)" },
      { title: "F2 — /admin/audit empty-state copy + verified the audit pipeline writes (1 → 6 rows from this run alone)" },
      { title: "F3 — /browse?category=<slug> now resolves slugs (was Number() → NaN → silent drop)" },
      { title: "F5 — Light-theme hero contrast: DIGITAL went from ~1.5:1 to ~17:1 via bg-hero-radial light override" },
      { title: "F6/F14/F23 — Junk-store cleanup (4 stores soft-deleted via admin API; KPIs auto-corrected)" },
      { title: "F8 — admin/stores + admin/users got their own loading.tsx skeletons" },
      { title: "F10 — Counter unify: home / health / admin all read Store.count (CEO Decision · Option A)" },
      { title: "F19 — New <ConfirmDialog> primitive (forms/) replaces window.confirm in 6 callsites; full ARIA contract" },
      { title: "F22 — Sort dropdown auto-submits via SortSelect (CEO Decision · Option A)" },
      { title: "F28 — /profile/edit skeleton-flash killed: route-scoped loading.tsx + cached getCountries" },
      { title: "Plus 6 ux-polish + 4 design-cohesion + 4 content-copy + 2 i18n + 1 a11y findings (full list in qa-2026-04-25.md)" },
    ],
  },
  {
    id: "phase-10",
    title: "Phase 10 · Authoring + messaging follow-ups",
    subtitle:
      "Q&A label bug + admin moderation + dashboard rebrand (every form a seller touches) + admin tables + messaging discoverability for buyers. Ten commits, no schema migration.",
    icon: MessageSquare,
    tone: "info",
    shippedAt: "yesterday",
    commitSha: "phase-10",
    items: [
      { title: "Q&A admin replies now show 'Admin answered' (was hard-coded 'Seller answered')" },
      { title: "Admin can edit/delete reviews + Q&A from product pages — coral 'MOD' pip + audit log" },
      { title: "Authoring primitives: FormSection, TextInput / Textarea / Select / NumberInput / PriceInput, VariantRow, PreviewPane, DataTable, ActionRow" },
      { title: "Seller forms rebuilt: NewProduct + EditProduct + EditStore + NewCoupon + BecomeSeller — multi-section layouts, sticky live preview" },
      { title: "Cramped 4-col variant grid → semantic VariantRow (delivery method label above qty/price/discount, not inside it)" },
      { title: "Admin tables: /admin/users + /stores + /reports + /audit consume DataTable + ActionRow with mint/coral tones" },
      { title: "Sidebar tokens unified (brand-yellow → metu-yellow); SellerSidebar unread dot switched amber → mint" },
      { title: "Buyer messaging is finally discoverable: chat icon + unread badge in TopNav, /messages buyer inbox, 'Messages' in AuthMenu" },
      { title: "'Message store' on /store/[id], 'Ask the seller' on /product/[id], 'Message seller about this order' on /orders/[id]" },
      { title: "FileImageInput compact thumbnail (was a giant aspect-5/2 box) — fixes 'ช่องใส่รูปใหญ่ไป' on /seller/products/new" },
    ],
  },
  {
    id: "batch-0",
    title: "Batch 0 · Perf regression hunt",
    subtitle:
      "Killed the cold-start lag the team noticed mid-presentation: keep-warm cron, parallel server fetches, reused Prisma client, dedicated pooled vs unpooled DB URLs.",
    icon: Zap,
    tone: "yellow",
    shippedAt: "04:55",
    commitSha: "fa8f6a7",
    items: [
      { title: "Vercel cron pings /api/health every 4 min — keeps Neon serverless compute warm" },
      { title: "Parallelised /product/[id] data fetches — saved one serial DB roundtrip" },
      { title: "Pinned Prisma client to globalThis on every env (was dev-only)" },
      { title: "Split DATABASE_URL (pooled, runtime) from DATABASE_URL_UNPOOLED (migrate deploy)" },
      { title: "Trimmed backdrop-blur radii + shadow blurs to fix scroll stutter" },
    ],
  },
  {
    id: "batch-a",
    title: "Batch A · Quick wins",
    subtitle:
      "Seven small UX delights that needed no schema changes — the kind of polish reviewers notice immediately.",
    icon: Sparkles,
    tone: "info",
    shippedAt: "08:54",
    commitSha: "e89f01d",
    items: [
      { title: "Recently-viewed products strip on /browse (localStorage, capped at 12)" },
      { title: "Share button on product + store (Web Share API w/ clipboard fallback)" },
      { title: "“X bought this in the last week” social-proof line on product detail" },
      { title: "Keyboard shortcuts: /, g b, g c, g f, ? — with a built-in cheatsheet dialog" },
      { title: "/profile/edit page with avatar, name, email, country, DOB, gender" },
      { title: "Change-password flow with current-password verify + bcrypt hash" },
      { title: "“Save for later” — moves a cart line into favorites in one click" },
    ],
  },
  {
    id: "batch-b",
    title: "Batch B · Seller tools",
    subtitle:
      "Sellers told us the dashboard felt thin. Seven tools to actually run a store — including the seller↔buyer inbox.",
    icon: Store,
    tone: "yellow",
    shippedAt: "09:42",
    commitSha: "4035c9e",
    items: [
      { title: "Duplicate product (one-click clone, paused by default for editing)" },
      { title: "Pause / resume product toggle — Product.isActive column + browse filter" },
      { title: "Seller ↔ buyer inbox at /seller/messages and /messages/[userId] (Message table)" },
      { title: "Coupon performance report at /seller/coupons/[id]/report" },
      { title: "Download sales CSV — /api/seller/orders/export.csv streams a file" },
      { title: "Low-stock banner on the seller dashboard for any variant ≤ 5" },
      { title: "Bulk-edit prices at /seller/products/bulk (apply ±N% to selected rows)" },
    ],
  },
  {
    id: "batch-c",
    title: "Batch C · Buyer growth",
    subtitle:
      "Seven features aimed at conversion + return visits — Q&A, free samples, related products, comparisons, gift checkout, rating filter, restock alerts.",
    icon: ShoppingBag,
    tone: "success",
    shippedAt: "11:19",
    commitSha: "570bb58",
    items: [
      { title: "Product Q&A — buyers ask, seller answers inline (ProductQuestion table)" },
      { title: "Free sample download per variant (sampleUrl on ProductItem)" },
      { title: "“More like this” related-products row at the bottom of /product/[id]" },
      { title: "/compare page — side-by-side comparison of up to 3 products" },
      { title: "Gift checkout (recipient email + message stored on Order)" },
      { title: "Minimum-rating filter on /browse" },
      { title: "“Notify me on restock” buttons + StockAlert table" },
    ],
  },
  {
    id: "fix-admin",
    title: "Fix · Admin role + scroll feel",
    subtitle:
      "Two surface fixes you flagged in chat — admin couldn't open a store without losing their role, and scrolling needed smoothing.",
    icon: Wrench,
    tone: "purple",
    shippedAt: "12:01",
    commitSha: "bfb8abc",
    items: [
      { title: "/api/seller/become-seller no longer demotes admins to seller on store creation" },
      { title: "Prominent “Admin panel” button in TopNav for admin role only" },
      { title: "Smooth scroll behaviour on <html> + scroll-padding-top for sticky nav" },
      { title: "Reduced-motion media query disables both smooth scroll and animations" },
    ],
  },
  {
    id: "batch-g",
    title: "Batch G · Tests",
    subtitle:
      "Two test suites: Vitest for pure helpers (sub-second) and Playwright smoke tests covering all four personas against the live deploy. The pre-deploy regression gate the demo backlog asked for.",
    icon: FlaskConical,
    tone: "yellow",
    shippedAt: "14:39",
    commitSha: "51e520e",
    items: [
      { title: "Vitest + @vitest/coverage-v8 wired with `npm test -w @metu/web`" },
      { title: "26 unit tests across 2 files run in ~500 ms — pure helpers, no jsdom" },
      { title: "Extracted coupon math + maxForLine + subtotal helpers into lib/cart-math.ts" },
      { title: "Extracted cardImage URL transform into lib/utils.ts (now reusable + tested)" },
      { title: "Playwright + Chromium runs against https://metu.fly.dev (override with BASE_URL)" },
      { title: "Four persona smoke specs: guest / buyer / seller / admin — happy path each" },
      { title: "Full e2e suite passes in ~20 s on cold Neon — the pre-deploy regression gate" },
    ],
  },
  {
    id: "batch-f",
    title: "Batch F · Observability",
    subtitle:
      "Production-grade monitoring — Sentry error tracking + Plausible analytics, both env-optional so they only activate when keys are configured. Plus a public /health page anyone can hit.",
    icon: Activity,
    tone: "success",
    shippedAt: "13:55",
    commitSha: "5f7937c",
    items: [
      { title: "@sentry/nextjs v10 wired into instrumentation.ts (server + edge) and instrumentation-client.ts (browser)" },
      { title: "DSN env-gated — no DSN, no init, no requests. Lazy-imported on the client so the SDK only ships when configured." },
      { title: "global-error.tsx captures top-of-tree React render errors that escape per-route boundaries" },
      { title: "Sample rates: 1.0 in dev, 0.2 in prod; releases tagged with the deploy SHA" },
      { title: "Plausible analytics drop-in (NEXT_PUBLIC_PLAUSIBLE_DOMAIN env), cookie-free, no consent banner" },
      { title: "Public /health page — DB ping, uptime, build SHA, region, soft-delete-aware catalogue counts" },
      { title: "Color-graded ping badge (FAST / OK / SLOW / DOWN) so on-call can read status at a glance" },
    ],
  },
  {
    id: "batch-e",
    title: "Batch E · Platform polish",
    subtitle:
      "Seven items aimed at the next layer of polish — discoverability (PWA + sitemap), accessibility (skip-to-content + focus-trap), graceful 404, light mode, and scoped TH/EN i18n.",
    icon: Palette,
    tone: "info",
    shippedAt: "07:57",
    commitSha: "b08c41c",
    items: [
      { title: "PWA manifest at /manifest.webmanifest with branded SVG icons (any + maskable)" },
      { title: "Dynamic /sitemap.xml (top 200 products + all stores) and /robots.txt" },
      { title: "Custom 404 with popular-categories suggestions below the CTAs" },
      { title: "Skip-to-content link + id=\"main\" wired into all 27 pages (WCAG 2.4.1)" },
      { title: "useFocusTrap() hook on WriteReviewDialog + keyboard cheatsheet (WCAG 2.4.3)" },
      { title: "Light mode toggle in TopNav — persists to localStorage, no flash on reload" },
      { title: "TH/EN i18n in TopNav, footer, search placeholder, cart empty state" },
    ],
  },
  {
    id: "batch-d",
    title: "Batch D · Trust & security",
    subtitle:
      "The biggest batch of the day — rate limits, password reset, soft-delete + audit log on every destructive action, Turnstile CAPTCHA, GDPR data export.",
    icon: Shield,
    tone: "danger",
    shippedAt: "12:24",
    commitSha: "1f67c0a",
    items: [
      { title: "Rate-limit middleware (5/min per IP) on login, register, forgot-password" },
      { title: "Password reset flow — /forgot-password and /reset-password pages, SHA-256 hashed tokens, 30-min TTL" },
      { title: "Email facade — picks console (dev) or Resend (when RESEND_API_KEY is set)" },
      { title: "AuditLog table + audit() helper wired into every destructive admin/seller route" },
      { title: "Soft-delete (deletedAt) on User / Store / Product — public surfaces filter immediately" },
      { title: "Cloudflare Turnstile CAPTCHA on /register (no-op without TURNSTILE_SECRET)" },
      { title: "GDPR export — GET /api/profile/export streams a JSON dump of the user's data" },
      { title: "/admin/audit page — paginated, filterable by action + target type" },
    ],
  },
];

const REPO_URL = "https://github.com/Bank848/metu";

export default function ChangelogPage() {
  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Headline counts only reflect what shipped TODAY — older batches stay
  // in the list as historical record but don't inflate the "shipped
  // today" totals (was the F17 bug: 80 features / 11 batches reported as
  // today's work when only 2 batches actually landed today).
  const todayBatches = BATCHES.filter((b) => b.shippedAt === "today");
  const todayBatchCount = todayBatches.length;
  const todayItemCount = todayBatches.reduce((sum, b) => sum + b.items.length, 0);
  const totalItems = BATCHES.reduce((sum, b) => sum + b.items.length, 0);

  return (
    <>
      <PageHeader
        title="What's new"
        subtitle={`${todayBatchCount} ${todayBatchCount === 1 ? "batch" : "batches"} · ${todayItemCount} ${todayItemCount === 1 ? "item" : "items"} shipped today (${today}) · ${BATCHES.length} batches / ${totalItems} items in the full log`}
      />

      {/* TL;DR strip — for the friend you'll show this to first. */}
      <section className="mb-8 rounded-2xl border border-brand-yellow/30 bg-gradient-to-br from-brand-yellow/10 to-transparent p-6">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-brand-yellow mb-2">
          <Sparkles className="h-3.5 w-3.5" />
          TL;DR
        </div>
        <p className="text-base text-white leading-relaxed">
          Today we shipped <strong className="text-brand-yellow">{todayItemCount} items across {todayBatchCount} {todayBatchCount === 1 ? "batch" : "batches"}</strong>{" "}
          — performance fixes, quick UX wins, seller tools, buyer-growth features, the admin/role fix you noticed,
          and a full trust &amp; security pass (rate limits, password reset, audit log, CAPTCHA, GDPR export).
          Everything is live on{" "}
          <a
            href="https://metu.fly.dev"
            className="text-brand-yellow underline underline-offset-2 hover:text-brand-yellowDark"
            target="_blank"
            rel="noopener noreferrer"
          >
            metu.fly.dev
          </a>
          .
        </p>
      </section>

      {/* Batch cards */}
      <div className="space-y-6">
        {BATCHES.map((batch) => {
          const Icon = batch.icon;
          return (
            <article
              key={batch.id}
              className="rounded-2xl border border-line bg-space-850 overflow-hidden"
            >
              <header className="px-6 py-5 border-b border-line flex items-start gap-4">
                <div className="shrink-0 h-11 w-11 rounded-xl bg-space-900 border border-line flex items-center justify-center">
                  <Icon className="h-5 w-5 text-brand-yellow" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="font-display text-lg font-bold text-white">
                      {batch.title}
                    </h2>
                    <Badge variant={batch.tone}>{batch.items.length} items</Badge>
                  </div>
                  <p className="text-sm text-ink-secondary mt-1">{batch.subtitle}</p>
                  <div className="mt-2 flex items-center gap-3 text-[11px] font-mono text-ink-dim">
                    <span>shipped {batch.shippedAt}</span>
                    <span>·</span>
                    <a
                      href={`${REPO_URL}/commit/${batch.commitSha}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 hover:text-brand-yellow"
                    >
                      <GitCommit className="h-3 w-3" />
                      {batch.commitSha}
                      <ExternalLink className="h-2.5 w-2.5 opacity-60" />
                    </a>
                  </div>
                </div>
              </header>
              <ul className="divide-y divide-line">
                {batch.items.map((it, i) => (
                  <li key={i} className="px-6 py-3 flex items-start gap-3">
                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-brand-yellow shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white">{it.title}</p>
                      {it.detail && (
                        <p className="text-xs text-ink-dim mt-1">{it.detail}</p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </article>
          );
        })}
      </div>

      <p className="mt-8 text-xs text-ink-dim text-center">
        See the full commit history on{" "}
        <a
          href={REPO_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-brand-yellow hover:underline"
        >
          GitHub
        </a>
        .
      </p>
    </>
  );
}
