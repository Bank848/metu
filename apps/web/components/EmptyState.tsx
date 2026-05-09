import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { EmptyCart } from "./illustrations/EmptyCart";
import { NoResults } from "./illustrations/NoResults";

/**
 * Generic empty-state card. The `variant` prop swaps the icon-in-circle
 * for a tinted illustration:
 *   - `cart`      → <EmptyCart />, mint
 *   - `noResults` → <NoResults />, coral
 *   - `default`   → icon-in-circle (legacy callers passing `icon={…}`)
 */
type Variant = "default" | "cart" | "noResults";

export function EmptyState({
  title,
  description,
  icon,
  action,
  variant = "default",
  className,
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  variant?: Variant;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "surface-editorial relative overflow-hidden rounded-3xl p-10 text-center md:p-14",
        className,
      )}
    >
      <div className="relative mx-auto flex max-w-xl flex-col items-center gap-5">
        {/* Stagger reveal: illustration → heading → description → action. */}
        <div
          className="animate-[stagger-rise_0.55s_cubic-bezier(0.22,1,0.36,1)_both]"
          style={{ animationDelay: "0ms" }}
        >
          {variant === "cart" ? (
            <EmptyCart className="h-32 w-32 text-mint" title={title} />
          ) : variant === "noResults" ? (
            <NoResults className="h-32 w-32 text-coral" title={title} />
          ) : (
            icon && (
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-metu-yellow/15 text-metu-yellow">
                {icon}
              </div>
            )
          )}
        </div>
        <h3
          className="font-display text-2xl font-bold text-white animate-[stagger-rise_0.55s_cubic-bezier(0.22,1,0.36,1)_both]"
          style={{ animationDelay: "120ms" }}
        >
          {title}
        </h3>
        {description && (
          <p
            className="max-w-md text-sm text-ink-secondary leading-relaxed animate-[stagger-rise_0.55s_cubic-bezier(0.22,1,0.36,1)_both]"
            style={{ animationDelay: "200ms" }}
          >
            {description}
          </p>
        )}
        {action && (
          <div
            className="mt-2 animate-[stagger-rise_0.55s_cubic-bezier(0.22,1,0.36,1)_both]"
            style={{ animationDelay: "280ms" }}
          >
            {action}
          </div>
        )}
      </div>
    </div>
  );
}
