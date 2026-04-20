"use client";
import { useState } from "react";
import { Code2 } from "lucide-react";

type Report = { sql: string; rows: any[] };

export function ReportCard({ title, description, data }: { title: string; description: string; data: Report }) {
  const [showSql, setShowSql] = useState(false);
  const cols = data.rows[0] ? Object.keys(data.rows[0]) : [];

  return (
    <section className="rounded-2xl border border-line bg-space-850 overflow-hidden">
      <header className="px-5 py-4 border-b border-line flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display font-bold text-white">{title}</h3>
          <p className="text-xs text-ink-dim mt-0.5">{description}</p>
        </div>
        <button
          type="button"
          onClick={() => setShowSql((s) => !s)}
          className="inline-flex items-center gap-1 text-xs font-semibold rounded-full bg-brand-yellow/15 text-brand-yellow border border-brand-yellow/30 px-3 py-1 hover:bg-brand-yellow/25"
        >
          <Code2 className="h-3.5 w-3.5" />
          {showSql ? "Hide SQL" : "View SQL"}
        </button>
      </header>
      {showSql && (
        <pre className="bg-space-950 text-brand-yellow text-[11px] leading-relaxed p-4 overflow-x-auto font-mono border-b border-line">
          {data.sql.trim()}
        </pre>
      )}
      <div className="p-4">
        {data.rows.length === 0 ? (
          <p className="text-sm text-ink-dim text-center py-4">No data.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-xs uppercase tracking-wider text-ink-dim">
                  {cols.map((c) => (
                    <th key={c} className="text-left px-3 py-2 font-semibold">{c.replace(/_/g, " ")}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.rows.slice(0, 15).map((row, i) => (
                  <tr key={i} className="border-b border-line last:border-none hover:bg-white/5">
                    {cols.map((c) => (
                      <td key={c} className="px-3 py-2 font-mono text-[12px] text-ink-secondary">
                        {formatCell(row[c])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

function formatCell(v: any): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "number") return v.toLocaleString();
  if (typeof v === "string" && v.match(/^\d{4}-\d{2}-\d{2}T/)) return new Date(v).toLocaleDateString();
  return String(v);
}
