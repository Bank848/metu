import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Stat card with three variants:
 *   - `default`   — label top, icon top-right, value below
 *   - `highlight` — icon-left next to value; use once per row for the lead stat
 *   - `zero`      — muted, for empty / no-data tiles
 */
type Variant = "default" | "highlight" | "zero";

export function StatCard({
  label,
  value,
  // Optional override for the hover tooltip. Useful when `value` has
  // been compacted (e.g. moneyCompact() → "฿45.6K") and we still want
  // sellers/admins to read the precise figure on hover. Falls back to
  // String(value) when omitted.
  valueTooltip,
  icon: Icon,
  trend,
  accent,
  variant = "default",
  className,
}: {
  label: string;
  value: string | number;
  valueTooltip?: string;
  icon?: LucideIcon;
  trend?: { value: number; label?: string };
  accent?: "yellow" | "charcoal" | "none";
  variant?: Variant;
  className?: string;
}) {
  // `accent` is the legacy hook; `variant` takes precedence.
  const baseSurface = (() => {
    if (variant === "highlight") {
      return "surface-accent border";
    }
    if (variant === "zero") {
      return "surface-flat opacity-70";
    }
    if (accent === "yellow") {
      return "border bg-gradient-to-br from-metu-yellow/12 to-metu-gold/5 border-metu-yellow/35";
    }
    return "surface-flat";
  })();

  // Highlight uses a gentler ramp so large compact figures (e.g. ฿45.6K)
  // fit inside the quarter-viewport slot. tabular-nums prevents jitter.
  const valueClass = cn(
    "font-display font-extrabold tabular-nums",
    variant === "zero" ? "text-ink-dim" : "text-white",
    variant === "highlight"
      ? "text-xl sm:text-2xl md:text-3xl xl:text-4xl"
      : "text-3xl md:text-4xl",
  );

  const iconColor =
    variant === "zero"
      ? "text-ink-mute"
      : variant === "highlight"
        ? "text-mint"
        : accent === "yellow"
          ? "text-metu-yellow"
          : "text-ink-dim";

  // Highlight variant rearranges to icon-left. Default + zero keep
  // the original "label top + icon top-right + value below" stack.
  if (variant === "highlight" && Icon) {
    return (
      <div
        className={cn(
          "rounded-2xl p-5 flex items-center gap-4 shadow-flat lift-on-hover hover:shadow-raised",
          baseSurface,
          className,
        )}
      >
        <div className="shrink-0 grid place-items-center h-14 w-14 rounded-xl bg-mint/15 border border-mint/30">
          <Icon className={cn("h-6 w-6", iconColor)} strokeWidth={2} />
        </div>
        <div className="min-w-0 flex-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-dim">
            {label}
          </span>
          {/* truncate so oversized numbers don't push the layout sideways;
              `title` surfaces the full value on hover. */}
          <div className={cn(valueClass, "min-w-0 truncate")} title={valueTooltip ?? String(value)}>
            {typeof value === "number" ? value.toLocaleString() : value}
          </div>
          {trend && (
            <div className="flex items-center gap-1 text-xs font-medium text-ink-secondary mt-0.5">
              <span className={trend.value >= 0 ? "text-mint" : "text-coral"}>
                {trend.value >= 0 ? "↗" : "↘"} {Math.abs(trend.value)}%
              </span>
              {trend.label && <span>{trend.label}</span>}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-2xl p-5 flex flex-col gap-2 shadow-flat lift-on-hover hover:shadow-raised",
        baseSurface,
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-dim">
          {label}
        </span>
        {Icon && <Icon className={cn("h-4 w-4", iconColor)} strokeWidth={2} />}
      </div>
      <div className={cn(valueClass, "min-w-0 truncate")} title={valueTooltip ?? String(value)}>
        {typeof value === "number" ? value.toLocaleString() : value}
      </div>
      {trend && (
        <div className="flex items-center gap-1 text-xs font-medium text-ink-secondary">
          <span className={trend.value >= 0 ? "text-mint" : "text-coral"}>
            {trend.value >= 0 ? "↗" : "↘"} {Math.abs(trend.value)}%
          </span>
          {trend.label && <span>{trend.label}</span>}
        </div>
      )}
    </div>
  );
}
