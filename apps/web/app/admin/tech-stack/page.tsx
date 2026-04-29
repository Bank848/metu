import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink, Layers } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { LAYER_ORDER, TECH_STACK, type TechLayer } from "@/lib/admin/tech-stack";
import { readManifests, readProjectTagline } from "@/lib/admin/read-package-json";

export const metadata: Metadata = { title: "Tech Stack · Admin · METU" };
// Must be dynamic so the parent admin layout's getMe() cookie read
// runs per-request. The fs reads happen on every request but the
// versions don't change between deploys, so this is effectively cached
// in v8's hot path with negligible overhead.
export const dynamic = "force-dynamic";

/**
 * Phase 21.2 — `/admin/tech-stack`.
 *
 * Cross-references the curated metadata (layer + one-line purpose +
 * docs URL) with the live versions read from package.json at build
 * time. The page is `force-static` so the fs read happens once per
 * deploy — no request-time IO.
 *
 * Three sections:
 *   1. Hero — title + tagline pulled from root package.json description.
 *   2. Architecture diagram — ASCII block matching README §architecture.
 *   3. Tech grid — grouped by layer with version + purpose + docs link.
 *   4. Other dependencies — collapsed list of every package.json dep
 *      that isn't in the curated list (types, peer deps, infra glue).
 */
export default function TechStackPage() {
  const versions = readManifests();
  const tagline = readProjectTagline();

  // Build the per-layer rows. Curated rows always render (with "—"
  // version when not installed for some reason); other rows go in the
  // collapsed section at the bottom.
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

  return (
    <>
      <PageHeader
        title="Tech Stack"
        subtitle={tagline ?? "METU — Digital Marketplace Platform"}
      />

      {/* Architecture diagram — kept as ASCII so it survives any
          rendering pipeline. Matches the block at the top of README.md. */}
      <section className="mb-10">
        <h2 className="font-display text-base font-bold text-white mb-3 flex items-center gap-2">
          <Layers className="h-4 w-4 text-metu-yellow" />
          Architecture
        </h2>
        <pre className="rounded-2xl border border-line bg-space-950 p-5 text-[11px] leading-snug text-ink-secondary overflow-x-auto whitespace-pre">
{`                 Browser
                    │ HTTPS (cookie)
                    ▼
       ┌────────────────────────────┐
       │   metu.fly.dev             │   apps/web  (Next.js BFF)
       │   • Server Components      │
       │   • Client Components      │
       │   • /api/* → forwardToApi  │
       └────────────┬───────────────┘
                    │ internal fetch + cookie passthrough
                    ▼
       ┌────────────────────────────┐
       │   metu-api.fly.dev         │   apps/server  (Express)
       │   routes → controllers     │
       │   services → models        │
       │   middleware → utils       │
       └────────────┬───────────────┘
                    │ Prisma
                    ▼
       ┌────────────────────────────┐
       │   Neon Postgres (sin)      │
       └────────────────────────────┘`}
        </pre>
      </section>

      {/* Per-layer grid. Each layer gets its own card so reviewers
          can scan one section at a time without losing the headline
          structure. */}
      <section className="space-y-6">
        {LAYER_ORDER.map((layer) => {
          const rows = rowsByLayer.get(layer);
          if (!rows || rows.length === 0) return null;
          return (
            <div
              key={layer}
              className="rounded-2xl border border-line bg-space-850 overflow-hidden"
            >
              <div className="px-5 py-3 border-b border-line bg-space-900 flex items-center justify-between">
                <h2 className="font-display text-sm font-bold text-white tracking-wide">
                  {layer}
                </h2>
                <span className="text-[10px] font-mono uppercase text-ink-dim">
                  {rows.length} package{rows.length === 1 ? "" : "s"}
                </span>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[10px] uppercase tracking-wider text-ink-dim border-b border-line/50">
                    <th className="px-5 py-2 font-semibold w-[28%]">Package</th>
                    <th className="px-5 py-2 font-semibold w-[14%] font-mono normal-case">Version</th>
                    <th className="px-5 py-2 font-semibold">Purpose</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={row.name}
                      className="border-b border-line/30 last:border-b-0 hover:bg-white/[0.02]"
                    >
                      <td className="px-5 py-2.5">
                        <a
                          href={row.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 font-medium text-white hover:text-metu-yellow"
                        >
                          {row.name}
                          <ExternalLink className="h-3 w-3 opacity-60" />
                        </a>
                      </td>
                      <td className="px-5 py-2.5 font-mono text-ink-secondary text-[12px]">
                        {row.version}
                      </td>
                      <td className="px-5 py-2.5 text-ink-secondary">{row.purpose}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}
      </section>

      {/* Anything in package.json not in the curated metadata —
          types, peer deps, dev tooling glue. Collapsed by default so
          the headline grid stays scannable. */}
      {otherRows.length > 0 && (
        <details className="mt-8 rounded-2xl border border-line bg-space-850 overflow-hidden group">
          <summary className="px-5 py-3 cursor-pointer select-none font-display text-sm font-bold text-white hover:bg-space-900 flex items-center justify-between">
            <span>Other dependencies</span>
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

      {/* Infra footer — versions parsed from Dockerfile / fly toml are
          documented inline rather than read at build time; no benefit
          to fs-reading these for a static demo page. */}
      <section className="mt-10 rounded-2xl border border-line bg-space-850 p-5">
        <h2 className="font-display text-sm font-bold text-white mb-3">Infrastructure</h2>
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-y-2 gap-x-6 text-[13px]">
          <div className="flex justify-between gap-4 border-b border-line/30 pb-1.5">
            <dt className="text-ink-dim">Runtime</dt>
            <dd className="text-white font-mono">node:20-alpine (Docker)</dd>
          </div>
          <div className="flex justify-between gap-4 border-b border-line/30 pb-1.5">
            <dt className="text-ink-dim">Hosting</dt>
            <dd className="text-white font-mono">Fly.io · sin region · 2 machines</dd>
          </div>
          <div className="flex justify-between gap-4 border-b border-line/30 pb-1.5">
            <dt className="text-ink-dim">Database</dt>
            <dd className="text-white font-mono">Neon Postgres 16 (sin)</dd>
          </div>
          <div className="flex justify-between gap-4 border-b border-line/30 pb-1.5">
            <dt className="text-ink-dim">Local dev</dt>
            <dd className="text-white font-mono">Docker Compose (postgres + adminer)</dd>
          </div>
        </dl>
        <div className="mt-4 text-[11px] text-ink-dim">
          Full deployment notes: see{" "}
          <Link
            href="/admin/changelog"
            className="text-metu-yellow hover:underline"
          >
            /admin/changelog
          </Link>{" "}
          and the repo&apos;s <code className="text-metu-yellow">DEPLOY_FLY.md</code>.
        </div>
      </section>
    </>
  );
}
