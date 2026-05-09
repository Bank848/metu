"use client";
import { useMemo, useState } from "react";
import { coins, thbToCoins } from "@/lib/format";

type Point = { day: string; revenue: number; orderCount: number };

/**
 * Pure-SVG line chart with area fill for daily paid revenue. Buckets into
 * 7-day windows past 30 days. Peak point highlighted in gold; weekend
 * points dimmed; hover surfaces a per-bucket tooltip in the header.
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
  const baseY = H - PAD_BOTTOM;
  const gridlines = [0.25, 0.5, 0.75, 1];

  // Compute (x, y) for each bucket. Center the dot inside its slot.
  const points = buckets.map((b, i) => {
    const x = PAD_X + i * slot + slot / 2;
    const y = baseY - (b.revenue / max) * innerH;
    return { x, y, b, i };
  });

  // Line path: M x0,y0 L x1,y1 ...
  const linePath = points.length > 0
    ? "M " + points.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" L ")
    : "";
  // Area path: same as line but closed back to baseline so we can fill.
  const areaPath = points.length > 0
    ? `${linePath} L ${points[points.length - 1]!.x.toFixed(2)},${baseY} L ${points[0]!.x.toFixed(2)},${baseY} Z`
    : "";

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
          {/* Area-under-line fill — mint, fades down to transparent. */}
          <linearGradient id="line-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6EE7B7" stopOpacity="0.40" />
            <stop offset="100%" stopColor="#047857" stopOpacity="0" />
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

        {/* Area fill under the line. */}
        {areaPath && (
          <path d={areaPath} fill="url(#line-area)" />
        )}
        {/* The line itself — mint stroke, slightly thicker so it reads
            on dim backgrounds. */}
        {linePath && (
          <path
            d={linePath}
            fill="none"
            stroke="#34D399"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Per-point dots + invisible hit area + sparse axis label. */}
        {points.map(({ x, y, b, i }) => {
          const isPeak = i === maxIdx && b.revenue > 0;
          const isHover = hoverIdx === i;
          const dotFill = isPeak ? "#FFD166" : "#34D399";
          const dotR = isHover ? 5 : isPeak ? 4 : 3;
          const dotOpacity = b.isWeekend && !isPeak && !isHover ? 0.55 : 1;
          return (
            <g key={b.key}>
              <circle
                cx={x}
                cy={y}
                r={dotR}
                fill={dotFill}
                opacity={dotOpacity}
                stroke={isHover ? "rgba(255,255,255,0.4)" : "transparent"}
                strokeWidth="2"
              />
              {/* Slot-wide invisible hit zone so the chart feels like
                  one continuous interactive surface. */}
              <rect
                x={PAD_X + i * slot}
                y={PAD_Y}
                width={slot}
                height={innerH + 4}
                fill="transparent"
                style={{ cursor: "pointer" }}
                onMouseEnter={() => setHoverIdx(i)}
              />
              {i % labelStep === 0 && (
                <text
                  x={x}
                  y={H - 6}
                  textAnchor="middle"
                  fontSize="9"
                  fill={isPeak ? "#FFD166" : "rgba(255,255,255,0.45)"}
                  fontFamily="JetBrains Mono, monospace"
                >
                  {b.shortLabel}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* Legend strip — dot swatches match the line markers. */}
      <div className="mt-3 flex items-center gap-3 text-[10px] text-ink-dim font-mono uppercase tracking-wider flex-wrap">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-mint" />
          {isWeekly ? "weekly" : "weekday"}
        </span>
        {!isWeekly && (
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-mint/55" />
            weekend
          </span>
        )}
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-metu-yellow" />
          peak
        </span>
        <span className="ml-auto text-ink-dim/70">
          {hovered ? "release to see totals" : "hover the chart for daily detail"}
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
