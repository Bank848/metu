"use client";

import { Ticket } from "lucide-react";
import { coins, thbToCoins } from "@/lib/format";

type DayPoint = { day: string; redemptions: number; discountBaht: number };
type CouponRow = {
  couponId: number;
  code: string;
  discountType: "percent" | "fixed";
  discountValue: number;
  storeId: number | null;
  storeName: string;
  redemptions: number;
  totalDiscount: number;
  netRevenue: number;
};

/**
 * Combo bar+line chart over 30 days of coupon usage.
 * - Bars (yellow): redemptions per day (left axis)
 * - Line (mint):   baht discounted per day (right axis)
 *
 * Below the chart: top-10 coupons table with the actual baht impact
 * each one drove (discount given vs net revenue still booked). The
 * "discount share" column = discount / (discount + net_revenue) — a
 * quick read on how aggressive each promo was relative to its pull.
 */
export function CouponImpactChart({
  series,
  top,
}: {
  series: DayPoint[];
  top: CouponRow[];
}) {
  return (
    <div className="rounded-2xl border border-line bg-space-900 p-5">
      <header className="mb-3">
        <h3 className="font-display font-bold text-white flex items-center gap-2">
          <Ticket className="h-4 w-4 text-metu-yellow" />
          Coupon impact (30 d)
        </h3>
        <p className="text-[11px] text-ink-dim mt-0.5">
          Bars = redemptions per day · Line = baht discounted per day
        </p>
      </header>

      <ComboChart series={series} />

      {/* Legend */}
      <div className="flex items-center gap-4 mt-2 text-[10px] text-ink-dim">
        <span className="inline-flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-sm bg-metu-yellow/70 border border-metu-yellow" />
          Redemptions
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-0.5 w-3 bg-mint rounded-full" />
          Baht discounted
        </span>
        <span className="ml-auto font-mono">
          {series[0]?.day} → {series[series.length - 1]?.day}
        </span>
      </div>

      {/* Top coupons table */}
      <div className="mt-5">
        <div className="text-xs uppercase tracking-wider text-ink-dim font-semibold mb-2">
          Top coupons by redemptions
        </div>
        {top.length === 0 ? (
          <p className="text-xs text-ink-dim italic">No redeemed coupons yet.</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-line">
            <table className="w-full text-xs">
              <thead className="bg-space-950 text-ink-dim text-[10px] uppercase tracking-wider">
                <tr>
                  <th className="text-left px-3 py-1.5 font-medium">Code</th>
                  <th className="text-left px-3 py-1.5 font-medium">Store</th>
                  <th className="text-right px-3 py-1.5 font-medium">Uses</th>
                  <th className="text-right px-3 py-1.5 font-medium">Discount</th>
                  <th className="text-right px-3 py-1.5 font-medium">Net rev</th>
                  <th className="text-right px-3 py-1.5 font-medium" title="discount / (discount + net revenue)">
                    Share
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/50">
                {top.map((c) => {
                  const total = c.totalDiscount + c.netRevenue;
                  const share = total > 0 ? (c.totalDiscount / total) * 100 : 0;
                  const shareTone =
                    share >= 30 ? "text-coral" :
                    share >= 15 ? "text-metu-yellow" :
                    "text-mint";
                  return (
                    <tr key={c.couponId} className="hover:bg-white/[0.02]">
                      <td className="px-3 py-2 font-mono text-metu-yellow font-bold">
                        {c.code}
                      </td>
                      <td className="px-3 py-2 text-ink-secondary truncate max-w-[120px]">
                        {c.storeId === null ? (
                          <span className="text-metu-yellow text-[10px] uppercase">Master</span>
                        ) : (
                          c.storeName
                        )}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-white font-mono">
                        {c.redemptions}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums font-mono text-coral">
                        {coins(thbToCoins(c.totalDiscount))}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums font-mono text-mint">
                        {coins(thbToCoins(c.netRevenue))}
                      </td>
                      <td className={`px-3 py-2 text-right tabular-nums font-mono ${shareTone}`}>
                        {share.toFixed(0)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="text-[10px] text-ink-dim px-3 py-2 bg-space-950/40 border-t border-line">
              <strong className="text-mint">Read:</strong> Higher <em>Share</em> = more aggressive promo. Coupons with high
              redemptions + low share = healthy volume drivers; high share + low net rev = the coupon may be eating margin.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function ComboChart({ series }: { series: DayPoint[] }) {
  // Pure SVG combo chart — no chart library dep. Bars on the
  // redemption axis (left), line on the discount-baht axis (right).
  // Both auto-scale to their own max so the line is visible even when
  // discount totals dwarf redemption counts (or vice versa).
  const W = 600;
  const H = 120;
  const PAD_X = 8;
  const PAD_Y = 6;
  const n = series.length;
  const maxRedemptions = Math.max(1, ...series.map((p) => p.redemptions));
  const maxDiscount = Math.max(1, ...series.map((p) => p.discountBaht));
  const innerW = W - 2 * PAD_X;
  const innerH = H - 2 * PAD_Y;
  const barW = n > 0 ? Math.max(1, innerW / n - 1) : 0;

  const linePath = series
    .map((p, i) => {
      const x = PAD_X + (i + 0.5) * (innerW / n);
      const y = H - PAD_Y - (p.discountBaht / maxDiscount) * innerH;
      return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className="w-full h-32"
      role="img"
      aria-label="Daily coupon redemptions and discount baht"
    >
      {/* Baseline */}
      <line x1={0} x2={W} y1={H - PAD_Y} y2={H - PAD_Y} stroke="rgba(255,255,255,0.08)" strokeWidth="1" />

      {/* Bars: redemptions */}
      {series.map((p, i) => {
        const x = PAD_X + i * (innerW / n) + 0.5;
        const h = (p.redemptions / maxRedemptions) * innerH;
        const y = H - PAD_Y - h;
        return (
          <rect
            key={i}
            x={x}
            y={y}
            width={barW}
            height={Math.max(0, h)}
            fill="rgba(251, 191, 36, 0.55)"
            stroke="rgb(251, 191, 36)"
            strokeWidth="0.5"
          >
            <title>
              {p.day}: {p.redemptions} redemption{p.redemptions === 1 ? "" : "s"}, ฿{p.discountBaht.toLocaleString()} discounted
            </title>
          </rect>
        );
      })}

      {/* Line: discount baht */}
      <path d={linePath} fill="none" stroke="rgb(74, 222, 128)" strokeWidth="1.75" />
    </svg>
  );
}
