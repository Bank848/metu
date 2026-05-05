"use client";

import { useState } from "react";
import { Play, Loader2 } from "lucide-react";

const PRESETS = [
  {
    label: "Top sellers by revenue",
    sql: `SELECT s.store_id, s.name,
       SUM(oi.price_per_unit * oi.quantity)::text AS revenue,
       COUNT(DISTINCT o.order_id) AS orders
FROM store s
JOIN product p       ON p.store_id = s.store_id
JOIN product_item pi ON pi.product_id = p.product_id
JOIN order_item oi   ON oi.product_item_id = pi.product_item_id
JOIN orders o        ON o.order_id = oi.order_id
WHERE o.status IN ('paid','fulfilled')
GROUP BY s.store_id, s.name
ORDER BY revenue DESC
LIMIT 10`,
  },
  {
    label: "Order count by status",
    sql: `SELECT status::text, COUNT(*) AS count
FROM orders
GROUP BY status
ORDER BY count DESC`,
  },
  {
    label: "EXPLAIN price-sort plan",
    sql: `EXPLAIN ANALYZE
SELECT p.product_id
FROM product p
LEFT JOIN LATERAL (
  SELECT MIN(price::float * (100 - COALESCE(discount_percent, 0)) / 100.0) AS min_price
  FROM product_item WHERE product_id = p.product_id
) i ON true
WHERE p.is_active = true
ORDER BY COALESCE(i.min_price, 0) ASC
LIMIT 12`,
  },
  {
    label: "JSONB lookup on audit_log.meta",
    sql: `SELECT log_id, action, meta
FROM audit_log
WHERE meta @> '{"byAdmin": 1}'
ORDER BY created_at DESC
LIMIT 10`,
  },
];

interface RunResult {
  rows: Array<Record<string, unknown>>;
  rowCount: number;
  truncated: boolean;
  durationMs: number;
}

export function SqlConsole() {
  const [sql, setSql] = useState(PRESETS[0].sql);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/admin/db/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ sql }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.message ?? "Couldn't run that query.");
      } else {
        setResult(data as RunResult);
      }
    } catch {
      setError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => setSql(p.sql)}
            className="text-xs rounded-full border border-line bg-space-950 px-3 py-1 text-ink-secondary hover:border-metu-yellow/50 hover:text-white"
          >
            {p.label}
          </button>
        ))}
      </div>

      <textarea
        value={sql}
        onChange={(e) => setSql(e.target.value)}
        rows={8}
        spellCheck={false}
        className="w-full font-mono text-xs rounded-xl border border-line bg-space-950 px-4 py-3 text-white focus:border-metu-yellow outline-none"
      />

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={run}
          disabled={busy || !sql.trim()}
          className="inline-flex items-center gap-2 rounded-full bg-metu-yellow px-4 py-2 text-sm font-bold text-surface-1 hover:bg-metu-yellow/90 disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          {busy ? "Running…" : "Run"}
        </button>
        {result && (
          <span className="text-xs text-ink-dim">
            {result.rowCount.toLocaleString()} row{result.rowCount === 1 ? "" : "s"} in {result.durationMs} ms
            {result.truncated && " (truncated to 200)"}
          </span>
        )}
      </div>

      {error && (
        <p className="text-sm text-coral border border-coral/30 bg-coral/5 rounded-xl px-3 py-2">
          {error}
        </p>
      )}

      {result && result.rows.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full text-xs">
            <thead className="bg-space-950 text-ink-dim">
              <tr>
                {Object.keys(result.rows[0]).map((k) => (
                  <th key={k} className="text-left px-3 py-2 font-mono font-medium border-b border-line">
                    {k}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.rows.map((row, i) => (
                <tr key={i} className="border-t border-line/50">
                  {Object.values(row).map((v, j) => (
                    <td key={j} className="px-3 py-1.5 font-mono text-white tabular-nums">
                      {v === null ? <span className="text-ink-dim">null</span> : String(v)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {result && result.rows.length === 0 && (
        <p className="text-xs text-ink-dim italic">No rows returned.</p>
      )}
    </div>
  );
}
