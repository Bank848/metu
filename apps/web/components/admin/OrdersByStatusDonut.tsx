"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SqlTechniqueBadge } from "./SqlTechniqueBadge";

interface Slice {
  status: string;
  count: number;
}

// Colour-coded donut for the order-status breakdown. Click a status
// to filter /admin/orders by that status (page exists today, this
// just deep-links into the filter). Pure SVG, no dependencies.
//
// Status palette is tuned to match Badge variants used elsewhere
// in /admin (Badge.coral / .success / .mist / .info / .yellow) so the
// donut and table feel like the same system.

const STATUS_COLOURS: Record<string, string> = {
  paid:       "#3ddc97",  // mint
  fulfilled:  "#62b6ff",  // blue
  pending:    "#f4c04f",  // metu-yellow
  cancelled:  "#7a8190",  // mist (slate)
  refunded:   "#c08bff",  // purple
  failed:     "#ff6464",  // coral
};

const FALLBACK = "#5b6776";

export function OrdersByStatusDonut({
  data,
  size = 200,
}: {
  data: Slice[];
  size?: number;
}) {
  const router = useRouter();
  const [hovered, setHovered] = useState<string | null>(null);
  // Track keyboard focus separately from hover so a tabbing user always
  // sees a visible ring on the focused slice — the prior rev set
  // `outline: none` on the path with no replacement, which hid the
  // focus indicator entirely (a11y violation).
  const [focused, setFocused] = useState<string | null>(null);
  const total = useMemo(() => data.reduce((sum, s) => sum + s.count, 0), [data]);

  if (total === 0) {
    return (
      <div className="rounded-2xl border border-line bg-space-900 p-5">
        <h3 className="font-display font-bold text-white mb-2">
          Orders by status
        </h3>
        <p className="text-sm text-ink-dim italic">No orders yet.</p>
      </div>
    );
  }

  const radius = size / 2;
  const inner = radius * 0.6;
  const segments = computeSegments(data, total);

  return (
    <div className="rounded-2xl border border-line bg-space-900 p-5">
      <header className="flex items-center justify-between mb-3 gap-3">
        <div className="min-w-0">
          <h3 className="font-display font-bold text-white">Orders by status</h3>
          <div className="flex items-center gap-2 flex-wrap mt-1">
            <p className="text-xs text-ink-dim">
              {total.toLocaleString()} order{total === 1 ? "" : "s"} · click a slice to filter
            </p>
            <SqlTechniqueBadge technique="join-group" label="GROUP BY status" />
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-5 items-center">
        <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} className="shrink-0">
          {/* Outer ring background so a single 100% slice still shows
              the donut shape rather than collapsing. */}
          <circle cx={radius} cy={radius} r={radius} fill="rgba(255,255,255,0.04)" />

          {segments.map((seg, i) => {
            const isHovered = hovered === seg.status;
            const r = isHovered ? radius : radius * 0.96;
            const pulled = isHovered ? polarToCart(seg.midAngle, 4) : { x: 0, y: 0 };
            // Clockwise stagger so the eye follows the donut as it
            // assembles. 80ms per slice * up to 6 statuses ≈ 480ms.
            const delayMs = 90 + i * 80;
            // Earlier rev wrapped this <path> in <Link>, but a Next.js
            // <Link> renders an <a> element, and an <a> inside <svg>
            // is invalid HTML — Next 14 hydration mismatches on it,
            // and that hydration error was knocking out click handlers
            // on neighbouring components (the KPI cards above).
            // Fix: drive navigation from a path-level onClick that
            // calls router.push directly. `pointer-events: auto` on
            // the path is implicit; the surrounding <svg> doesn't
            // intercept.
            const isFocused = focused === seg.status;
            return (
              <path
                key={seg.status}
                d={arcPath(radius, radius, r, inner, seg.startAngle, seg.endAngle)}
                fill={STATUS_COLOURS[seg.status] ?? FALLBACK}
                // Keyboard focus visual: a 2px white stroke around the
                // focused slice. Hidden when not focused so it doesn't
                // compete with the hover transform animation.
                stroke={isFocused ? "rgba(255,255,255,0.85)" : "none"}
                strokeWidth={isFocused ? 2 : 0}
                transform={`translate(${pulled.x} ${pulled.y})`}
                className="animate-slice-pop"
                onMouseEnter={() => setHovered(seg.status)}
                onMouseLeave={() => setHovered(null)}
                onFocus={() => setFocused(seg.status)}
                onBlur={() => setFocused(null)}
                onClick={() => router.push(`/admin/orders?status=${seg.status}`)}
                role="link"
                aria-label={`Filter orders by ${seg.status}`}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    router.push(`/admin/orders?status=${seg.status}`);
                  }
                }}
                style={{
                  transition: "transform 200ms ease-out, stroke-width 120ms ease-out",
                  cursor: "pointer",
                  outline: "none",
                  animationDelay: `${delayMs}ms`,
                }}
              />
            );
          })}

          {/* Centre label */}
          <text
            x={radius}
            y={radius - 6}
            fontSize={11}
            fill="#94a3b8"
            textAnchor="middle"
            fontFamily="ui-monospace, monospace"
          >
            total
          </text>
          <text
            x={radius}
            y={radius + 14}
            fontSize={22}
            fill="#ffffff"
            textAnchor="middle"
            fontFamily="ui-sans-serif"
            fontWeight={700}
          >
            {total.toLocaleString()}
          </text>
        </svg>

        <ul className="space-y-1.5 text-sm min-w-0">
          {segments.map((seg) => {
            const pct = (seg.count / total) * 100;
            const colour = STATUS_COLOURS[seg.status] ?? FALLBACK;
            return (
              <li
                key={seg.status}
                onMouseEnter={() => setHovered(seg.status)}
                onMouseLeave={() => setHovered(null)}
              >
                <Link
                  href={`/admin/orders?status=${seg.status}`}
                  className={`flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 transition ${
                    hovered === seg.status ? "bg-white/[0.04]" : ""
                  }`}
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <span
                      className="h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ background: colour }}
                    />
                    <span className="text-white capitalize truncate">{seg.status}</span>
                  </span>
                  <span className="font-mono text-xs text-ink-dim tabular-nums shrink-0">
                    {seg.count} <span className="opacity-60">·</span> {pct.toFixed(1)}%
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function computeSegments(data: Slice[], total: number) {
  let acc = 0;
  return data.map((s) => {
    const start = (acc / total) * Math.PI * 2 - Math.PI / 2;
    acc += s.count;
    const end = (acc / total) * Math.PI * 2 - Math.PI / 2;
    return {
      ...s,
      startAngle: start,
      endAngle: end,
      midAngle: (start + end) / 2,
    };
  });
}

function polarToCart(angle: number, r: number) {
  return { x: Math.cos(angle) * r, y: Math.sin(angle) * r };
}

// Build a donut-segment path from outer + inner arcs.
function arcPath(
  cx: number,
  cy: number,
  rOuter: number,
  rInner: number,
  startAngle: number,
  endAngle: number,
): string {
  // Avoid drawing a full-circle path — SVG arcs can't represent 360°
  // in a single path. Cap at slightly less than full circle.
  const safeEnd = Math.min(endAngle, startAngle + Math.PI * 2 - 0.0001);
  const largeArc = safeEnd - startAngle > Math.PI ? 1 : 0;

  const x1 = cx + Math.cos(startAngle) * rOuter;
  const y1 = cy + Math.sin(startAngle) * rOuter;
  const x2 = cx + Math.cos(safeEnd) * rOuter;
  const y2 = cy + Math.sin(safeEnd) * rOuter;
  const x3 = cx + Math.cos(safeEnd) * rInner;
  const y3 = cy + Math.sin(safeEnd) * rInner;
  const x4 = cx + Math.cos(startAngle) * rInner;
  const y4 = cy + Math.sin(startAngle) * rInner;

  return [
    `M ${x1} ${y1}`,
    `A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${x2} ${y2}`,
    `L ${x3} ${y3}`,
    `A ${rInner} ${rInner} 0 ${largeArc} 0 ${x4} ${y4}`,
    "Z",
  ].join(" ");
}
