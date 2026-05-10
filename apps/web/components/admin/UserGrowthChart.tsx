"use client";

import { useMemo, useState } from "react";
import { TrendingUp, ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";

type Point = { day: string; buyers: number; sellers: number };
type Range = 7 | 30 | 90;

/**
 * 90-day daily new-user series, sliced into 7d / 30d / quarter (90d)
 * windows on demand. Renders an SVG sparkline (no chart-lib dep) with
 * one line per role + a current-vs-previous-window growth tile so the
 * admin can answer "how fast are buyers / sellers joining lately?"
 * at a glance.
 */
export function UserGrowthChart({ series }: { series: Point[] }) {
  const [range, setRange] = useState<Range>(30);

  // Slice the most recent N days for the chart and current period;
  // the previous N days (the window before that) are used to compute
  // the growth-rate tile.
  const slice = useMemo(() => {
    const n = Math.min(range, series.length);
    return series.slice(-n);
  }, [series, range]);

  const prevSlice = useMemo(() => {
    const n = Math.min(range, series.length);
    return series.slice(Math.max(0, series.length - 2 * n), series.length - n);
  }, [series, range]);

  const cur = sumPoints(slice);
  const prev = sumPoints(prevSlice);

  return (
    <div className="rounded-2xl border border-line bg-space-900 p-5">
      <header className="flex items-start justify-between mb-3 gap-3 flex-wrap">
        <div>
          <h3 className="font-display font-bold text-white flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-mint" />
            User growth
          </h3>
          <p className="text-[11px] text-ink-dim mt-0.5">
            Daily new signups split by role
          </p>
        </div>
        <div className="inline-flex rounded-full border border-line bg-space-950 p-0.5 text-[11px] font-semibold">
          {([7, 30, 90] as Range[]).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              className={`px-2.5 py-1 rounded-full transition ${
                range === r
                  ? "bg-metu-yellow text-surface-1"
                  : "text-ink-secondary hover:text-white"
              }`}
            >
              {r === 90 ? "Quarter" : `${r}d`}
            </button>
          ))}
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <RateTile
          label="New buyers"
          color="text-mint"
          current={cur.buyers}
          previous={prev.buyers}
        />
        <RateTile
          label="New sellers"
          color="text-metu-yellow"
          current={cur.sellers}
          previous={prev.sellers}
        />
      </div>

      <Sparkline points={slice} />

      <div className="flex items-center gap-3 mt-2 text-[10px] text-ink-dim">
        <span className="inline-flex items-center gap-1">
          <span className="h-0.5 w-3 bg-mint rounded-full" /> Buyers
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-0.5 w-3 bg-metu-yellow rounded-full" /> Sellers
        </span>
        <span className="ml-auto font-mono">
          {slice[0]?.day} → {slice[slice.length - 1]?.day}
        </span>
      </div>
    </div>
  );
}

function sumPoints(slice: Point[]): { buyers: number; sellers: number } {
  return slice.reduce(
    (acc, p) => ({ buyers: acc.buyers + p.buyers, sellers: acc.sellers + p.sellers }),
    { buyers: 0, sellers: 0 },
  );
}

function RateTile({
  label,
  color,
  current,
  previous,
}: {
  label: string;
  color: string;
  current: number;
  previous: number;
}) {
  // Pct change from previous-window total to current. Show "n/a" when
  // the prior window is empty (no baseline to divide by).
  const pct = previous === 0
    ? null
    : ((current - previous) / previous) * 100;
  const trend =
    pct === null ? "flat"
    : pct > 1 ? "up"
    : pct < -1 ? "down"
    : "flat";

  const Icon = trend === "up" ? ArrowUpRight : trend === "down" ? ArrowDownRight : Minus;
  const trendColor =
    trend === "up" ? "text-mint" : trend === "down" ? "text-coral" : "text-ink-dim";

  return (
    <div className="rounded-xl border border-line bg-space-950 px-3 py-2.5">
      <div className="text-[10px] uppercase tracking-wider text-ink-dim font-semibold">
        {label}
      </div>
      <div className="mt-1 flex items-baseline justify-between gap-2">
        <span className={`font-display text-2xl font-extrabold tabular-nums ${color}`}>
          {current.toLocaleString()}
        </span>
        <span className={`inline-flex items-center gap-0.5 text-xs font-mono ${trendColor}`}>
          <Icon className="h-3 w-3" />
          {pct === null ? "n/a" : `${pct > 0 ? "+" : ""}${pct.toFixed(0)}%`}
        </span>
      </div>
      <div className="text-[10px] text-ink-dim font-mono mt-0.5">
        prev {previous.toLocaleString()}
      </div>
    </div>
  );
}

function Sparkline({ points }: { points: Point[] }) {
  // Pure SVG so we don't drag in a chart lib for one widget. Two
  // overlaid polylines (buyers + sellers); y-axis auto-scales to the
  // max of either series across the visible window.
  const W = 320;
  const H = 80;
  const PAD_X = 4;
  const PAD_Y = 4;
  const max = Math.max(
    1,
    ...points.map((p) => Math.max(p.buyers, p.sellers)),
  );
  const xStep = points.length > 1 ? (W - 2 * PAD_X) / (points.length - 1) : 0;
  const yScale = (v: number) => H - PAD_Y - ((v / max) * (H - 2 * PAD_Y));

  const buyerPath = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${PAD_X + i * xStep} ${yScale(p.buyers)}`)
    .join(" ");
  const sellerPath = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${PAD_X + i * xStep} ${yScale(p.sellers)}`)
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className="w-full h-20"
      role="img"
      aria-label="Daily new-user growth chart"
    >
      {/* Faint baseline */}
      <line x1={0} x2={W} y1={H - PAD_Y} y2={H - PAD_Y} stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
      <path d={buyerPath} fill="none" stroke="rgb(74, 222, 128)" strokeWidth="1.5" />
      <path d={sellerPath} fill="none" stroke="rgb(251, 191, 36)" strokeWidth="1.5" />
    </svg>
  );
}
