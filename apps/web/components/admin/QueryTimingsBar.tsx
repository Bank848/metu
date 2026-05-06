"use client";
import { useState } from "react";
import { Activity, ChevronDown, ChevronUp } from "lucide-react";

interface Timing {
  name: string;
  ms: number;
}

// Footer strip for /admin showing how many SQL queries the page ran
// and how long each took. The numbers are *parallel duration* — these
// queries run via Promise.all so they overlap; the wall-clock time is
// the max(ms), not the sum. Label says "query duration" so reviewers
// don't misread it as serial.
export function QueryTimingsBar({ timings }: { timings: Timing[] }) {
  const [open, setOpen] = useState(false);
  if (timings.length === 0) return null;

  const total = timings.reduce((sum, t) => sum + t.ms, 0);
  const max = Math.max(...timings.map((t) => t.ms));

  return (
    <div className="rounded-2xl border border-line bg-space-900 px-4 py-2.5 text-xs font-mono">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center justify-between text-ink-secondary hover:text-white transition"
      >
        <span className="inline-flex items-center gap-2">
          <Activity className="h-3.5 w-3.5 text-mint" />
          {timings.length} SQL queries · ∑ {total.toFixed(1)}ms (parallel) · max {max.toFixed(1)}ms
        </span>
        {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
      </button>
      {open && (
        <ul className="mt-3 space-y-1 text-ink-secondary">
          {timings.map((t) => (
            <li key={t.name} className="flex items-center gap-3">
              <span className="w-44 truncate">{t.name}</span>
              <span className="flex-1 h-1.5 rounded-full bg-space-950 overflow-hidden">
                <span
                  className="block h-full bg-mint"
                  style={{ width: `${(t.ms / max) * 100}%` }}
                />
              </span>
              <span className="tabular-nums w-14 text-right text-mint">
                {t.ms.toFixed(1)}ms
              </span>
            </li>
          ))}
          <li className="text-ink-dim text-[10px] mt-2 italic font-sans">
            Each timing is the elapsed duration of that query inside the parallel batch — not the total wall-clock time.
          </li>
        </ul>
      )}
    </div>
  );
}
