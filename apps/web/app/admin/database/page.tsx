import type { Metadata } from "next";
import { Database, KeyRound, GitMerge, FileText, Sparkles, Terminal } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { apiFetch } from "@/lib/server/api";
import { fmtDateTime } from "@/lib/format";
import { SqlConsole } from "./SqlConsole";

export const metadata: Metadata = { title: "Database · Admin · METU" };
export const dynamic = "force-dynamic";

interface Snapshot {
  version: string;
  databaseSize: string;
  tables: Array<{ table: string; rows: number; sizeBytes: number; sizePretty: string }>;
  indexes: Array<{
    table: string;
    name: string;
    definition: string;
    isUnique: boolean;
    isPrimary: boolean;
  }>;
  migrations: Array<{ name: string; appliedAt: string; rolledBack: boolean }>;
  jsonbUsage: Array<{ table: string; column: string; sampleQuery: string }>;
}

async function fetchSnapshot(): Promise<Snapshot | null> {
  try {
    return await apiFetch<Snapshot>("/admin/db/snapshot");
  } catch {
    return null;
  }
}

export default async function AdminDatabasePage() {
  const snap = await fetchSnapshot();
  if (!snap) {
    return (
      <main className="px-8 py-8">
        <PageHeader title="Database" subtitle="Couldn't read the live Postgres state right now." />
        <p className="text-sm text-ink-dim">
          Make sure the API is up and the admin session is valid, then refresh.
        </p>
      </main>
    );
  }

  // Group indexes by table for the per-table cards.
  const indexesByTable = new Map<string, Snapshot["indexes"]>();
  for (const idx of snap.indexes) {
    const list = indexesByTable.get(idx.table) ?? [];
    list.push(idx);
    indexesByTable.set(idx.table, list);
  }

  const totalIndexes = snap.indexes.length;
  const uniqueIndexes = snap.indexes.filter((i) => i.isUnique && !i.isPrimary).length;
  const totalRows = snap.tables.reduce((s, t) => s + t.rows, 0);
  const versionShort = snap.version.split(" on ")[0]?.replace(/^PostgreSQL\s*/, "PG ") ?? snap.version;

  return (
    <main className="px-8 py-8 max-w-6xl space-y-8">
      <PageHeader
        title="Database"
        subtitle="The live Postgres state behind METU — schema, indexes, migrations, JSONB usage, and a read-only SQL console for the defense panel."
      />

      {/* Summary cards */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Engine"        value={versionShort} icon={Database} />
        <Stat label="DB size"       value={snap.databaseSize} icon={Database} />
        <Stat label="Tables · rows" value={`${snap.tables.length} · ${totalRows.toLocaleString()}`} icon={FileText} />
        <Stat label="Indexes"       value={`${totalIndexes} (${uniqueIndexes} unique)`} icon={KeyRound} />
      </section>

      {/* Tables + per-table indexes */}
      <section className="rounded-2xl border border-line bg-space-900 p-6">
        <h2 className="font-display font-bold text-white text-lg flex items-center gap-2 mb-1">
          <FileText className="h-4 w-4 text-metu-yellow" />
          Tables &amp; indexes
        </h2>
        <p className="text-sm text-ink-secondary mb-4">
          One row per relation. Index column shows what Postgres has built — primary key,
          unique constraint, or secondary lookup index — and the exact definition pulled
          from <code>pg_indexes</code>.
        </p>
        <div className="overflow-hidden rounded-xl border border-line">
          <table className="w-full text-sm">
            <thead className="bg-space-950 text-xs uppercase tracking-wider text-ink-dim">
              <tr>
                <th className="text-left px-4 py-2 font-medium">Table</th>
                <th className="text-right px-4 py-2 font-medium">Rows</th>
                <th className="text-right px-4 py-2 font-medium">Size</th>
                <th className="text-left  px-4 py-2 font-medium">Indexes</th>
              </tr>
            </thead>
            <tbody>
              {snap.tables.map((t) => {
                const idx = indexesByTable.get(t.table) ?? [];
                return (
                  <tr key={t.table} className="border-t border-line align-top">
                    <td className="px-4 py-3 font-mono text-xs text-white">{t.table}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-ink-secondary">
                      {t.rows.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-ink-dim">
                      {t.sizePretty}
                    </td>
                    <td className="px-4 py-3 space-y-1">
                      {idx.map((i) => (
                        <div key={i.name} className="flex items-start gap-2">
                          <span
                            className={`inline-block text-[10px] font-semibold uppercase tracking-wider rounded px-1.5 py-0.5 mt-0.5 ${
                              i.isPrimary
                                ? "bg-metu-yellow/20 text-metu-yellow"
                                : i.isUnique
                                ? "bg-mint/20 text-mint"
                                : "bg-white/5 text-ink-dim"
                            }`}
                          >
                            {i.isPrimary ? "PK" : i.isUnique ? "UNIQUE" : "IDX"}
                          </span>
                          <code className="text-[11px] text-ink-secondary leading-snug">
                            {i.definition.replace(/^CREATE (UNIQUE )?INDEX [\w]+ ON \w+\.\w+ /, "")}
                          </code>
                        </div>
                      ))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Migration history */}
      <section className="rounded-2xl border border-line bg-space-900 p-6">
        <h2 className="font-display font-bold text-white text-lg flex items-center gap-2 mb-1">
          <GitMerge className="h-4 w-4 text-metu-yellow" />
          Migration history ({snap.migrations.length})
        </h2>
        <p className="text-sm text-ink-secondary mb-4">
          Every schema change ships as a numbered SQL migration that both dev and prod replay
          in order. The list below is read straight from Prisma&apos;s
          <code> _prisma_migrations</code> tracking table.
        </p>
        <ol className="space-y-1 text-sm">
          {snap.migrations.map((m) => (
            <li key={m.name} className="flex items-center justify-between gap-3 border-b border-line/50 py-1.5">
              <code className="text-xs text-white">{m.name}</code>
              <span className={`text-xs tabular-nums ${m.rolledBack ? "text-coral" : "text-ink-dim"}`}>
                {m.rolledBack ? "rolled back" : fmtDateTime(m.appliedAt)}
              </span>
            </li>
          ))}
        </ol>
      </section>

      {/* JSONB / NoSQL touchpoint */}
      <section className="rounded-2xl border border-line bg-space-900 p-6">
        <h2 className="font-display font-bold text-white text-lg flex items-center gap-2 mb-1">
          <Sparkles className="h-4 w-4 text-metu-yellow" />
          JSONB columns — schemaless data inside Postgres
        </h2>
        <p className="text-sm text-ink-secondary mb-4">
          The <code>audit_log.meta</code> column stores arbitrary structured context per
          event (Stripe webhook payload, before/after diffs, role-change reasoning) without
          a fixed schema. This is the project&apos;s NoSQL touchpoint — we keep one engine but
          drop into document-style storage where the shape genuinely varies.
        </p>
        {snap.jsonbUsage.map((j) => (
          <div key={`${j.table}.${j.column}`} className="rounded-xl border border-line bg-space-950 p-4">
            <div className="text-xs font-semibold text-ink-dim mb-2">
              <code className="text-mint">{j.table}.{j.column}</code> — example query
            </div>
            <pre className="text-xs text-white font-mono whitespace-pre overflow-x-auto">
{j.sampleQuery}
            </pre>
          </div>
        ))}
      </section>

      {/* SQL console */}
      <section className="rounded-2xl border border-line bg-space-900 p-6">
        <h2 className="font-display font-bold text-white text-lg flex items-center gap-2 mb-1">
          <Terminal className="h-4 w-4 text-metu-yellow" />
          SQL console (read-only)
        </h2>
        <p className="text-sm text-ink-secondary mb-4">
          Type a <code>SELECT</code>, <code>WITH</code>, or <code>EXPLAIN</code> statement to run it
          against the live database. Multi-statement input, DDL, and writes are rejected.
          The connection runs <code>SET LOCAL transaction_read_only = on</code> with a 30-second
          statement timeout.
        </p>
        <SqlConsole />
      </section>
    </main>
  );
}

function Stat({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
}) {
  return (
    <div className="rounded-2xl border border-line bg-space-900 p-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-ink-dim">
        <Icon className="h-3.5 w-3.5 text-metu-yellow" />
        {label}
      </div>
      <div className="font-display text-xl font-bold text-white mt-1 truncate">{value}</div>
    </div>
  );
}
