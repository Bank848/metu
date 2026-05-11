"use client";
import { useEffect, useRef, useState } from "react";
import { Activity, Loader2, X } from "lucide-react";

/**
 * Runs `EXPLAIN ANALYZE` against the showcase query via the existing
 * /admin/db/run endpoint (read-only Postgres console). Output is shown
 * in a modal-style overlay positioned BELOW the button so it never
 * pushes other cards down, with a close button inside the overlay
 * itself, a bounded max-height + scroll, and click-outside to dismiss.
 *
 * The endpoint already enforces SET LOCAL transaction_read_only = on
 * and a 30-second statement timeout, so even a runaway plan can't
 * impact production traffic.
 */
export function ExplainButton({ sql }: { sql: string }) {
  const [busy, setBusy] = useState(false);
  const [out, setOut] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);

  // We strip $1, $2, … placeholders for the EXPLAIN by substituting
  // sane defaults — the planner doesn't need real parameter values to
  // produce a representative plan. NULL works for most params; for
  // numeric / id fields we substitute 1 so JOINs still resolve.
  function preparedSql(): string {
    return sql.replace(/\$(\d+)/g, "1");
  }

  function close() {
    setOut(null);
    setErr(null);
  }

  // Esc-to-close + click-outside while open.
  useEffect(() => {
    if (out === null && !err) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    function onClick(e: MouseEvent) {
      if (overlayRef.current && !overlayRef.current.contains(e.target as Node)) {
        close();
      }
    }
    document.addEventListener("keydown", onKey);
    // Defer click-outside one tick so the very click that opened the
    // overlay doesn't immediately close it.
    const t = setTimeout(() => document.addEventListener("click", onClick), 0);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("click", onClick);
      clearTimeout(t);
    };
  }, [out, err]);

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
        // Surface the real backend message + code if either is present.
        // Fall back to the HTTP status so 500s don't look like silent failures.
        const code = data?.error ? ` (${data.error})` : "";
        const msg = data?.message ?? `HTTP ${res.status}`;
        setErr(`${msg}${code}`);
      } else {
        const lines = (data?.rows ?? []).map(
          (r: Record<string, unknown>) => String(r["QUERY PLAN"] ?? Object.values(r)[0] ?? ""),
        );
        setOut(lines.join("\n") || "(empty plan)");
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Network error.");
    } finally {
      setBusy(false);
    }
  }

  const isOpen = out !== null || err !== null;

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={explain}
        disabled={busy}
        className="inline-flex items-center gap-1.5 rounded-full border border-line bg-space-950 px-3 py-1 text-xs text-ink-secondary hover:border-metu-yellow/50 hover:text-white disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Activity className="h-3 w-3" />}
        {busy ? "Explaining…" : "EXPLAIN ANALYZE"}
      </button>

      {isOpen && (
        <div
          ref={overlayRef}
          className="absolute z-30 top-full left-0 mt-2 w-[min(92vw,720px)] rounded-xl border border-metu-yellow/30 bg-space-950 shadow-2xl overflow-hidden"
          role="dialog"
          aria-label="EXPLAIN ANALYZE result"
        >
          <header className="flex items-center justify-between gap-3 px-3 py-2 border-b border-line bg-space-900/80">
            <span className="text-[11px] uppercase tracking-wider text-ink-dim font-semibold">
              {err ? "Plan failed" : "EXPLAIN ANALYZE"}
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
            className={`text-[11px] font-mono whitespace-pre overflow-auto max-h-[60vh] p-4 ${
              err ? "text-coral" : "text-white"
            }`}
          >
            {err ?? out}
          </pre>
        </div>
      )}
    </div>
  );
}
