import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { EmptyCart } from "./illustrations/EmptyCart";
import { NoResults } from "./illustrations/NoResults";

/**
 * Generic empty-state card.
 *
 * Wave-2 rebrand:
 *  - New `variant` prop swaps the centered lucide-icon-in-a-circle for
 *    one of the hand-rolled SVG illustrations under
 *    `components/illustrations/`. The two highest-traffic empty
 *    contexts (cart-empty, no-results) get bespoke marks tinted with
 *    the new mint / coral accents — see docs/design-system.md §7.
 *  - Legacy callers that pass `icon={…}` keep the old circle treatment
 *    so the cart, browse, favorites, etc. pages render identically
 *    until they opt into the new variants.
 *  - Card surface switched from `vibrant-mesh` (heavy gold radials) to
 *    `surface-editorial` (Wave-1 flat panel). The illustration carries
 *    the colour now; the surface stays out of its way.
 *
 * Variants:
 *   - `cart`       → <EmptyCart />, mint tint
 *   - `noResults`  → <NoResults />, coral tint
 *   - `default`    → fall back to the icon-in-a-circle (legacy)
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
        // surface-editorial + soft inset → no harsh border, no dashed
        // frame. The dashed frame was part of the AI-tell ("every
        // empty state looks like a dropzone").
        "surface-editorial relative overflow-hidden rounded-3xl p-10 text-center md:p-14",
        className,
      )}
    >
      <div className="relative mx-auto flex max-w-xl flex-col items-center gap-5">
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
        <h3 className="font-display text-2xl font-bold text-white">{title}</h3>
        {description && (
          <p className="max-w-md text-sm text-ink-secondary leading-relaxed">
            {description}
          </p>
        )}
        {action && <div className="mt-2">{action}</div>}
      </div>
    </div>
  );
}
