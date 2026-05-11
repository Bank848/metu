import { Globe } from "lucide-react";
import { coins, thbToCoins, coinsCompact } from "@/lib/format";
import { SqlTechniqueBadge } from "./SqlTechniqueBadge";

interface CountryRow {
  countryId: number | null;
  countryName: string;
  orders: number;
  spend: number;
}

// Geographic distribution panel — bar list (not a map, since we don't
// have geo coords for countries). Each row shows country name + order
// count + spend, with an inline progress bar tinted by rank.
//
// The query returns the top 8 countries; if there's a long tail we
// show "Other" implicitly by the LIMIT 8 cap on the server side.
export function OrdersByCountryList({ rows }: { rows: CountryRow[] }) {
  const totalOrders = rows.reduce((a, b) => a + b.orders, 0);
  const max = Math.max(1, ...rows.map((r) => r.orders));

  // Country flag emoji is risky (no reliable mapping from name to ISO
  // code without a lookup table), so we use a globe icon prefix and
  // let the country name carry the identification.

  return (
    <div className="rounded-2xl border border-line bg-space-900 p-5">
      <header className="mb-3">
        <h3 className="font-display font-bold text-white flex items-center gap-2">
          <Globe className="h-4 w-4 text-sky-400" />
          Orders by country
        </h3>
        <div className="flex items-center gap-1.5 flex-wrap mt-1">
          <p className="text-xs text-ink-dim">
            {totalOrders.toLocaleString()} settled order{totalOrders === 1 ? "" : "s"} · top {rows.length}
          </p>
          <SqlTechniqueBadge technique="left-join" label="LEFT JOIN country" />
        </div>
      </header>

      {rows.length === 0 ? (
        <p className="text-xs text-ink-dim italic">No paid orders yet.</p>
      ) : (
        <ul className="space-y-1.5 text-sm">
          {rows.map((r, i) => {
            const pct = (r.orders / max) * 100;
            const sharePct = totalOrders > 0 ? ((r.orders / totalOrders) * 100).toFixed(1) : "0.0";
            // 8 distinct hues that all read clearly on the dark surface.
            const tones = [
              "bg-mint",          // 1. Thailand-class — bright green
              "bg-sky-400",       // 2. clear bright blue (was "info")
              "bg-purple-400",    // 3. lavender
              "bg-coral",         // 4. warm pink
              "bg-amber-400",     // 5. brand-adjacent gold
              "bg-rose-400",      // 6. soft red
              "bg-emerald-400",   // 7. another mint-family for >7 rows
              "bg-violet-400",    // 8. deep purple
            ];
            const tone = tones[i % tones.length];
            return (
              <li
                // Use country_id (the actual FK) as the React key, not
                // country_name. NULLs fall back to a stable "unknown"
                // sentinel — the GROUP BY collapses all NULL country_ids
                // into one row anyway, so there's only ever one
                // "Unknown" item.
                key={r.countryId ?? "unknown"}
                className="rounded-lg px-2 py-1 hover:bg-white/[0.04] transition"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="text-ink-dim text-xs font-mono w-5 shrink-0">{i + 1}.</span>
                    <span className="text-white truncate">{r.countryName}</span>
                    <span
                      className="flex-1 h-1.5 rounded-full bg-space-950 overflow-hidden ring-1 ring-line/60"
                      title={`${r.orders} orders · ${coins(thbToCoins(r.spend))}`}
                    >
                      <span
                        className={`block h-full ${tone} animate-bar-extend`}
                        style={{
                          ["--target-w" as string]: `${pct}%`,
                          animationDelay: `${i * 50}ms`,
                        }}
                      />
                    </span>
                  </span>
                  <span className="font-mono text-xs text-ink-dim shrink-0 tabular-nums whitespace-nowrap">
                    {r.orders} <span className="opacity-60">·</span> {sharePct}%
                  </span>
                </div>
                <div className="text-[10px] text-mint/80 font-mono ml-7 mt-0.5 tabular-nums">
                  {coinsCompact(thbToCoins(r.spend))}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
