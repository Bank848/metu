"use client";
import { useState } from "react";
import { Activity, Loader2, X } from "lucide-react";

/**
 * Runs `EXPLAIN ANALYZE` against the showcase query via the existing
 * /admin/db/run endpoint (read-only Postgres console). Output is shown
 * inline so reviewers can see the live plan + timing without leaving
 * the page.
 *
 * The endpoint already enforces SET LOCAL transaction_read_only = on
 * and a 30-second statement timeout, so even a runaway plan can't
 * impact production traffic.
 */
export function ExplainButton({ sql }: { sql: string }) {
  const [busy, setBusy] = useState(false);
  const [out, setOut] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // We strip $1, $2, … placeholders for the EXPLAIN by substituting
  // sane defaults — the planner doesn't need real parameter values to
  // produce a representative plan. NULL works for most params; for
  // numeric / id fields we substitute 1 so JOINs still resolve.
  function preparedSql(): string {
    return sql.replace(/\$(\d+)/g, "1");
  }

  async function explain() {
    setBusy(true);
    setOut(null);
    setErr(null);
    try {
      const res = await fetch("/api/admin/db/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ sql: `EXPLAIN ANALYZE ${preparedSql()}` }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data?.message ?? "Couldn't run EXPLAIN.");
      } else {
        // The console returns rows of { "QUERY PLAN": "..." } shape.
        const lines = (data?.rows ?? []).map(
          (r: Record<string, unknown>) => String(r["QUERY PLAN"] ?? Object.values(r)[0] ?? ""),
        );
        setOut(lines.join("\n"));
      }
    } catch {
      setErr("Network error.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={explain}
        disabled={busy}
        className="inline-flex items-center gap-1.5 rounded-full border border-line bg-space-950 px-3 py-1 text-xs text-ink-secondary hover:border-metu-yellow/50 hover:text-white disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Activity className="h-3 w-3" />}
        {busy ? "Explaining…" : "EXPLAIN ANALYZE"}
      </button>
      {(out !== null || err) && (
        <button
          type="button"
          onClick={() => {
            setOut(null);
            setErr(null);
          }}
          className="text-ink-dim hover:text-white"
          aria-label="Hide plan"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}

      {(out !== null || err) && (
        <pre className="absolute z-20 mt-12 right-6 max-w-[800px] text-[11px] font-mono text-white bg-space-950 border border-metu-yellow/30 rounded-xl p-4 overflow-auto whitespace-pre shadow-2xl">
          {err ?? out}
        </pre>
      )}
    </div>
  );
}
