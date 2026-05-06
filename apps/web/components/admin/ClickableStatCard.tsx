"use client";
import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowUpRight, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { MiniSparkline } from "./MiniSparkline";

// Drill-in variant of StatCard with optional sparkline + click-through
// link. The bare StatCard (components/StatCard) stays for screens
// where we don't want the surface to read as clickable; this wrapper
// adds the affordances when /admin's KPIs deep-link into filter pages.

type Tone = "default" | "highlight" | "zero";

interface Props {
  href: string;
  /** Pre-rendered JSX for the icon. Caller passes e.g. <Banknote
      className="h-3.5 w-3.5" />. We can't accept LucideIcon as a
      component reference because the /admin page is a server
      component — Next.js refuses to serialise function references
      across the RSC boundary into a client component. */
  icon: ReactNode;
  label: string;
  value: string | number;
  /** Optional 7-day series for an inline sparkline. */
  sparkline?: number[];
  /** Sparkline tint. Falls back to the card's accent. */
  sparkColor?: string;
  /** Hover tooltip on the value (e.g. exact ฿ for a compact format). */
  valueTooltip?: string;
  tone?: Tone;
  /** Week-over-week percent change. null = previous period was 0. */
  deltaPct?: number | null;
  /** Tooltip for the delta (e.g. "vs prior 7 days"). */
  deltaLabel?: string;
}

export function ClickableStatCard({
  href,
  icon,
  label,
  value,
  sparkline,
  sparkColor,
  valueTooltip,
  tone = "default",
  deltaPct,
  deltaLabel = "vs prior 7 days",
}: Props) {
  const toneClass =
    tone === "highlight"
      ? "from-metu-yellow/15 to-metu-yellow/5 ring-metu-yellow/30 hover:ring-metu-yellow/50"
      : tone === "zero"
        ? "from-white/3 to-white/1 ring-white/5"
        : "from-white/5 to-white/2 ring-white/10 hover:ring-white/20";

  return (
    <Link
      href={href}
      className={`group relative overflow-hidden rounded-2xl bg-gradient-to-br ${toneClass} ring-1 px-5 py-4 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/30 block`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-ink-dim">
            {icon}
            <span>{label}</span>
          </div>
          <div
            className="font-display text-3xl md:text-4xl font-extrabold text-white mt-2 tabular-nums leading-none"
            title={valueTooltip}
          >
            {value}
          </div>
        </div>
        <ArrowUpRight className="h-4 w-4 text-ink-dim opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all shrink-0" />
      </div>

      {/* Delta + sparkline row. Both optional so cards without
          historical data degrade gracefully. */}
      {(typeof deltaPct === "number" || deltaPct === null || (sparkline && sparkline.length > 0)) && (
        <div className="mt-3 flex items-end justify-between gap-3">
          {(typeof deltaPct === "number" || deltaPct === null) ? (
            <DeltaBadge pct={deltaPct} title={deltaLabel} />
          ) : (
            <span />
          )}
          {sparkline && sparkline.length > 0 && (
            <div style={{ color: sparkColor ?? "rgb(244 192 79)" }}>
              <MiniSparkline data={sparkline} height={28} width={120} />
            </div>
          )}
        </div>
      )}
    </Link>
  );
}

function DeltaBadge({ pct, title }: { pct: number | null; title: string }) {
  if (pct === null) {
    return (
      <span
        title={title + " (no prior data)"}
        className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-mono text-ink-dim"
      >
        <Minus className="h-3 w-3" />
        new
      </span>
    );
  }
  if (pct === 0) {
    return (
      <span
        title={title}
        className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-mono text-ink-dim"
      >
        <Minus className="h-3 w-3" />
        flat
      </span>
    );
  }
  const up = pct > 0;
  return (
    <span
      title={title}
      className={
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-mono tabular-nums " +
        (up ? "bg-mint/15 text-mint" : "bg-coral/15 text-coral")
      }
    >
      {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {up ? "+" : ""}
      {pct.toFixed(1)}%
    </span>
  );
}
