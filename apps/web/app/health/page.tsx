import { Activity, Database, GitBranch, Clock, Box, Users, Store as StoreIcon, ShoppingBag, AlertTriangle } from "lucide-react";
import { TopNav } from "@/components/TopNav";
import { Footer } from "@/components/Footer";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { prisma } from "@/lib/server/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Public health-check page — surfaces the same info as `/api/health`
 * but with a human-friendly UI for stakeholders + on-call + the demo
 * presenter who wants to prove the site is live.
 *
 * Deliberately public (no auth) so an alert recipient can hit it from
 * any device. No sensitive info is exposed — just counts + ping time
 * + the git SHA we deployed.
 */
async function pingDb() {
  const started = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { ok: true, ms: Date.now() - started, error: null };
  } catch (err) {
    return {
      ok: false,
      ms: Date.now() - started,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function getCounts() {
  // Wrapped so a Neon hiccup downgrades the page to "degraded" rather
  // than crashing — health pages must never 500.
  try {
    // Phase 11 run #2 / F14 — products count now also gates on live
    // store so /health matches /admin overview + /admin/stores.
    const [users, stores, products, orders] = await Promise.all([
      prisma.user.count({ where: { deletedAt: null } }),
      prisma.store.count({ where: { deletedAt: null } }),
      prisma.product.count({ where: { deletedAt: null, store: { deletedAt: null } } }),
      prisma.order.count(),
    ]);
    return { users, stores, products, orders };
  } catch {
    return null;
  }
}

function fmtUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function pingTone(ms: number, ok: boolean): { label: string; tone: string } {
  // Wave-3: green/orange tones map onto the new mint/coral palette so
  // the page reads as part of the marketplace, not a stock dashboard.
  if (!ok) return { label: "DOWN", tone: "red" };
  if (ms < 100) return { label: "FAST", tone: "mint" };
  if (ms < 500) return { label: "OK",   tone: "yellow" };
  return { label: "SLOW", tone: "coral" };
}

export default async function HealthPage() {
  const [db, counts] = await Promise.all([pingDb(), getCounts()]);
  // Fly + Vercel both expose a commit SHA as an env var — try both so
  // we get a useful value regardless of where this is deployed.
  const sha =
    (process.env.FLY_GIT_COMMIT_SHA ??
      process.env.VERCEL_GIT_COMMIT_SHA ??
      process.env.GIT_COMMIT_SHA ??
      "local")?.slice(0, 7);
  const region = process.env.FLY_REGION ?? process.env.VERCEL_REGION ?? "local";
  const uptimeS = process.uptime();
  const overall = db.ok && counts !== null;
  const tone = pingTone(db.ms, db.ok);

  const toneClass = {
    mint:   "border-mint/40         bg-mint/15        text-mint",
    yellow: "border-amber-400/40    bg-amber-400/15   text-amber-200",
    coral:  "border-coral/40        bg-coral/15       text-coral",
    red:    "border-red-500/40      bg-red-500/15     text-red-300",
  }[tone.tone] ?? "border-line bg-white/5 text-ink-secondary";

  return (
    <>
      <TopNav />
      <main id="main" className="mx-auto max-w-4xl px-6 md:px-10 py-12">
        <PageHeader
          title="System health"
          subtitle="Live diagnostics — DB connectivity, latency, and basic catalogue stats."
        />

        {/* Top status banner — mint when healthy, red when degraded.
            Sits on `surface-flat` instead of a glass-y panel so the
            tone classes carry the colour (Wave-3 token alignment). */}
        <section
          className={`mb-8 rounded-2xl border p-6 flex items-center gap-4 ${
            overall
              ? "border-mint/40 bg-gradient-to-br from-mint/10 to-transparent"
              : "border-red-500/40 bg-gradient-to-br from-red-500/10 to-transparent"
          }`}
        >
          <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${
            overall ? "bg-mint/20 text-mint" : "bg-red-500/20 text-red-300"
          }`}>
            {overall ? <Activity className="h-6 w-6" /> : <AlertTriangle className="h-6 w-6" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-bold uppercase tracking-[0.2em] text-ink-dim">
              Overall status
            </div>
            <div className="font-display text-2xl font-extrabold text-white">
              {overall ? "All systems operational" : "Degraded — investigating"}
            </div>
          </div>
          <span className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wider ${toneClass}`}>
            {tone.label}
          </span>
        </section>

        {/* Stat tiles — Wave-3: the DB-ping tile is the lead metric on
            this page so it gets the `StatCard variant="highlight"`
            treatment (mint surface-accent, icon-left, oversized value).
            The other three stay on the leaner local <Tile /> on the
            new `surface-flat` token so the row reads as 1 anchor + 3
            supporting tiles instead of four identical glass squares. */}
        <div className="grid sm:grid-cols-2 gap-4 mb-8">
          <div className="sm:col-span-2">
            <StatCard
              label="DB ping"
              value={`${db.ms}ms`}
              icon={Database}
              variant={db.ok ? "highlight" : "zero"}
            />
          </div>
          <Tile
            icon={<Clock className="h-5 w-5" />}
            label="Process uptime"
            value={fmtUptime(uptimeS)}
            sub="Since this Fly machine started"
            ok
          />
          <Tile
            icon={<GitBranch className="h-5 w-5" />}
            label="Build"
            value={sha}
            sub={`Region: ${region}`}
            ok
            mono
          />
          <Tile
            icon={<Box className="h-5 w-5" />}
            label="Last checked"
            value={new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            sub={new Date().toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
            ok
            mono
          />
        </div>

        {/* Catalogue counts */}
        {counts ? (
          <section className="surface-flat rounded-2xl p-6">
            <h2 className="font-display text-xs font-bold uppercase tracking-wider text-ink-dim mb-4">
              Catalogue counters (excludes soft-deleted)
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <CountCell icon={<Users    className="h-4 w-4" />} label="Users"    value={counts.users} />
              <CountCell icon={<StoreIcon className="h-4 w-4" />} label="Stores"   value={counts.stores} />
              <CountCell icon={<Box      className="h-4 w-4" />} label="Products" value={counts.products} />
              <CountCell icon={<ShoppingBag className="h-4 w-4" />} label="Orders" value={counts.orders} />
            </div>
          </section>
        ) : (
          <section className="rounded-2xl border border-red-500/30 bg-red-500/5 p-6 text-sm text-red-200">
            Catalogue stats unavailable — DB query failed.
          </section>
        )}

        {db.error && (
          <pre className="mt-6 overflow-x-auto rounded-xl border border-red-500/30 bg-space-900 p-4 text-xs font-mono text-red-200">
            {db.error}
          </pre>
        )}

        <p className="mt-8 text-center text-xs text-ink-dim">
          Programmatic JSON version:{" "}
          <a href="/api/health" className="text-brand-yellow hover:underline font-mono">
            GET /api/health
          </a>
        </p>
      </main>
      <Footer />
    </>
  );
}

function Tile({
  icon,
  label,
  value,
  sub,
  ok,
  mono,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  ok: boolean;
  mono?: boolean;
}) {
  return (
    <div className="surface-flat rounded-2xl p-5 lift-on-hover hover:shadow-raised">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold uppercase tracking-wider text-ink-dim">{label}</div>
        <div className={ok ? "text-mint" : "text-red-400"}>{icon}</div>
      </div>
      <div className={`mt-2 font-display text-2xl font-extrabold text-white ${mono ? "font-mono" : ""}`}>
        {value}
      </div>
      <div className="mt-1 text-xs text-ink-secondary">{sub}</div>
    </div>
  );
}

function CountCell({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="surface-flat rounded-xl p-4">
      <div className="flex items-center gap-2 text-ink-dim text-xs font-semibold uppercase tracking-wider">
        {icon}
        {label}
      </div>
      <div className="mt-1.5 font-display text-xl font-extrabold text-metu-yellow tabular-nums">
        {value.toLocaleString()}
      </div>
    </div>
  );
}
