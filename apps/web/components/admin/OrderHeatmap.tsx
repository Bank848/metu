"use client";
import { useMemo, useState } from "react";

// 7×24 grid of order counts (DoW × hour) computed in
// Asia/Bangkok time. Each cell shades by intensity (mint scale).
// Keeps the visual style aligned with `RevenueChart` — no chart lib.

interface Cell {
  dow: number;   // 0=Sunday, 6=Saturday (Postgres EXTRACT(DOW))
  hour: number;  // 0..23
  orders: number;
}

const DOW_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function OrderHeatmap({
  data,
  days = 30,
}: {
  data: Cell[];
  days?: number;
}) {
  const [hover, setHover] = useState<Cell | null>(null);

  // Index incoming sparse rows for O(1) lookup; fill missing cells
  // with zero so the grid is dense.
  const grid = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of data) m.set(`${c.dow}-${c.hour}`, c.orders);
    const max = Math.max(1, ...data.map((c) => c.orders));
    return { lookup: m, max };
  }, [data]);

  // Cell dimensions — 7 rows × 24 columns, fits 1024px wide cleanly.
  const CELL_W = 26;
  const CELL_H = 22;
  const PAD_L = 36;
  const PAD_T = 22;
  const W = PAD_L + 24 * CELL_W;
  const H = PAD_T + 7 * CELL_H + 18;

  return (
    <div className="rounded-2xl border border-line bg-space-900 p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-display text-base font-bold text-white">
            When buyers actually shop
          </h3>
          <p className="text-xs text-ink-dim">
            Orders by day-of-week × hour · last {days} days · Asia/Bangkok time · darker = more activity
          </p>
        </div>
        {hover && (
          <div className="text-xs font-mono text-mint tabular-nums">
            {DOW_LABELS[hover.dow]} {String(hover.hour).padStart(2, "0")}:00 · {hover.orders.toLocaleString()} order{hover.orders === 1 ? "" : "s"}
          </div>
        )}
      </div>

      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minWidth: 600 }}>
          {/* Hour ticks across the top, every 3 hours */}
          {Array.from({ length: 24 }, (_, h) => h).map((h) =>
            h % 3 === 0 ? (
              <text
                key={`hour-${h}`}
                x={PAD_L + h * CELL_W + CELL_W / 2}
                y={PAD_T - 6}
                fontSize={9}
                textAnchor="middle"
                fill="#5b6776"
                fontFamily="ui-monospace, monospace"
              >
                {String(h).padStart(2, "0")}
              </text>
            ) : null,
          )}

          {/* Day labels down the left */}
          {DOW_LABELS.map((label, dow) => (
            <text
              key={`dow-${dow}`}
              x={PAD_L - 6}
              y={PAD_T + dow * CELL_H + CELL_H / 2 + 3}
              fontSize={9}
              textAnchor="end"
              fill="#5b6776"
              fontFamily="ui-monospace, monospace"
            >
              {label}
            </text>
          ))}

          {/* Cells */}
          {Array.from({ length: 7 }, (_, dow) =>
            Array.from({ length: 24 }, (_, hour) => {
              const orders = grid.lookup.get(`${dow}-${hour}`) ?? 0;
              const intensity = orders === 0 ? 0 : 0.18 + 0.82 * (orders / grid.max);
              const fill = orders === 0
                ? "#1a1f26"
                : `rgba(80, 220, 180, ${intensity.toFixed(3)})`;
              return (
                <rect
                  key={`${dow}-${hour}`}
                  x={PAD_L + hour * CELL_W + 1}
                  y={PAD_T + dow * CELL_H + 1}
                  width={CELL_W - 2}
                  height={CELL_H - 2}
                  rx={3}
                  fill={fill}
                  stroke="rgba(255,255,255,0.04)"
                  strokeWidth={1}
                  onMouseEnter={() => setHover({ dow, hour, orders })}
                  onMouseLeave={() => setHover(null)}
                  style={{ cursor: orders > 0 ? "pointer" : "default" }}
                />
              );
            }),
          )}

          {/* Footer scale legend */}
          <text
            x={PAD_L}
            y={PAD_T + 7 * CELL_H + 14}
            fontSize={9}
            fill="#5b6776"
            fontFamily="ui-monospace, monospace"
          >
            0
          </text>
          {Array.from({ length: 8 }, (_, i) => (
            <rect
              key={`scale-${i}`}
              x={PAD_L + 12 + i * 16}
              y={PAD_T + 7 * CELL_H + 6}
              width={14}
              height={8}
              fill={`rgba(80, 220, 180, ${(0.18 + 0.82 * (i / 7)).toFixed(3)})`}
              rx={2}
            />
          ))}
          <text
            x={PAD_L + 12 + 8 * 16 + 4}
            y={PAD_T + 7 * CELL_H + 14}
            fontSize={9}
            fill="#5b6776"
            fontFamily="ui-monospace, monospace"
          >
            {grid.max.toLocaleString()}
          </text>
        </svg>
      </div>
    </div>
  );
}
