import Link from "next/link";
import {
  Database,
  CreditCard,
  ShieldCheck,
  Mail,
  Tags,
  Monitor,
  Network,
  Layers,
  ArrowRight,
  Sparkles,
  Lock,
  Zap,
  KeyRound,
  Receipt,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Reveal } from "./Reveal";
import { AnimatedCounter } from "./AnimatedCounter";

export const metadata = {
  title: "Feature Tour — METU",
  description: "Walk through every system in the METU marketplace.",
};

/**
 * Phase 40 - feature tour landing page.
 *
 * Designed to play on a projector during the CPE241 defense. Plain
 * HTML / Tailwind transitions + scroll-triggered IntersectionObserver
 * animations (no framer-motion dep). Each section fades in from the
 * bottom as the presenter scrolls, the hero counter animates from
 * zero, gradient orbs drift in the background.
 *
 * Public route - no auth gate so the demo loads instantly.
 */

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
      "Prisma schema เป็น single source of truth ; auto-gen migrations + ER diagram + TypeScript types ทุก deploy.",
    bullets: [
      "Soft-delete pattern บน User / Store / Product (deletedAt column)",
      "1 RESTRICT FK กัน hard-delete ลามถึง order_item",
      "Triggers + Views + GRANT/REVOKE roles + 6 CHECK constraints",
    ],
    cta: { href: "/admin/er-diagram", label: "เปิด ER diagram" },
    accent: "purple",
  },
  {
    icon: CreditCard,
    badge: "Payments",
    title: "Stripe Connect (TH recipient model)",
    body:
      "Stripe TH ห้าม platform เป็น loss-liable ; ใช้ controller-based recipient model + direct charge ผ่าน Stripe-Account header.",
    bullets: [
      "PaymentIntent สร้างบน connected account เก็บ application_fee_amount",
      "Webhook idempotency ผ่าน AuditLog.meta JSONB ไม่ต้องเพิ่ม table",
      "Manual payout button บน /seller/wallet สำหรับ demo",
    ],
    cta: { href: "/seller/wallet", label: "ดู /seller/wallet" },
    accent: "pink",
  },
  {
    icon: Receipt,
    badge: "Order delivery",
    title: "License key + download URL ส่งจริง",
    body:
      "หลัง Stripe webhook ยืนยันจ่าย → finalizeOrder() generate key หรือ snapshot URL ลง order_item + ส่ง receipt email grouped by store.",
    bullets: [
      "license_key_template (METU-XXXX-XXXX-XXXX) หรือ UUID v4 fallback",
      "delivery_url snapshot กัน seller แก้ทีหลังกระทบบัญชีเก่า",
      "Email + UI card on /orders/[id] ใช้ snapshot เดียวกัน",
    ],
    accent: "mint",
  },
  {
    icon: KeyRound,
    badge: "Auth",
    title: "better-auth + Google OAuth + TOTP step-up",
    body:
      "Session table-backed auth ; OAuth handshake + email verify ; TOTP 2FA enrol → step-up บน sensitive routes (refund, revoke-all).",
    bullets: [
      "Session.lastTotpAt + requireRecent2FA(15) middleware",
      "Modal auto-retry เมื่อ 403 TotpStepUpRequired ตอน admin refund",
      "Sessions UI revoke per-device + revoke-everywhere-else",
    ],
    cta: { href: "/profile/sessions", label: "ดู sessions UI" },
    accent: "blue",
  },
  {
    icon: Tags,
    badge: "Coupons",
    title: "Master Coupon + per-user uniqueness",
    body:
      "storeId nullable → master coupon ใช้ได้ทุกร้าน ; @@unique([couponId, userId]) บังคับ 1 user 1 ใช้.",
    bullets: [
      "Partial unique index WHERE store_id IS NULL กัน code ซ้ำ",
      "App layer apply discount ทุก line ถ้า master ; เฉพาะร้านนั้นถ้า per-store",
      "usage_limit field ใช้ cap จำนวนครั้งทั้ง platform",
    ],
    accent: "yellow",
  },
  {
    icon: Network,
    badge: "ER renderer",
    title: "In-house crow-foot ER diagram",
    body:
      "เปิดมาจาก er-schema.ts (auto-gen จาก Prisma) วาดเอง category-grid + crow-foot connectors + drag/zoom/keyboard shortcuts.",
    bullets: [
      "Wheel zoom around cursor + shift+wheel pan + double-click fit",
      "Keyboard: + / - / 0 / f shortcuts",
      "Export SVG หรือ PNG (2x DPR) สำหรับใส่ในรายงาน",
    ],
    cta: { href: "/admin/er-diagram", label: "ลองเล่น" },
    accent: "cyan",
  },
  {
    icon: ShieldCheck,
    badge: "Security",
    title: "Helmet + CSP + sliding-window rate limits",
    body:
      "BFF + API ทั้งคู่มี HSTS / CSP / X-Frame-Options / Permissions-Policy ; 5 rate-limiters บน auth-mutating routes.",
    bullets: [
      "login 5/min, register 3/hr/IP, OTP 3/min, forgot-pw 3/hr",
      "Audit log: 10 events ครอบคลุม TOTP, sessions, password, OAuth",
      "Better-auth cookie: httpOnly + secure + sameSite=lax",
    ],
    accent: "red",
  },
  {
    icon: Mail,
    badge: "Receipts",
    title: "Resend email · grouped by store",
    body:
      "ส่ง receipt หลัง payment_intent.succeeded fire ; HTML + plain-text alternate parts ; แยก section ต่อร้าน + ติดต่อร้านล่างสุด.",
    bullets: [
      "Console fallback ถ้า RESEND_API_KEY ไม่ set (Fly logs printable)",
      "Subject auto: 'items from <Store>' หรือ 'items from N stores'",
      "Inline-styled HTML ไม่พึ่ง CSS class - email-client compat",
    ],
    accent: "orange",
  },
  {
    icon: Layers,
    badge: "Stack",
    title: "Modern monorepo · 8 layered categories",
    body:
      "Next.js 14 BFF + Express API + Prisma + better-auth + Stripe + Resend + Helmet + 144 tests. Tech stack page โชว์ live versions.",
    bullets: [
      "Auto-extract package.json versions ตอน build → infographic",
      "8 หมวด: Frontend / Backend / Auth / Database / Payments / Security / Tests / Build",
      "Other deps section รวม types + peer deps + tooling glue",
    ],
    cta: { href: "/admin/tech-stack", label: "ดู tech stack" },
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
      {/* Drifting gradient orbs in the background */}
      <div className="pointer-events-none absolute inset-0 -z-0">
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full bg-mint/10 blur-3xl animate-blob-slow" />
        <div className="absolute top-1/3 -right-40 w-[500px] h-[500px] rounded-full bg-purple-500/10 blur-3xl animate-blob-slow [animation-delay:-7s]" />
        <div className="absolute bottom-0 left-1/4 w-[500px] h-[500px] rounded-full bg-amber-500/10 blur-3xl animate-blob-slow [animation-delay:-14s]" />
      </div>

      {/* Hero */}
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
            Buyers จ่าย Stripe, sellers ได้ payout, license keys ส่งทาง email + แสดงบนหน้า /orders.
            Schema 27 entities normalized 3NF run live บน Supabase ใน Singapore.
          </p>
        </Reveal>

        {/* Hero stats */}
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
            <Link
              href="/admin/er-diagram"
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-6 py-3 font-semibold hover:bg-white/10 transition"
            >
              <Network className="h-4 w-4" />
              Open ER diagram
            </Link>
          </div>
        </Reveal>
      </section>

      {/* Feature sections */}
      <section className="relative px-6 md:px-12 pb-32 max-w-6xl mx-auto">
        <div className="space-y-24">
          {SECTIONS.map((s, i) => (
            <FeatureBlock key={s.title} section={s} flipped={i % 2 === 1} />
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative px-6 md:px-12 pb-32 max-w-6xl mx-auto">
        <Reveal from="scale">
          <div className="rounded-3xl border border-mint/30 bg-gradient-to-br from-mint/10 via-space-900 to-mint/5 p-10 md:p-14 text-center">
            <Sparkles className="h-10 w-10 text-mint mx-auto mb-4" />
            <h2 className="font-display text-3xl md:text-4xl font-bold text-white mb-3">
              ระบบ live อยู่แล้ว · ลองได้ทุกหน้า
            </h2>
            <p className="text-ink-secondary mb-8 max-w-2xl mx-auto">
              ใช้ buyer demo account ที่หน้า login เพื่อทดลอง buy / cart / order page.
              Admin demo account เปิด /admin/er-diagram และ /admin/tech-stack ได้เลย.
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

function FeatureBlock({ section, flipped }: { section: FeatureSection; flipped: boolean }) {
  const accent = ACCENT_CLASS[section.accent];
  const Icon = section.icon;
  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 gap-10 items-center ${flipped ? "md:[&>*:first-child]:order-last" : ""}`}>
      {/* Text column */}
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

      {/* Visual column */}
      <Reveal from={flipped ? "left" : "right"} delay="delay-150">
        <div className={`relative aspect-[4/3] rounded-3xl border border-white/10 bg-gradient-to-br ${accent.gradient} via-space-900 to-space-950 overflow-hidden flex items-center justify-center`}>
          {/* Big icon */}
          <div className={`relative ${accent.text} animate-float-slow`}>
            <div className={`absolute inset-0 ${accent.bg} blur-3xl opacity-30 animate-pulse-slow`} />
            <Icon className="relative h-32 w-32" strokeWidth={1.2} />
          </div>
          {/* Faint grid overlay */}
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
