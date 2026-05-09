import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  subtitle,
  action,
  eyebrow,
  className,
}: {

  title: ReactNode;
  subtitle?: string;
  action?: ReactNode;
  eyebrow?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "surface-editorial relative mb-8 rounded-none px-1 py-1",
        "flex flex-col gap-4 md:flex-row md:items-end md:justify-between md:gap-6",
        className,
      )}
    >
      <div className="min-w-0">
        {eyebrow && (
          <div className="mb-2 inline-flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.18em] text-mint">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-mint" />
            {eyebrow}
          </div>
        )}
        <h1 className="font-black tracking-tight scale-y-[0.95] text-3xl md:text-4xl text-white">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-3 text-ink-secondary text-base max-w-2xl">{subtitle}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
