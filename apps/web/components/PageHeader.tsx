import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Page title row used at the top of most app pages. Optional `eyebrow`
 * adds a mono-uppercase editorial label above the title; a short coral
 * underline sits beneath it.
 */
export function PageHeader({
  title,
  subtitle,
  action,
  eyebrow,
  className,
}: {
  // Accept ReactNode so callers can compose icons + badges + text inline
  // (the coupon-report header is one such caller).
  title: ReactNode;
  subtitle?: string;
  action?: ReactNode;
  /**
   * Small editorial label rendered above the title — e.g. "Section
   * 02", "Cart", "Reports". Omit for plain pages.
   */
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
        <h1 className="font-display text-3xl md:text-4xl font-extrabold tracking-tight text-white">
          {title}
        </h1>
        {/* Coral underline */}
        <div
          aria-hidden
          className="mt-3 h-[3px] w-14 rounded-full bg-coral"
        />
        {subtitle && (
          <p className="mt-3 text-ink-secondary text-base max-w-2xl">{subtitle}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
