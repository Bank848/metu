"use client";
import { useMemo, useState } from "react";
import { coins, thbToCoins } from "@/lib/format";

type Point = { day: string; revenue: number; orderCount: number };

/**
 * Pure-SVG bar chart for daily paid revenue. Buckets into 7-day windows
 * past 30 days so bars stay hoverable, sparse x-axis labels by density,
 * weekend/weekday/max colour coding, and a React-state hover tooltip.
 */
export function RevenueChart({ data }: { data: Point[] }) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  // Bucket by week when the series is too dense to read day-by-day.
  // 30 is the threshold — 30 daily bars in 560px ≈ 18px per slot, still
  // hoverable; beyond that bars become too thin so we collapse 7-at-a-
  // time. The bucket carries its own start/end labels for the tooltip.
  const buckets = useMemo(() => bucketSeries(data), [data]);
  const isWeekly = buckets.length > 0 && buckets[0].kind === "week";

  const max = Math.max(1, ...buckets.map((b) => b.revenue));
  const totalRevenue = buckets.reduce((a, b) => a + b.revenue, 0);
  const totalOrders = buckets.reduce((a, b) => a + b.orderCount, 0);
  // Highlight the bucket with the highest revenue in gold so the eye
  // immediately lands on the spike day/week.
  const maxIdx = buckets.findIndex((b) => b.revenue === max && max > 0);

  const W = 560;
  const H = 180;
  const PAD_X = 12;
  const PAD_Y = 10;
  const PAD_BOTTOM = 22; // room for x-axis labels
  const innerW = W - PAD_X * 2;
  const innerH = H - PAD_Y - PAD_BOTTOM;
  const slot = innerW / Math.max(1, buckets.length);
  // Cap bar width so sparse charts (7-day view) don't render giant
  // slabs. Lower bound (4px) keeps weekly buckets clickable.
  const barW = Math.max(4, Math.min(40, slot * 0.7));
  const gridlines = [0.25, 0.5, 0.75, 1];

  // Show every Nth x-axis label so they never overlap. ~10 labels max
  // across the chart regardless of bucket count.
  const labelStep = Math.max(1, Math.ceil(buckets.length / 10));

  const hovered = hoverIdx != null ? buckets[hoverIdx] : null;

  return (
    <div className="rounded-2xl surface-flat p-5 shadow-flat relative">
      {/* Header — when no bar is hovered, shows the period total. When
          a bar IS hovered, the same slot shows that bar's date + value
          + order count. This is the same pattern Stripe / Vercel use:
          one fixed surface that morphs, instead of a floating tooltip
          that can collide with anything around it (the previous
          floating-tooltip rev was overlapping the big revenue number
          for left-edge bars). */}
      <div className="flex items-baseline justify-between mb-3 gap-3 flex-wrap">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-ink-dim">
            {hovered
              ? hovered.label
              : isWeekly
                ? `Last ${buckets.length} weeks · paid revenue`
                : `Last ${buckets.length} days · paid revenue`}
          </div>
          <div className="font-display text-2xl font-extrabold text-mint mt-0.5 tabular-nums">
            {coins(thbToCoins(hovered ? hovered.revenue : totalRevenue))}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-wider text-ink-dim">
            {hovered ? (hovered.orderCount === 1 ? "Order" : "Orders") : "Orders"}
          </div>
          <div className="font-display text-2xl font-extrabold text-white mt-0.5 tabular-nums">
            {(hovered ? hovered.orderCount : totalOrders).toLocaleString()}
          </div>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-44"
        role="img"
        aria-label="Daily revenue chart"
        onMouseLeave={() => setHoverIdx(null)}
      >
        <defs>
          {/* Weekday gradient — bright mint, full saturation. */}
          <linearGradient id="bar-weekday" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6EE7B7" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#047857" stopOpacity="0.55" />
          </linearGradient>
          {/* Weekend gradient — same hue, lower saturation so weekends
              read as a quieter rhythm without being invisible. */}
          <linearGradient id="bar-weekend" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6EE7B7" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#047857" stopOpacity="0.30" />
          </linearGradient>
          {/* Spike gradient — brand gold for the day/week with the
              highest revenue. Pulls the eye instantly to the outlier. */}
          <linearGradient id="bar-spike" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FFD166" stopOpacity="0.98" />
            <stop offset="100%" stopColor="#B26800" stopOpacity="0.65" />
          </linearGradient>
          {/* Hover gradient — slightly brighter mint so the active bar
              "lifts" without changing colour family. */}
          <linearGradient id="bar-hover" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#A7F3D0" stopOpacity="1" />
            <stop offset="100%" stopColor="#10B981" stopOpacity="0.85" />
          </linearGradient>
          {/* Peak-on-hover gradient — brightened gold so the peak lifts
              without losing its identity. */}
          <linearGradient id="bar-spike-hover" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FFE08A" stopOpacity="1" />
            <stop offset="100%" stopColor="#D48F20" stopOpacity="0.85" />
          </linearGradient>
        </defs>

        {/* horizontal gridlines (drawn first so bars cover them) */}
        {gridlines.map((g) => {
          const y = H - PAD_BOTTOM - innerH * g;
          return (
            <line
              key={g}
              x1={PAD_X}
              x2={W - PAD_X}
              y1={y}
              y2={y}
              stroke="rgba(255,255,255,0.05)"
              strokeWidth="1"
              strokeDasharray="2 4"
            />
          );
        })}

        {/* baseline */}
        <line
          x1={PAD_X}
          x2={W - PAD_X}
          y1={H - PAD_BOTTOM}
          y2={H - PAD_BOTTOM}
          stroke="rgba(255,255,255,0.1)"
          strokeWidth="1"
        />

        {buckets.map((b, i) => {
          const h = (b.revenue / max) * innerH;
          const x = PAD_X + i * slot + (slot - barW) / 2;
          const y = H - PAD_BOTTOM - h;
          // Pick fill. Priority: hover-on-peak > peak > hover > weekend
          // > weekday. The peak bar keeps its gold hue when hovered
          // (just brightens) so the user never wonders "which one is
          // the peak again?" mid-hover.
          const isPeak = i === maxIdx && b.revenue > 0;
          const isHover = hoverIdx === i;
          const fill = isHover && isPeak
            ? "url(#bar-spike-hover)"
            : isPeak
              ? "url(#bar-spike)"
              : isHover
                ? "url(#bar-hover)"
                : b.isWeekend
                  ? "url(#bar-weekend)"
                  : "url(#bar-weekday)";
          // Stagger left → right but cap so 90d doesn't roll in for 3s.
          const delayMs = Math.min(700, i * 25);
          // Render a wider invisible hit area over each bar so even
          // sliver bars are hoverable. Slot-wide so neighbouring bars'
          // hit zones meet flush — feels like the chart is one
          // continuous interactive surface.
          return (
            <g key={b.key}>
              <rect
                x={x}
                y={y}
                width={barW}
                height={Math.max(2, h)}
                rx="2"
                fill={fill}
                className="animate-bar-grow"
                style={{ animationDelay: `${delayMs}ms` }}
              />
              <rect
                x={PAD_X + i * slot}
                y={PAD_Y}
                width={slot}
                height={innerH + 4}
                fill="transparent"
                style={{ cursor: "pointer" }}
                onMouseEnter={() => setHoverIdx(i)}
              />
              {/* X-axis label: day-of-month for daily, week-start for
                  weekly. Rendered every Nth bucket so labels don't
                  overlap. */}
              {i % labelStep === 0 && (
                <text
                  x={x + barW / 2}
                  y={H - 6}
                  textAnchor="middle"
                  fontSize="9"
                  fill={i === maxIdx && b.revenue > 0 ? "#FFD166" : "rgba(255,255,255,0.45)"}
                  fontFamily="JetBrains Mono, monospace"
                >
                  {b.shortLabel}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* Legend strip — keeps the chart self-explanatory without a
          dedicated legend panel. */}
      <div className="mt-3 flex items-center gap-3 text-[10px] text-ink-dim font-mono uppercase tracking-wider flex-wrap">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-mint" />
          {isWeekly ? "weekly" : "weekday"}
        </span>
        {!isWeekly && (
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-mint/40" />
            weekend
          </span>
        )}
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-metu-yellow" />
          peak
        </span>
        <span className="ml-auto text-ink-dim/70">
          {hovered ? "release to see totals" : "hover a bar to see daily detail"}
        </span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Bucketing helpers
// ─────────────────────────────────────────────────────────────────────

type Bucket = {
  key: string;
  /** Long label for the tooltip — e.g. "Mon Jan 15" or "Jan 8 – Jan 14". */
  label: string;
  /** Short x-axis label — e.g. "15" (day) or "Jan 8" (week start). */
  shortLabel: string;
  revenue: number;
  orderCount: number;
  isWeekend: boolean;
  kind: "day" | "week";
};

const MONTH_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DOW_SHORT = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

function bucketSeries(data: Point[]): Bucket[] {
  if (data.length === 0) return [];
  // ≤30 days renders 1 bar per day. Above that we collapse into 7-day
  // windows aligned to the END of the series so the right edge always
  // shows "this week".
  if (data.length <= 30) {
    return data.map((d) => {
      const date = new Date(d.day);
      const dow = date.getDay();
      return {
        key: d.day,
        label: `${DOW_SHORT[dow]} ${MONTH_SHORT[date.getMonth()]} ${date.getDate()}`,
        shortLabel: String(date.getDate()),
        revenue: d.revenue,
        orderCount: d.orderCount,
        isWeekend: dow === 0 || dow === 6,
        kind: "day",
      };
    });
  }

  // Walk backwards from the last day, packing 7 days into each bucket.
  // Reverse the result so the chart still reads left-to-right.
  const out: Bucket[] = [];
  for (let i = data.length - 1; i >= 0; i -= 7) {
    const start = Math.max(0, i - 6);
    const slice = data.slice(start, i + 1);
    const revenue = slice.reduce((a, b) => a + b.revenue, 0);
    const orderCount = slice.reduce((a, b) => a + b.orderCount, 0);
    const startDate = new Date(slice[0].day);
    const endDate = new Date(slice[slice.length - 1].day);
    out.push({
      key: `week-${slice[0].day}`,
      label: `${MONTH_SHORT[startDate.getMonth()]} ${startDate.getDate()} – ${MONTH_SHORT[endDate.getMonth()]} ${endDate.getDate()}`,
      shortLabel: `${MONTH_SHORT[startDate.getMonth()]} ${startDate.getDate()}`,
      revenue,
      orderCount,
      isWeekend: false, // not meaningful for a week
      kind: "week",
    });
  }
  return out.reverse();
}
