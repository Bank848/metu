"use client";

import { useState } from "react";
import { Activity, Loader2, X } from "lucide-react";

/**
 * Self-contained SQL showcase block: renders the SQL header (title +
 * EXPLAIN ANALYZE trigger), the SQL `<pre>`, and an inline result
 * panel that grows DOWN inside the same card when EXPLAIN runs.
 *
 * No absolute-positioned overlay → no overflow off the right edge,
 * no panel covering the cards below. The card naturally gets taller
 * to fit the plan and shrinks back when closed.
 *
 * Reuses /api/admin/db/run (read-only Postgres console) so the
 * 30-second statement timeout + transaction_read_only=on guards
 * already in place protect production.
 */
export function QueryShowcaseSql({ sql }: { sql: string }) {
  const [busy, setBusy] = useState(false);
  const [out, setOut] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const isOpen = out !== null || err !== null;

  // Strip $1, $2, … placeholders so the planner can run without real
  // bound values. `1` works for numeric / id fields; the planner
  // doesn't need the actual value to produce a representative plan.
  function preparedSql(): string {
    return sql.replace(/\$(\d+)/g, "1");
  }

  function close() {
    setOut(null);
    setErr(null);
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
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const code = data?.error ? ` (${data.error})` : "";
        const msg = data?.message ?? `HTTP ${res.status}`;
        setErr(`${msg}${code}`);
      } else {
        const lines = (data?.rows ?? []).map(
          (r: Record<string, unknown>) =>
            String(r["QUERY PLAN"] ?? Object.values(r)[0] ?? ""),
        );
        setOut(lines.join("\n") || "(empty plan)");
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Network error.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-ink-dim">
          SQL
        </h3>
        <button
          type="button"
          onClick={isOpen ? close : explain}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-full border border-line bg-space-950 px-3 py-1 text-xs text-ink-secondary hover:border-metu-yellow/50 hover:text-white disabled:opacity-50"
        >
          {busy ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : isOpen ? (
            <X className="h-3 w-3" />
          ) : (
            <Activity className="h-3 w-3" />
          )}
          {busy ? "Explaining…" : isOpen ? "Close plan" : "EXPLAIN ANALYZE"}
        </button>
      </div>

      <pre className="text-xs font-mono text-white bg-space-950 border border-line rounded-xl p-4 overflow-x-auto whitespace-pre">
        {sql}
      </pre>

      {/* Inline result panel — grows DOWN inside the card. The card
          naturally expands; collapsing returns it to its previous
          height. No absolute positioning, no overflow. */}
      {isOpen && (
        <section
          className="mt-3 rounded-xl border border-metu-yellow/30 bg-space-950 overflow-hidden"
          aria-label="EXPLAIN ANALYZE result"
        >
          <header className="flex items-center justify-between gap-3 px-3 py-2 border-b border-line bg-space-900/60">
            <span className="text-[11px] uppercase tracking-wider text-ink-dim font-semibold">
              {err ? "Plan failed" : "EXPLAIN ANALYZE result"}
            </span>
            <button
              type="button"
              onClick={close}
              className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs text-ink-dim hover:text-white hover:bg-white/5"
              aria-label="Close plan"
            >
              <X className="h-3.5 w-3.5" />
              Close
            </button>
          </header>
          <pre
            className={`text-[11px] font-mono whitespace-pre overflow-auto p-4 max-h-[480px] ${
              err ? "text-coral" : "text-white"
            }`}
          >
            {err ?? out}
          </pre>
        </section>
      )}
    </>
  );
}
