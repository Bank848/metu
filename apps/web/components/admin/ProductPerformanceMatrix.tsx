import Link from "next/link";
import { TrendingDown, AlertCircle } from "lucide-react";
import { coins, coinsCompact, thbToCoins } from "@/lib/format";
import { SqlTechniqueBadge } from "./SqlTechniqueBadge";

// Section 5f of the CPE241 final report — Product Performance Matrix.
// The TOP half of the matrix (best-selling products) lives in the
// existing TopProducts widget. This component fills in the BOTTOM
// half: products with the lowest 30-day revenue, so the operator
// can decide who to surface, discount, or pull. Sorted ascending by
// 30-day revenue, ties broken by lifetime units sold then product
// id for determinism.
//
// We intentionally show "active" products only — paused / suspended
// products are out of scope for promotion.

interface Row {
  productId: number;
  name: string;
  revenue30d: number;
  units30d: number;
  totalUnits: number;
}

export function ProductPerformanceMatrix({ rows }: { rows: Row[] }) {
  // Highest-revenue row in the slice — drives the inline bar's
  // relative scale. We invert the bar (longer = better) so the
  // visual stays intuitive: long bar = decent revenue but still
  // bottom-5; tiny bar = absolutely no movement.
  const max = Math.max(1, ...rows.map((r) => r.revenue30d));
  const totalDead = rows.filter((r) => r.revenue30d === 0).length;

  return (
    <div className="rounded-2xl border border-line bg-space-900 p-5">
      <header className="mb-3">
        <h3 className="font-display font-bold text-white flex items-center gap-2">
          <TrendingDown className="h-4 w-4 text-coral" />
          Underperformers (30d)
        </h3>
        <div className="flex items-center gap-1.5 flex-wrap mt-1">
          <p className="text-xs text-ink-dim">
            Bottom 5 by 30-day revenue · candidates for promotion or pull
          </p>
          <SqlTechniqueBadge technique="join-group" label="LEFT JOIN order_item" />
        </div>
      </header>

      {rows.length === 0 ? (
        <p className="text-xs text-ink-dim italic">No active products yet.</p>
      ) : (
        <ol className="space-y-2 text-sm">
          {rows.map((r, i) => {
            const pct = (r.revenue30d / max) * 100;
            const isDead = r.revenue30d === 0;
            return (
              <li key={r.productId}>
                <Link
                  href={`/product/${r.productId}`}
                  className="group flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-white/[0.04] transition"
                >
                  <span className="text-ink-dim text-xs font-mono w-5 shrink-0">
                    {i + 1}.
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-white truncate group-hover:text-coral">
                        {r.name}
                      </span>
                      <span
                        className={
                          "font-mono text-xs shrink-0 tabular-nums " +
                          (isDead ? "text-coral" : "text-ink-secondary")
                        }
                      >
                        {coins(thbToCoins(r.revenue30d))}
                      </span>
                    </div>
                    {/* Inline bar — coral so it visually contrasts with
                        the mint Top Stores / Top Buyers leaderboards. */}
                    <div className="mt-1 flex items-center gap-2">
                      <span className="flex-1 h-1 rounded-full bg-space-950 overflow-hidden">
                        <span
                          className="block h-full bg-coral animate-bar-extend"
                          style={{
                            ["--target-w" as string]: `${pct}%`,
                            animationDelay: `${i * 60}ms`,
                          }}
                        />
                      </span>
                      <span className="text-[10px] text-ink-dim font-mono tabular-nums shrink-0 whitespace-nowrap">
                        {r.units30d}u/30d · {r.totalUnits}u total
                      </span>
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ol>
      )}

      {totalDead > 0 && (
        <div className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-coral/10 ring-1 ring-coral/30 px-2 py-1 text-[11px] text-coral">
          <AlertCircle className="h-3 w-3" />
          {totalDead} product{totalDead === 1 ? "" : "s"} with zero sales in the last 30 days
        </div>
      )}
    </div>
  );
}
