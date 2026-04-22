import { Sparkles, Zap, Store, ShoppingBag, Shield, Wrench, GitCommit, ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/Badge";

export const dynamic = "force-static";

/**
 * Admin-only changelog. Static page — every batch we ship gets a card
 * here so the team has a single place to point at when asked "what
 * actually changed today?". Server-component, no JS shipped.
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
