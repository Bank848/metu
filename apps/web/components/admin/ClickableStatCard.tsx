"use client";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowUpRight } from "lucide-react";
import { MiniSparkline } from "./MiniSparkline";

// Drill-in variant of StatCard with optional sparkline + click-through
// link. The bare StatCard (components/StatCard) stays for screens
// where we don't want the surface to read as clickable; this wrapper
// adds the affordances when /admin's KPIs deep-link into filter pages.

type Tone = "default" | "highlight" | "zero";

interface Props {
  href: string;
  icon: LucideIcon;
  label: string;
  value: string | number;
  /** Optional 7-day series for an inline sparkline. */
  sparkline?: number[];
  /** Sparkline tint. Falls back to the card's accent. */
  sparkColor?: string;
  /** Hover tooltip on the value (e.g. exact ฿ for a compact format). */
  valueTooltip?: string;
  tone?: Tone;
}

export function ClickableStatCard({
  href,
  icon: Icon,
  label,
  value,
  sparkline,
  sparkColor,
  valueTooltip,
  tone = "default",
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
            <Icon className="h-3.5 w-3.5" />
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

      {sparkline && sparkline.length > 0 && (
        <div
          className="mt-3"
          style={{ color: sparkColor ?? "rgb(244 192 79)" }}
        >
          <MiniSparkline data={sparkline} height={28} width={140} />
        </div>
      )}
    </Link>
  );
}
