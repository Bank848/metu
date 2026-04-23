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
  icon: Icon,
  trend,
  accent,
  variant = "default",
  className,
}: {
  label: string;
  value: string | number;
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

  const valueClass = cn(
    "font-display font-extrabold",
    variant === "zero" ? "text-ink-dim" : "text-white",
    variant === "highlight" ? "text-3xl md:text-5xl" : "text-3xl md:text-4xl",
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
          <div className={valueClass}>
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
      <div className={valueClass}>
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
