import { TrendingUp } from "lucide-react";
import { SqlTechniqueBadge } from "./SqlTechniqueBadge";

interface LevelRow {
  level: number;
  buyers: number;
  sellers: number;
}

// Buyer + seller level distribution across L1-L5. Sourced from
// v_user_level — the view recomputes seller_level from settled
// orders + rating + revenue, and buyer_level from settled orders +
// reviews authored. Two stacked bars per tier so the admin sees both
// distributions side-by-side without two cards.
export function LevelDistributionCard({ rows }: { rows: LevelRow[] }) {
  // Pad to L1-L5 in case the SQL returns fewer rows (shouldn't, but
  // defensive — generate_series should always emit 5).
  const padded = [1, 2, 3, 4, 5].map((lvl) => {
    const r = rows.find((x) => x.level === lvl);
    return { level: lvl, buyers: r?.buyers ?? 0, sellers: r?.sellers ?? 0 };
  });

  const totalBuyers = padded.reduce((a, b) => a + b.buyers, 0);
  const totalSellers = padded.reduce((a, b) => a + b.sellers, 0);
  // Independent max per series so the bars don't crush each other —
  // sellers (~30) and buyers (~thousands) live on different scales.
  const maxBuyers = Math.max(1, ...padded.map((p) => p.buyers));
  const maxSellers = Math.max(1, ...padded.map((p) => p.sellers));

  // One tone per level so the eye can pair across rows.
  const TONE: Record<number, { bar: string; pill: string }> = {
    1: { bar: "bg-white/30",        pill: "bg-white/8 text-ink-secondary border-white/15" },
    2: { bar: "bg-info",            pill: "bg-info/15 text-info border-info/35" },
    3: { bar: "bg-mint",            pill: "bg-mint/15 text-mint border-mint/35" },
    4: { bar: "bg-purple-400",      pill: "bg-purple-500/15 text-purple-300 border-purple-500/40" },
    5: { bar: "bg-metu-yellow",     pill: "bg-metu-yellow/20 text-metu-yellow border-metu-yellow/45" },
  };

  return (
    <div className="rounded-2xl border border-line bg-space-900 p-5">
      <header className="mb-3">
        <h3 className="font-display font-bold text-white flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-metu-yellow" />
          Leveling distribution
        </h3>
        <div className="flex items-center gap-1.5 flex-wrap mt-1">
          <p className="text-xs text-ink-dim">
            Buyers ({totalBuyers.toLocaleString()}) · Sellers ({totalSellers.toLocaleString()})
          </p>
          <SqlTechniqueBadge technique="view" label="VIEW v_user_level" />
          <SqlTechniqueBadge technique="case-bucket" />
        </div>
      </header>

      <div className="grid grid-cols-[auto_1fr_1fr] gap-x-3 gap-y-2 text-sm">
        {/* Column headers */}
        <span className="text-[10px] font-bold uppercase tracking-wider text-ink-dim" />
        <span className="text-[10px] font-bold uppercase tracking-wider text-ink-dim text-right pr-2">
          Buyers
        </span>
        <span className="text-[10px] font-bold uppercase tracking-wider text-ink-dim text-right pr-2">
          Sellers
        </span>

        {padded.map((p, i) => {
          const buyerPct = (p.buyers / maxBuyers) * 100;
          const sellerPct = (p.sellers / maxSellers) * 100;
          const tone = TONE[p.level];
          return (
            <BarRow
              key={p.level}
              level={p.level}
              tone={tone}
              buyers={p.buyers}
              sellers={p.sellers}
              buyerPct={buyerPct}
              sellerPct={sellerPct}
              animationDelay={i * 50}
            />
          );
        })}
      </div>
    </div>
  );
}

function BarRow({
  level,
  tone,
  buyers,
  sellers,
  buyerPct,
  sellerPct,
  animationDelay,
}: {
  level: number;
  tone: { bar: string; pill: string };
  buyers: number;
  sellers: number;
  buyerPct: number;
  sellerPct: number;
  animationDelay: number;
}) {
  return (
    <>
      <span
        className={`inline-flex items-center justify-center self-center rounded-full font-black uppercase tracking-wider border tabular-nums px-2 py-[1px] text-[10px] ${tone.pill}`}
      >
        Lv.{level}
      </span>
      <BarCell value={buyers} pct={buyerPct} tone={tone.bar} delay={animationDelay} />
      <BarCell value={sellers} pct={sellerPct} tone={tone.bar} delay={animationDelay + 25} />
    </>
  );
}

function BarCell({
  value,
  pct,
  tone,
  delay,
}: {
  value: number;
  pct: number;
  tone: string;
  delay: number;
}) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <span className="flex-1 h-1.5 rounded-full bg-space-950 overflow-hidden ring-1 ring-line/60">
        <span
          className={`block h-full ${tone} animate-bar-extend`}
          style={{
            ["--target-w" as string]: `${pct}%`,
            animationDelay: `${delay}ms`,
          }}
        />
      </span>
      <span className="font-mono text-xs text-white shrink-0 tabular-nums w-10 text-right">
        {value.toLocaleString()}
      </span>
    </div>
  );
}
