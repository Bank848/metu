import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  subtitle,
  action,
  className,
}: {
  // Accept ReactNode so callers can compose icons + badges + text inline
  // (the coupon-report header is one such caller).
  title: ReactNode;
  subtitle?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-end justify-between gap-6 mb-8", className)}>
      <div>
        <h1 className="font-display text-3xl md:text-4xl font-extrabold tracking-tight text-white">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-2 text-ink-secondary text-base max-w-2xl">{subtitle}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
