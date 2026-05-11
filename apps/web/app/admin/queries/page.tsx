import type { Metadata } from "next";
import { Code2, Database, FileText, KeyRound, ListChecks, Search, ShieldAlert } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { SHOWCASE_QUERIES, type ShowcaseQuery } from "./queries";
import { QueryShowcaseSql } from "./QueryShowcaseSql";

export const metadata: Metadata = { title: "Query showcase · Admin · METU" };
export const dynamic = "force-dynamic";

const CATEGORY_META: Record<
  ShowcaseQuery["category"],
  { label: string; icon: React.ElementType; color: string }
> = {
  reports: { label: "Reports", icon: FileText, color: "text-metu-yellow" },
  analytics: { label: "Analytics", icon: ListChecks, color: "text-mint" },
  search: { label: "Search & ranking", icon: Search, color: "text-info" },
  audit: { label: "Audit & ops", icon: ShieldAlert, color: "text-coral" },
  integrity: { label: "Schema & integrity", icon: Database, color: "text-purple" },
};

export default function QueryShowcasePage() {
  // Group by category for the at-a-glance index at the top.
  const byCategory = new Map<ShowcaseQuery["category"], ShowcaseQuery[]>();
  for (const q of SHOWCASE_QUERIES) {
    const list = byCategory.get(q.category) ?? [];
    list.push(q);
    byCategory.set(q.category, list);
  }

  return (
    <main className="px-8 py-8 max-w-6xl space-y-8">
      <PageHeader
        title="Query showcase"
        subtitle="The hand-written SQL behind METU's reporting + recommendation features. Each query is shown with the indexes it relies on, the rationale for choosing raw SQL over Prisma's builder, and a live EXPLAIN ANALYZE plan you can run against production."
      />

      {/* Index — clickable jump links by category. */}
      <section className="rounded-2xl border border-line bg-space-900 p-5">
        <h2 className="font-display text-sm font-bold uppercase tracking-wider text-ink-dim mb-3">
          On this page
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from(byCategory.entries()).map(([cat, list]) => {
            const meta = CATEGORY_META[cat];
            const Icon = meta.icon;
            return (
              <div key={cat} className="rounded-xl border border-line bg-space-950 p-3">
                <div className={`flex items-center gap-2 text-xs font-bold uppercase tracking-wider ${meta.color}`}>
                  <Icon className="h-3.5 w-3.5" />
                  {meta.label}
                  <span className="text-ink-dim font-normal normal-case ml-auto">
                    {list.length}
                  </span>
                </div>
                <ul className="mt-2 space-y-1">
                  {list.map((q) => (
                    <li key={q.id}>
                      <a
                        href={`#${q.id}`}
                        className="text-xs text-ink-secondary hover:text-metu-yellow truncate block"
                      >
                        → {q.title}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </section>

      {/* Query cards */}
      <section className="space-y-6">
        {SHOWCASE_QUERIES.map((q) => {
          const meta = CATEGORY_META[q.category];
          const Icon = meta.icon;
          return (
            <article
              key={q.id}
              id={q.id}
              className="scroll-mt-8 rounded-2xl border border-line bg-space-900 overflow-hidden"
            >
              {/* Card header */}
              <header className="px-6 py-4 border-b border-line bg-space-950">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider mb-1">
                  <Icon className={`h-3.5 w-3.5 ${meta.color}`} />
                  <span className={meta.color}>{meta.label}</span>
                  <span className="text-ink-dim font-mono normal-case">· #{q.id}</span>
                </div>
                <h2 className="font-display text-lg font-bold text-white">{q.title}</h2>
                <p className="text-sm text-ink-secondary mt-1">{q.summary}</p>
                <div className="mt-2 text-[11px] font-mono text-ink-dim">
                  <Code2 className="inline h-3 w-3 mr-1" />
                  {q.source}
                </div>
              </header>

              {/* SQL block — single client component handles the
                  trigger button and an inline result panel that grows
                  down inside this same card on click. */}
              <div className="px-6 py-5">
                <QueryShowcaseSql sql={q.sql} />
              </div>

              {/* Rationale + indexes */}
              <div className="px-6 pb-5 grid grid-cols-1 lg:grid-cols-2 gap-5">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-ink-dim mb-2 flex items-center gap-1.5">
                    <FileText className="h-3 w-3" />
                    Why hand-written?
                  </h3>
                  <p className="text-sm text-ink-secondary leading-relaxed">
                    {q.rationale}
                  </p>
                </div>
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-ink-dim mb-2 flex items-center gap-1.5">
                    <KeyRound className="h-3 w-3" />
                    Indexes used
                  </h3>
                  <ul className="space-y-1.5 text-xs">
                    {q.indexes.map((ix, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="inline-block text-[10px] font-semibold uppercase tracking-wider rounded px-1.5 py-0.5 mt-0.5 bg-metu-yellow/15 text-metu-yellow shrink-0">
                          IDX
                        </span>
                        <div>
                          <code className="text-white">{q.indexes[i].name}</code>
                          <span className="text-ink-dim"> · {ix.on}</span>
                          <div className="text-ink-secondary">{ix.why}</div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </article>
          );
        })}
      </section>
    </main>
  );
}
