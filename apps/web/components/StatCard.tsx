import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Phase 9 / Wave 2 — broke the "4 identical glass tiles" rhythm called
 * out at design-system.md §1 row 8 + §10 row 6. The default variant
 * keeps backward-compat for every existing call site (admin/page,
 * seller/page, home page); two new variants let consumers introduce
 * asymmetry inside a row of cards:
 *
 *   - `highlight` — icon moves from the corner to the LEFT, sat next
 *     to the value. Use ONCE per row to call out the "lead" stat.
 *   - `zero`      — greyer / muted, signals "no data yet" so empty
 *     states stop reading as broken.
 *
 * Shadows pulled off the gold-coupled `shadow-pop` and onto the Wave-1
 * neutral elevation scale (`shadow-flat` / `shadow-raised`).
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
  // The `accent` prop is the legacy hook — `variant` is the new one.
  // `highlight` implies an accent surface (mint by default), so it
  // overrides the resolved background unless the caller pinned one.
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
    // `charcoal` + `none` — both legacy callers expect a glass-style
    // panel. We stay on `surface-flat` to align with the playbook
    // without breaking the visual contract (still a bordered card).
    return "surface-flat";
  })();

  // Phase 11.1 hotfix — large baht values (e.g. ฿1,234,567 at
  // font-display extrabold) were blowing past the highlight card's
  // ¼-viewport slot at md (text-5xl ≈ 48px × 10 chars ≈ 480px). Drop
  // the ramp to text-4xl on md and only restore text-5xl at xl where
  // the card has the room. tabular-nums keeps digits aligned so
  // multiple highlight cards don't dance.
  // Phase 11.2 — drop the HIGHLIGHT ramp one notch (was
  // text-2xl/sm:text-3xl/md:text-4xl/xl:text-5xl) per user feedback
  // "ให้มันตัวเล็กลง". Even with moneyCompact(), the headline number
  // sits in a ¼-viewport slot at md and looked oversized at text-4xl.
  // Default + zero variants keep their existing ramp (text-3xl/
  // md:text-4xl) so non-revenue cards across the app are untouched.
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
          {/* min-w-0 + truncate so an oversized number ellipses inside
              the card instead of pushing the layout sideways. The
              `title` attr surfaces the full value on hover for the
              edge case where ellipsis hides a digit. */}
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
