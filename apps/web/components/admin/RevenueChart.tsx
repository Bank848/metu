import { money } from "@/lib/format";

type Point = { day: string; revenue: number; orderCount: number };

/**
 * Pure-SVG bar chart for the last 14 days of paid revenue. No dep — keeps
 * the admin overview page light. Bars scale to the highest value in the
 * series so the chart always fills the box.
 */
export function RevenueChart({ data }: { data: Point[] }) {
  const max = Math.max(1, ...data.map((d) => d.revenue));
  const totalRevenue = data.reduce((a, b) => a + b.revenue, 0);
  const totalOrders = data.reduce((a, b) => a + b.orderCount, 0);

  const W = 560;
  const H = 160;
  const PAD_X = 12;
  const PAD_Y = 10;
  const innerW = W - PAD_X * 2;
  const innerH = H - PAD_Y * 2;
  const slot = innerW / data.length;
  const barW = Math.max(8, slot * 0.62);

  return (
    <div className="rounded-2xl glass-morphism p-5">
      <div className="flex items-baseline justify-between mb-3">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-ink-dim">Last 14 days · paid revenue</div>
          <div className="font-display text-2xl font-extrabold text-gold-gradient mt-0.5">{money(totalRevenue)}</div>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-wider text-ink-dim">Orders</div>
          <div className="font-display text-2xl font-extrabold text-white mt-0.5">{totalOrders.toLocaleString()}</div>
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-40" role="img" aria-label="Daily revenue chart">
        <defs>
          <linearGradient id="bar-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffcc00" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#b26800" stopOpacity="0.5" />
          </linearGradient>
        </defs>
        {/* baseline */}
        <line x1={PAD_X} x2={W - PAD_X} y1={H - PAD_Y} y2={H - PAD_Y} stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
        {data.map((d, i) => {
          const h = (d.revenue / max) * innerH;
          const x = PAD_X + i * slot + (slot - barW) / 2;
          const y = H - PAD_Y - h;
          const dayLabel = new Date(d.day).getDate();
          return (
            <g key={d.day}>
              <rect x={x} y={y} width={barW} height={Math.max(2, h)} rx="2" fill="url(#bar-gradient)">
                <title>{d.day} · {money(d.revenue)} · {d.orderCount} orders</title>
              </rect>
              <text x={x + barW / 2} y={H - 1} textAnchor="middle" fontSize="8" fill="rgba(255,255,255,0.4)" fontFamily="JetBrains Mono, monospace">
                {dayLabel}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
