import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { DotGrid } from "./DotGrid";

export function EmptyState({
  title,
  description,
  icon,
  action,
  className,
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border-2 border-dashed border-line bg-space-900/60 p-12 text-center",
        className,
      )}
    >
      <DotGrid opacity={10} />
      <div className="relative flex flex-col items-center gap-4">
        {icon && (
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-brand-yellow/15 text-brand-yellow">
            {icon}
          </div>
        )}
        <h3 className="font-display text-xl font-bold text-white">{title}</h3>
        {description && (
          <p className="max-w-md text-sm text-ink-secondary">{description}</p>
        )}
        {action && <div className="mt-2">{action}</div>}
      </div>
    </div>
  );
}
