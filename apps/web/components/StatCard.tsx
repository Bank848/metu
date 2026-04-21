import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  icon: Icon,
  trend,
  accent,
  className,
}: {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  trend?: { value: number; label?: string };
  accent?: "yellow" | "charcoal" | "none";
  className?: string;
}) {
  const accentClass = {
    yellow: "border-metu-yellow/35 bg-gradient-to-br from-metu-yellow/12 to-metu-gold/5",
    charcoal: "glass-morphism",
    none: "glass-morphism",
  }[accent ?? "none"];

  return (
    <div
      className={cn(
        "rounded-2xl border p-5 flex flex-col gap-2 transition-all hover:border-metu-yellow/50 hover:shadow-pop",
        accentClass,
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-dim">
          {label}
        </span>
        {Icon && <Icon className={cn("h-4 w-4", accent === "yellow" ? "text-metu-yellow" : "text-ink-dim")} strokeWidth={2} />}
      </div>
      <div className="font-display text-3xl md:text-4xl font-extrabold text-white">
        {typeof value === "number" ? value.toLocaleString() : value}
      </div>
      {trend && (
        <div className="flex items-center gap-1 text-xs font-medium text-ink-secondary">
          <span className={trend.value >= 0 ? "text-green-400" : "text-red-400"}>
            {trend.value >= 0 ? "↗" : "↘"} {Math.abs(trend.value)}%
          </span>
          {trend.label && <span>{trend.label}</span>}
        </div>
      )}
    </div>
  );
}
