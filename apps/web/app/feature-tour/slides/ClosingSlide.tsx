"use client";
import { Database, Sparkles } from "lucide-react";

// Closing recap. The earlier version pitched a QR scan, which we
// dropped because (a) the mobile UI is intentionally deferred and
// (b) a kiosk on a hallway monitor benefits more from a database-flavoured
// summary slide than a "scan me" CTA. Mirrors the HeroSlide grid layout
// so the loop bookends visually.

interface NumberTile {
  value: string;
  label: string;
  hint?: string;
  tint: "yellow" | "mint" | "blue" | "purple" | "coral" | "cyan";
}

const TINT_CLASS: Record<NumberTile["tint"], string> = {
  yellow: "text-metu-yellow",
  mint: "text-mint",
  blue: "text-blue-300",
  purple: "text-purple-300",
  coral: "text-coral",
  cyan: "text-cyan-300",
};

const NUMBERS: NumberTile[] = [
  { value: "29",  label: "Entities mapped",          hint: "tables in schema.prisma", tint: "purple" },
  { value: "33",  label: "Foreign-key relations",    hint: "ON DELETE CASCADE / SET NULL / RESTRICT", tint: "blue" },
  { value: "43",  label: "Migrations shipped",       hint: "every schema change is reviewable", tint: "mint" },
  { value: "181", label: "Automated tests",          hint: "run before every release", tint: "yellow" },
  { value: "11",  label: "Raw-SQL queries showcased", hint: "/admin/queries — joins, CTEs, JSONB", tint: "coral" },
  { value: "3+1", label: "Views (3) + matview (1)",  hint: "live_stores, product_avg_rating, +top_stores_30d", tint: "cyan" },
];

export function ClosingSlide() {
  return (
    <div className="relative h-full w-full flex flex-col items-center justify-center px-12 text-center">
      <div className="inline-flex items-center gap-2 rounded-full border border-purple-400/30 bg-purple-500/5 px-5 py-2 text-sm font-semibold text-purple-300 mb-8">
        <Database className="h-4 w-4" />
        The numbers behind METU
      </div>

      <h2 className="font-display text-5xl md:text-7xl font-extrabold leading-[0.95] tracking-tight text-white">
        It's a real database.
      </h2>
      <p className="mt-6 text-xl text-ink-secondary max-w-3xl">
        Every screen on metu.online is wired to live Postgres — schema,
        migrations, raw SQL, views, and a matview, all defended end-to-end.
      </p>

      <div className="mt-12 grid grid-cols-2 md:grid-cols-3 gap-4 w-full max-w-5xl">
        {NUMBERS.map((n) => (
          <NumberCard key={n.label} tile={n} />
        ))}
      </div>

      <div className="mt-12 flex items-center gap-3 text-sm uppercase tracking-[0.3em] text-ink-dim">
        <Sparkles className="h-3.5 w-3.5" />
        <span>CPE241 · Database Systems · KMUTT G.8 · metu.online</span>
      </div>
    </div>
  );
}

function NumberCard({ tile }: { tile: NumberTile }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur px-6 py-6 text-left">
      <div className={`font-display text-5xl md:text-6xl font-extrabold tabular-nums leading-none ${TINT_CLASS[tile.tint]}`}>
        {tile.value}
      </div>
      <div className="mt-3 text-sm font-semibold text-white">{tile.label}</div>
      {tile.hint && (
        <div className="text-[11px] text-ink-dim mt-1 font-mono leading-snug">
          {tile.hint}
        </div>
      )}
    </div>
  );
}
