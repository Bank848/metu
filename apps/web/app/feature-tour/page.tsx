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
    badge: "How data is organized",
    title: "29 things we keep track of",
    body:
      "Users, stores, products, orders, coupons, reviews — every piece of information has a clean home. We designed it so nothing gets duplicated and history stays readable even after rows go away.",
    bullets: [
      "Order history survives a deleted product — every line carries its own product name + image snapshot",
      "If a sale is tied to a product, deleting the product just nulls the link; the receipt still reads correctly",
      "Built-in checks block bad data — like a five-star rating that's actually 99 stars",
    ],
    accent: "purple",
  },
  {
    icon: CreditCard,
    badge: "Payments",
    title: "Real money, handled by Stripe",
    body:
      "When you check out, Stripe takes the payment and pays the seller directly. We never touch your card details, and the platform fee is calculated automatically.",
    bullets: [
      "Each seller is set up as their own payout recipient inside Stripe Thailand",
      "Sellers can see their balance and request a payout with one click on the wallet page",
      "We log every payment event so refunds and chargebacks always have a paper trail",
    ],
    cta: { href: "/seller/wallet", label: "Open the wallet page" },
    accent: "pink",
  },
  {
    icon: Receipt,
    badge: "After you pay",
    title: "Your goods arrive automatically",
    body:
      "The moment Stripe confirms payment, the system generates your license key or pulls up the download link and sends it both to the order page and your email inbox.",
    bullets: [
      "License keys can follow the seller's pattern (like METU-XXXX-XXXX-XXXX) or default to a unique random code",
      "Sellers can update their files later without breaking what you already bought",
      "The receipt email and the order page always show the same delivery — they never drift apart",
    ],
    accent: "mint",
  },
  {
    icon: KeyRound,
    badge: "Sign-in",
    title: "Sign in safely",
    body:
      "Use email and password, sign in with Google, or both. Turn on two-factor authentication if you want an extra layer on sensitive actions.",
    bullets: [
      "Two-factor codes are asked again before risky moves like refunds or signing every device out",
      "See every device that's signed in and sign them out one by one or all at once",
      "Forgot-password links expire after five minutes, so a leaked link tomorrow is already useless",
    ],
    cta: { href: "/profile/sessions", label: "See active devices" },
    accent: "blue",
  },
  {
    icon: Tags,
    badge: "Discounts",
    title: "Discount codes, done right",
    body:
      "Codes can work across the whole site or for a single store only, and the same code can't be redeemed twice by the same person.",
    bullets: [
      "A platform-wide code knocks money off every line in your cart",
      "A store code only discounts items from that store",
      "An overall usage cap stops a code from being abused or going viral",
    ],
    accent: "yellow",
  },
  {
    icon: ShieldCheck,
    badge: "Safety",
    title: "Built-in protection against abuse",
    body:
      "We block too-many-attempts attacks, lock down what the website is allowed to do, and keep a record of every admin action.",
    bullets: [
      "Login, register, and password-reset are all rate-limited so bots can't brute-force their way in",
      "Every admin action is logged with who did it, from where, and when",
      "Sign-in cookies are locked down so other websites can't steal them",
    ],
    accent: "red",
  },
  {
    icon: Mail,
    badge: "Receipts",
    title: "Receipts that look like real receipts",
    body:
      "After payment, a tidy email lands in your inbox with one section per store you bought from, plus how to contact each seller if something is wrong.",
    bullets: [
      "Subject line tells you which store (or how many stores) the order is from at a glance",
      "Each line lists the item, quantity, and your delivery — license key or download link",
      "Designed to render correctly in Gmail, Outlook, and most other email apps",
    ],
    accent: "orange",
  },
  {
    icon: Layers,
    badge: "Foundation",
    title: "Modern, well-tested foundation",
    body:
      "Built with proven, current tools. 181 automated tests run before every release so bugs we caught yesterday stay caught today.",
    bullets: [
      "Next.js 14 + Express + Prisma + Postgres on Fly.io with Stripe Connect for live payments",
      "Updates reach the live site within minutes of a successful test run",
      "The whole project lives in one place so changes can be reviewed end to end",
    ],
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
            Buy digital goods from Thai creators, sellers get paid through Stripe, and your
            license keys land on the order page and in your inbox right after checkout.
            Everything you see here is the live system, not a mockup.
          </p>
        </Reveal>

        <Reveal from="up" delay="delay-300">
          <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-3 max-w-3xl">
            <HeroStat label="Things tracked" value={29} />
            <HeroStat label="Database updates shipped" value={42} />
            <HeroStat label="Automated tests" value={181} />
            <HeroStat label="Live payments" value={1} suffix=" via Stripe" />
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
            Live database map
          </div>
        </Reveal>
        <Reveal from="up" delay="delay-100">
          <h2 className="font-display text-3xl md:text-4xl font-bold text-white mb-3 leading-tight">
            How everything connects
          </h2>
        </Reveal>
        <Reveal from="up" delay="delay-200">
          <p className="text-ink-secondary leading-relaxed mb-6 max-w-3xl">
            Below is the actual map of our database, drawn straight from the live system.
            Drag to move it around, hold Ctrl and scroll to zoom, double-click to fit it back
            in view. Each box is one kind of thing we keep track of; each line shows how two
            of them are linked together.
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
              title="Accounts & sign-in"
              body="People, the ways they sign in (email or Google), the devices they're using, and the temporary tokens we send for password reset and email verification."
            />
            <DiagramHint
              title="Stores & purchases"
              body="Each store has products, products go into a cart, the cart turns into an order. That's the path from browsing to a finished sale."
            />
            <DiagramHint
              title="Money & history"
              body="Payments, discount codes, who used which code, and a record of every admin action — kept for accountability."
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
              It's all live · every page works
            </h2>
            <p className="text-ink-secondary mb-8 max-w-2xl mx-auto">
              Sign in with the demo buyer account on the login page to try the cart and
              checkout. The admin demo account opens the database map and the tools list
              directly.
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
