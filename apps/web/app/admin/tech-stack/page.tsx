import type { Metadata } from "next";
import Link from "next/link";
import {
  ExternalLink,
  Layout,
  Server,
  ShieldCheck,
  Database,
  CreditCard,
  Lock,
  TestTube,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { LAYER_ORDER, TECH_STACK, type TechLayer } from "@/lib/admin/tech-stack";
import { readManifests, readProjectTagline } from "@/lib/admin/read-package-json";

export const metadata: Metadata = { title: "Tech Stack · Admin · METU" };
export const dynamic = "force-dynamic";

/**
 * Phase 36 — `/admin/tech-stack` infographic redesign.
 *
 * Was a 5-table dump ; now an icon-driven category grid that scans
 * like the README architecture chart but with live versions baked in.
 * Each layer gets a coloured card with a Lucide icon, a count chip,
 * and the curated packages laid out as one-line rows. Anything in
 * package.json not in the curated list still drops into the
 * "Other dependencies" disclosure at the bottom.
 */

interface LayerMeta {
  icon: LucideIcon;
  /** Tailwind-friendly accent (used as bg + ring + text shades). */
  accent: string;
  /** Short blurb shown under the layer title. */
  blurb: string;
}

const LAYER_META: Record<TechLayer, LayerMeta> = {
  Frontend: {
    icon: Layout,
    accent: "blue",
    blurb: "Next.js 14 BFF + React + Tailwind. Server Components for catalog reads, Client Components for forms.",
  },
  Backend: {
    icon: Server,
    accent: "amber",
    blurb: "Express owns the API layer (routes → controllers → services → models). Receipts ride out via Resend.",
  },
  Auth: {
    icon: ShieldCheck,
    accent: "emerald",
    blurb: "better-auth runs the session table, OAuth handshakes, and TOTP step-up. Passwords hashed with bcrypt.",
  },
  Database: {
    icon: Database,
    accent: "purple",
    blurb: "Postgres on Supabase. Prisma is the schema source of truth + migration runner.",
  },
  Payments: {
    icon: CreditCard,
    accent: "pink",
    blurb: "Stripe Connect (TH recipient model). PaymentIntent on the seller's account, refunds + manual payouts via the same SDK.",
  },
  Security: {
    icon: Lock,
    accent: "red",
    blurb: "Helmet locks down headers (CSP, HSTS, X-Frame-Options) on the API and BFF. Rate-limiters elsewhere.",
  },
  Tests: {
    icon: TestTube,
    accent: "cyan",
    blurb: "Vitest + Supertest drive Express in-process (144 tests). Playwright covers persona-level smoke flows.",
  },
  Build: {
    icon: Wrench,
    accent: "slate",
    blurb: "TypeScript strict mode across the monorepo. tsx for ad-hoc scripts ; concurrently runs dev + build.",
  },
};

// Per-accent class lookups — Tailwind needs literal class names, not
// interpolated ones, otherwise the JIT trims them out at build time.
const ACCENT_CLASSES: Record<string, { ring: string; text: string; bg: string; bgSoft: string; chip: string }> = {
  blue:    { ring: "ring-blue-400/40",    text: "text-blue-400",    bg: "bg-blue-500",    bgSoft: "bg-blue-500/10",    chip: "bg-blue-500/15 text-blue-200" },
  amber:   { ring: "ring-amber-400/40",   text: "text-amber-400",   bg: "bg-amber-500",   bgSoft: "bg-amber-500/10",   chip: "bg-amber-500/15 text-amber-200" },
  emerald: { ring: "ring-emerald-400/40", text: "text-emerald-400", bg: "bg-emerald-500", bgSoft: "bg-emerald-500/10", chip: "bg-emerald-500/15 text-emerald-200" },
  purple:  { ring: "ring-purple-400/40",  text: "text-purple-400",  bg: "bg-purple-500",  bgSoft: "bg-purple-500/10",  chip: "bg-purple-500/15 text-purple-200" },
  pink:    { ring: "ring-pink-400/40",    text: "text-pink-400",    bg: "bg-pink-500",    bgSoft: "bg-pink-500/10",    chip: "bg-pink-500/15 text-pink-200" },
  red:     { ring: "ring-red-400/40",     text: "text-red-400",     bg: "bg-red-500",     bgSoft: "bg-red-500/10",     chip: "bg-red-500/15 text-red-200" },
  cyan:    { ring: "ring-cyan-400/40",    text: "text-cyan-400",    bg: "bg-cyan-500",    bgSoft: "bg-cyan-500/10",    chip: "bg-cyan-500/15 text-cyan-200" },
  slate:   { ring: "ring-slate-400/40",   text: "text-slate-300",   bg: "bg-slate-500",   bgSoft: "bg-slate-500/10",   chip: "bg-slate-500/15 text-slate-200" },
};

export default function TechStackPage() {
  const versions = readManifests();
  const tagline = readProjectTagline();

  const curatedNames = new Set(TECH_STACK.map((t) => t.name));
  const rowsByLayer = new Map<TechLayer, Array<{ name: string; version: string; purpose: string; url: string }>>();
  for (const layer of LAYER_ORDER) rowsByLayer.set(layer, []);
  for (const item of TECH_STACK) {
    rowsByLayer.get(item.layer)?.push({
      name: item.name,
      version: versions.get(item.name)?.version ?? "—",
      purpose: item.purpose,
      url: item.url,
    });
  }
  const otherRows = [...versions.values()]
    .filter((v) => !curatedNames.has(v.name))
    .sort((a, b) => a.name.localeCompare(b.name));

  const totalCurated = TECH_STACK.length;

  return (
    <>
      <PageHeader title="Tech Stack" subtitle={tagline ?? "METU — Digital Marketplace Platform"} />

      {/* Hero strip — overall metrics so reviewers see the scale at a glance. */}
      <section className="mt-2 mb-8 grid grid-cols-2 md:grid-cols-4 gap-3">
        <HeroStat label="Curated packages" value={String(totalCurated)} />
        <HeroStat label="Categories" value={String(LAYER_ORDER.length)} />
        <HeroStat label="Other deps" value={String(otherRows.length)} />
        <HeroStat label="Apps" value="2 (web + api)" />
      </section>

      {/* Category grid — 1 col on mobile, 2 on md, 3 on xl. */}
      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {LAYER_ORDER.map((layer) => {
          const rows = rowsByLayer.get(layer);
          if (!rows || rows.length === 0) return null;
          const meta = LAYER_META[layer];
          const accent = ACCENT_CLASSES[meta.accent];
          const Icon = meta.icon;
          return (
            <article
              key={layer}
              className={`relative rounded-2xl border border-line bg-space-850 overflow-hidden ring-1 ${accent.ring}`}
            >
              {/* Header bar with icon + count chip */}
              <header className={`px-4 py-3 ${accent.bgSoft} border-b border-line/60 flex items-center gap-3`}>
                <div className={`h-9 w-9 rounded-lg ${accent.bg} text-white flex items-center justify-center shadow-md`}>
                  <Icon className="h-4.5 w-4.5" />
                </div>
                <div className="flex-1">
                  <h2 className="font-display text-base font-bold text-white leading-tight">
                    {layer}
                  </h2>
                  <p className="text-[10.5px] text-ink-dim mt-0.5 leading-snug">
                    {meta.blurb}
                  </p>
                </div>
                <span className={`shrink-0 inline-flex items-center justify-center rounded-full ${accent.chip} text-[10px] font-bold px-2 py-0.5`}>
                  {rows.length}
                </span>
              </header>

              {/* Package rows — name + version chip + truncated purpose */}
              <ul className="divide-y divide-line/40">
                {rows.map((row) => (
                  <li key={row.name} className="px-4 py-2.5 hover:bg-white/[0.03] transition-colors">
                    <div className="flex items-center justify-between gap-3">
                      <a
                        href={row.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-mono text-[12px] font-semibold text-white hover:text-metu-yellow truncate"
                      >
                        {row.name}
                        <ExternalLink className="h-3 w-3 opacity-50 shrink-0" />
                      </a>
                      <span className="font-mono text-[10px] tracking-tight text-ink-dim shrink-0">
                        {row.version}
                      </span>
                    </div>
                    <p className="text-[11px] text-ink-secondary mt-0.5 leading-snug">{row.purpose}</p>
                  </li>
                ))}
              </ul>
            </article>
          );
        })}
      </section>

      {/* Other deps — collapsed disclosure, dense grid */}
      {otherRows.length > 0 && (
        <details className="mt-8 rounded-2xl border border-line bg-space-850 overflow-hidden group">
          <summary className="px-5 py-3 cursor-pointer select-none font-display text-sm font-bold text-white hover:bg-space-900 flex items-center justify-between">
            <span>Other dependencies (types, peer deps, infra glue)</span>
            <span className="text-[10px] font-mono uppercase text-ink-dim">
              {otherRows.length} package{otherRows.length === 1 ? "" : "s"}
            </span>
          </summary>
          <ul className="px-5 py-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-1 text-[12px]">
            {otherRows.map((row) => (
              <li key={row.name} className="flex items-center justify-between gap-3">
                <code className="text-white truncate">{row.name}</code>
                <code className="font-mono text-ink-dim shrink-0">{row.version}</code>
              </li>
            ))}
          </ul>
        </details>
      )}

      {/* Infrastructure footer — refreshed for Phase 28 (Supabase) + 27 (Stripe) reality */}
      <section className="mt-8 rounded-2xl border border-line bg-space-850 p-5">
        <h2 className="font-display text-sm font-bold text-white mb-3 flex items-center gap-2">
          <Wrench className="h-4 w-4 text-slate-300" />
          Infrastructure
        </h2>
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-y-2 gap-x-6 text-[13px]">
          <Pair k="Runtime"      v="node:20-alpine (Docker)" />
          <Pair k="Hosting"      v="Fly.io · sin region · 2 machines (web + api)" />
          <Pair k="Database"     v="Supabase Postgres 16 · ap-southeast-1 · transaction pooler" />
          <Pair k="Payments"     v="Stripe Connect · sandbox keys · webhook to /api/webhooks/stripe" />
          <Pair k="Email"        v="Resend (when RESEND_API_KEY set) · console fallback" />
          <Pair k="Local dev"    v="Docker Compose (postgres + adminer) · npm run dev" />
        </dl>
        <div className="mt-4 text-[11px] text-ink-dim">
          Full deployment notes: see{" "}
          <Link href="/admin/changelog" className="text-metu-yellow hover:underline">/admin/changelog</Link>{" "}
          and <code className="text-metu-yellow">DEPLOY_FLY.md</code>.
        </div>
      </section>
    </>
  );
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-space-900 px-4 py-3">
      <div className="text-[10px] uppercase tracking-wider text-ink-dim">{label}</div>
      <div className="font-display text-2xl font-bold text-white mt-0.5 leading-tight">{value}</div>
    </div>
  );
}

function Pair({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-line/30 pb-1.5">
      <dt className="text-ink-dim shrink-0">{k}</dt>
      <dd className="text-white font-mono text-right text-[12px]">{v}</dd>
    </div>
  );
}
