import { Sparkles, Zap, Store, ShoppingBag, Shield, Wrench, GitCommit, ExternalLink, Palette, Activity, FlaskConical } from "lucide-react";
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
      { title: "“Save for later” — moves a cart line into favourites in one click" },
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

  const totalItems = BATCHES.reduce((sum, b) => sum + b.items.length, 0);

  return (
    <>
      <PageHeader
        title="What's new"
        subtitle={`${BATCHES.length} batches · ${totalItems} features shipped today (${today})`}
      />

      {/* TL;DR strip — for the friend you'll show this to first. */}
      <section className="mb-8 rounded-2xl border border-brand-yellow/30 bg-gradient-to-br from-brand-yellow/10 to-transparent p-6">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-brand-yellow mb-2">
          <Sparkles className="h-3.5 w-3.5" />
          TL;DR
        </div>
        <p className="text-base text-white leading-relaxed">
          Today we shipped <strong className="text-brand-yellow">{totalItems} features across {BATCHES.length} batches</strong>{" "}
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
