import Link from "next/link";
import {
  Database,
  CreditCard,
  ShieldCheck,
  Mail,
  Tags,
  Layers,
  ArrowRight,
  Sparkles,
  Lock,
  Zap,
  KeyRound,
  Receipt,
  Network,
  type LucideIcon,
} from "lucide-react";
import { Reveal } from "./Reveal";
import { AnimatedCounter } from "./AnimatedCounter";
import { ErDiagramView } from "@/components/admin/ErDiagramView";

export const metadata = {
  title: "Feature Tour — METU",
  description: "Walk through every system in the METU marketplace.",
};

interface FeatureSection {
  icon: LucideIcon;
  badge: string;
  title: string;
  body: string;
  bullets: string[];
  cta?: { href: string; label: string };
  accent: "mint" | "blue" | "yellow" | "pink" | "purple" | "orange" | "red" | "cyan";
}

const SECTIONS: FeatureSection[] = [
  {
    icon: Database,
    badge: "Schema",
    title: "27 entities · normalized to 3NF",
    body:
      "The Prisma schema is the single source of truth — every deploy auto-generates migrations, the live ER diagram, and TypeScript types from one file.",
    bullets: [
      "Soft-delete pattern on User / Store / Product (deletedAt column)",
      "One RESTRICT FK stops hard-deletes from cascading into order_item",
      "Triggers + views + GRANT/REVOKE roles + 6 CHECK constraints",
    ],
    accent: "purple",
  },
  {
    icon: CreditCard,
    badge: "Payments",
    title: "Stripe Connect (TH recipient model)",
    body:
      "Stripe Thailand bans the platform from being loss-liable, so we use the controller-based recipient model with direct charges sent through the Stripe-Account header.",
    bullets: [
      "PaymentIntent created on the connected account; application_fee_amount captured for the platform",
      "Webhook idempotency stored in AuditLog.meta JSONB — no extra table needed",
      "Manual payout button on /seller/wallet (TH default schedule is weekly)",
    ],
    cta: { href: "/seller/wallet", label: "View /seller/wallet" },
    accent: "pink",
  },
  {
    icon: Receipt,
    badge: "Order delivery",
    title: "Real license keys + download URLs",
    body:
      "Once the Stripe webhook confirms payment, finalizeOrder() generates a key or snapshots the URL onto order_item, then sends a receipt email grouped by store.",
    bullets: [
      "license_key_template (METU-XXXX-XXXX-XXXX) or UUID v4 fallback",
      "delivery_url is snapshotted so seller edits don't break old buyers",
      "Email and the /orders/[id] card both read from the same snapshot",
    ],
    accent: "mint",
  },
  {
    icon: KeyRound,
    badge: "Auth",
    title: "better-auth + Google OAuth + TOTP step-up",
    body:
      "Session-table-backed auth with OAuth handshake and email verification; TOTP 2FA enrolment with step-up gating sensitive routes (refund, revoke-all).",
    bullets: [
      "Session.lastTotpAt + requireRecent2FA(15) middleware",
      "Modal auto-retries when admin refund hits 403 TotpStepUpRequired",
      "Sessions UI revokes per device, plus a sign-out-everywhere-else button",
    ],
    cta: { href: "/profile/sessions", label: "View sessions UI" },
    accent: "blue",
  },
  {
    icon: Tags,
    badge: "Coupons",
    title: "Master coupons + per-user uniqueness",
    body:
      "storeId nullable means a master coupon works across every store; @@unique([couponId, userId]) enforces one redemption per user.",
    bullets: [
      "Partial unique index WHERE store_id IS NULL prevents duplicate codes",
      "App layer applies the discount to every line for master coupons; only the matching store for per-store coupons",
      "usage_limit caps total platform-wide redemptions",
    ],
    accent: "yellow",
  },
  {
    icon: ShieldCheck,
    badge: "Security",
    title: "Helmet + CSP + sliding-window rate limits",
    body:
      "Both the BFF and the API ship Helmet with HSTS / CSP / X-Frame-Options / Permissions-Policy; five rate-limiters guard the auth-mutating routes.",
    bullets: [
      "login 5/min, register 3/hr/IP, OTP 3/min, forgot-pw 3/hr",
      "Audit log: 10 events covering TOTP, sessions, password, OAuth",
      "better-auth cookie: httpOnly + secure + sameSite=lax",
    ],
    accent: "red",
  },
  {
    icon: Mail,
    badge: "Receipts",
    title: "Resend email · grouped by store",
    body:
      "Receipts go out after payment_intent.succeeded fires, with HTML + plain-text alternate parts and a section per store plus contact details at the bottom.",
    bullets: [
      "Console fallback when RESEND_API_KEY is unset (Fly logs printable)",
      "Subject auto-fills 'items from <Store>' or 'items from N stores'",
      "Inline-styled HTML — no CSS classes, for email-client compatibility",
    ],
    accent: "orange",
  },
  {
    icon: Layers,
    badge: "Stack",
    title: "Modern monorepo · 8 layered categories",
    body:
      "Next.js 14 BFF + Express API + Prisma + better-auth + Stripe + Resend + Helmet + 144 tests. The tech stack page surfaces live versions on demand.",
    bullets: [
      "Auto-extracts package.json versions at build → infographic",
      "8 categories: Frontend / Backend / Auth / Database / Payments / Security / Tests / Build",
      "Other deps section covers types + peer deps + tooling glue",
    ],
    cta: { href: "/admin/tech-stack", label: "View tech stack" },
    accent: "blue",
  },
];

const ACCENT_CLASS: Record<FeatureSection["accent"], { bg: string; text: string; ring: string; gradient: string }> = {
  mint:    { bg: "bg-emerald-500", text: "text-emerald-300", ring: "ring-emerald-400/30", gradient: "from-emerald-500/20 to-transparent" },
  blue:    { bg: "bg-blue-500",    text: "text-blue-300",    ring: "ring-blue-400/30",    gradient: "from-blue-500/20 to-transparent" },
  yellow:  { bg: "bg-amber-500",   text: "text-amber-300",   ring: "ring-amber-400/30",   gradient: "from-amber-500/20 to-transparent" },
  pink:    { bg: "bg-pink-500",    text: "text-pink-300",    ring: "ring-pink-400/30",    gradient: "from-pink-500/20 to-transparent" },
  purple:  { bg: "bg-purple-500",  text: "text-purple-300",  ring: "ring-purple-400/30",  gradient: "from-purple-500/20 to-transparent" },
  orange:  { bg: "bg-orange-500",  text: "text-orange-300",  ring: "ring-orange-400/30",  gradient: "from-orange-500/20 to-transparent" },
  red:     { bg: "bg-rose-500",    text: "text-rose-300",    ring: "ring-rose-400/30",    gradient: "from-rose-500/20 to-transparent" },
  cyan:    { bg: "bg-cyan-500",    text: "text-cyan-300",    ring: "ring-cyan-400/30",    gradient: "from-cyan-500/20 to-transparent" },
};

export default function FeatureTourPage() {
  return (
    <main className="min-h-screen bg-space-black text-white relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-0">
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full bg-mint/10 blur-3xl animate-blob-slow" />
        <div className="absolute top-1/3 -right-40 w-[500px] h-[500px] rounded-full bg-purple-500/10 blur-3xl animate-blob-slow [animation-delay:-7s]" />
        <div className="absolute bottom-0 left-1/4 w-[500px] h-[500px] rounded-full bg-amber-500/10 blur-3xl animate-blob-slow [animation-delay:-14s]" />
      </div>

      <section className="relative px-6 md:px-12 pt-24 pb-32 max-w-6xl mx-auto">
        <Reveal from="up">
          <div className="inline-flex items-center gap-2 rounded-full border border-mint/30 bg-mint/5 px-4 py-1.5 text-xs font-semibold text-mint mb-8">
            <Sparkles className="h-3.5 w-3.5" />
            CPE241 · Database Systems · KMUTT G.8
          </div>
        </Reveal>

        <Reveal from="up" delay="delay-100">
          <h1 className="font-display text-5xl md:text-7xl font-extrabold leading-tight tracking-tight">
            METU is a <span className="text-gold-gradient">digital marketplace</span>
            <br />for Thai creators.
          </h1>
        </Reveal>

        <Reveal from="up" delay="delay-200">
          <p className="mt-6 text-lg text-ink-secondary max-w-2xl">
            Buyers pay through Stripe, sellers receive payouts, and license keys ship via email
            and appear on /orders. The 27-entity 3NF schema runs live on Supabase in Singapore.
          </p>
        </Reveal>

        <Reveal from="up" delay="delay-300">
          <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-3 max-w-3xl">
            <HeroStat label="Entities" value={27} />
            <HeroStat label="Migrations" value={29} />
            <HeroStat label="Tests" value={144} />
            <HeroStat label="Tier-1 Stripe" value={1} suffix=" mode" />
          </div>
        </Reveal>

        <Reveal from="up" delay="delay-500">
          <div className="mt-12 flex flex-wrap items-center gap-3">
            <Link
              href="/browse"
              className="inline-flex items-center gap-2 rounded-full bg-metu-yellow text-space-950 px-6 py-3 font-bold hover:bg-metu-yellow/90 transition shadow-lg shadow-metu-yellow/20"
            >
              <Zap className="h-4 w-4" />
              Browse the marketplace
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </Reveal>
      </section>

      <section className="relative px-6 md:px-12 pb-24 max-w-7xl mx-auto">
        <Reveal from="up">
          <div className="inline-flex items-center gap-2 rounded-full bg-purple-500/10 text-purple-300 ring-1 ring-purple-400/30 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider mb-4">
            <Network className="h-3.5 w-3.5" />
            Live ER diagram
          </div>
        </Reveal>
        <Reveal from="up" delay="delay-100">
          <h2 className="font-display text-3xl md:text-4xl font-bold text-white mb-3 leading-tight">
            Crow-foot schema · rendered straight from Prisma
          </h2>
        </Reveal>
        <Reveal from="up" delay="delay-200">
          <p className="text-ink-secondary leading-relaxed mb-6 max-w-3xl">
            This is the same diagram you would see at /admin/er-diagram, embedded here so we
            can walk through it during the defense. Drag to pan, ctrl+wheel to zoom, double-click
            to fit. Every box is an entity in the schema; every line is a foreign key with crow-foot
            cardinality on each end.
          </p>
        </Reveal>
        <Reveal from="up" delay="delay-300">
          <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-2 md:p-3 shadow-2xl">
            <div className="h-[640px] rounded-2xl overflow-hidden">
              <ErDiagramView />
            </div>
          </div>
        </Reveal>
        <Reveal from="up" delay="delay-400">
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
            <DiagramHint
              title="Identity & sessions"
              body="users, account, session, password_reset_token, email_verify_token — better-auth lives in this corner."
            />
            <DiagramHint
              title="Catalog & orders"
              body="store → product → product_item → order_item is the spine; cart is a parallel pre-checkout chain."
            />
            <DiagramHint
              title="Money & audit"
              body="transaction snapshots Stripe state; coupon plus coupon_usage gate discounts; audit_log captures every destructive admin action."
            />
          </div>
        </Reveal>
      </section>

      <section className="relative px-6 md:px-12 pb-32 max-w-6xl mx-auto">
        <div className="space-y-24">
          {SECTIONS.map((s, i) => (
            <FeatureBlock key={s.title} section={s} flipped={i % 2 === 1} />
          ))}
        </div>
      </section>

      <section className="relative px-6 md:px-12 pb-32 max-w-6xl mx-auto">
        <Reveal from="scale">
          <div className="rounded-3xl border border-mint/30 bg-gradient-to-br from-mint/10 via-space-900 to-mint/5 p-10 md:p-14 text-center">
            <Sparkles className="h-10 w-10 text-mint mx-auto mb-4" />
            <h2 className="font-display text-3xl md:text-4xl font-bold text-white mb-3">
              The system is already live · every page is interactive
            </h2>
            <p className="text-ink-secondary mb-8 max-w-2xl mx-auto">
              Use the buyer demo account on the login page to try the buy / cart / order flows.
              The admin demo account opens /admin/er-diagram and /admin/tech-stack directly.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link href="/login" className="inline-flex items-center gap-2 rounded-full bg-mint text-space-950 px-6 py-3 font-bold hover:bg-mint/90 transition">
                <Lock className="h-4 w-4" />
                Sign in
              </Link>
              <Link href="/browse" className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-6 py-3 font-semibold hover:bg-white/10 transition">
                Browse without login
              </Link>
            </div>
          </div>
        </Reveal>
      </section>
    </main>
  );
}

function HeroStat({ label, value, suffix = "" }: { label: string; value: number; suffix?: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] backdrop-blur px-4 py-4">
      <div className="text-[10px] uppercase tracking-wider text-ink-dim">{label}</div>
      <div className="font-display text-3xl font-extrabold text-white mt-1 leading-none">
        <AnimatedCounter target={value} suffix={suffix} />
      </div>
    </div>
  );
}

function DiagramHint({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
      <div className="text-[11px] uppercase tracking-wider text-ink-dim mb-1">{title}</div>
      <div className="text-ink-secondary leading-relaxed">{body}</div>
    </div>
  );
}

function FeatureBlock({ section, flipped }: { section: FeatureSection; flipped: boolean }) {
  const accent = ACCENT_CLASS[section.accent];
  const Icon = section.icon;
  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 gap-10 items-center ${flipped ? "md:[&>*:first-child]:order-last" : ""}`}>
      <div>
        <Reveal from={flipped ? "right" : "left"}>
          <div className={`inline-flex items-center gap-2 rounded-full ${accent.bg}/10 ${accent.text} ring-1 ${accent.ring} px-3 py-1 text-[11px] font-semibold uppercase tracking-wider mb-4`}>
            <Icon className="h-3.5 w-3.5" />
            {section.badge}
          </div>
        </Reveal>
        <Reveal from={flipped ? "right" : "left"} delay="delay-100">
          <h3 className="font-display text-3xl md:text-4xl font-bold text-white mb-3 leading-tight">
            {section.title}
          </h3>
        </Reveal>
        <Reveal from={flipped ? "right" : "left"} delay="delay-200">
          <p className="text-ink-secondary leading-relaxed mb-5">{section.body}</p>
        </Reveal>
        <Reveal from={flipped ? "right" : "left"} delay="delay-300">
          <ul className="space-y-2 mb-6">
            {section.bullets.map((b) => (
              <li key={b} className="flex items-start gap-2.5 text-sm text-ink-secondary">
                <span className={`mt-1.5 inline-block h-1.5 w-1.5 rounded-full ${accent.bg} shrink-0`} />
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </Reveal>
        {section.cta && (
          <Reveal from={flipped ? "right" : "left"} delay="delay-400">
            <Link
              href={section.cta.href}
              className={`inline-flex items-center gap-2 rounded-full bg-white/5 border border-white/10 ${accent.text} px-5 py-2.5 text-sm font-semibold hover:bg-white/10 transition`}
            >
              {section.cta.label}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Reveal>
        )}
      </div>

      <Reveal from={flipped ? "left" : "right"} delay="delay-150">
        <div className={`relative aspect-[4/3] rounded-3xl border border-white/10 bg-gradient-to-br ${accent.gradient} via-space-900 to-space-950 overflow-hidden flex items-center justify-center`}>
          <div className={`relative ${accent.text} animate-float-slow`}>
            <div className={`absolute inset-0 ${accent.bg} blur-3xl opacity-30 animate-pulse-slow`} />
            <Icon className="relative h-32 w-32" strokeWidth={1.2} />
          </div>
          <div
            className="absolute inset-0 pointer-events-none opacity-[0.04]"
            style={{
              backgroundImage:
                "linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)",
              backgroundSize: "32px 32px",
            }}
          />
        </div>
      </Reveal>
    </div>
  );
}
