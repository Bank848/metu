import { forwardRef } from "react";
import { cn } from "@/lib/utils";

/**
 * Phase 9 / Wave 2 — non-glass card primitive.
 *
 * Wraps the `surface-flat` class from Wave 1 (see `globals.css:172`) so
 * other components can opt into a flat surface without re-deriving the
 * padding + radius rules each time. Pair with `lift-on-hover` (also
 * Wave 1) for hover states. See docs/design-system.md §5.
 *
 * Deliberately tiny — no animation, no built-in hover, no children
 * polymorphism. If a consumer needs anchor or button semantics they
 * compose this inside their own element. We only own the surface.
 */
type Padding = "none" | "sm" | "md" | "lg";
type Radius = "lg" | "xl" | "2xl";
type Tone = "flat" | "accent" | "accent-coral";

const padMap: Record<Padding, string> = {
  none: "",
  sm:   "p-3",
  md:   "p-4",
  lg:   "p-5 md:p-6",
};

const radiusMap: Record<Radius, string> = {
  lg:  "rounded-lg",
  xl:  "rounded-xl",
  "2xl": "rounded-2xl",
};

const toneMap: Record<Tone, string> = {
  flat:           "surface-flat",
  accent:         "surface-accent",
  "accent-coral": "surface-accent surface-accent--coral",
};

export interface FlatCardProps extends React.HTMLAttributes<HTMLDivElement> {
  padding?: Padding;
  radius?: Radius;
  tone?: Tone;
  /** Adds the Wave-1 `lift-on-hover` class — opt-in. */
  interactive?: boolean;
}

export const FlatCard = forwardRef<HTMLDivElement, FlatCardProps>(
  (
    { padding = "md", radius = "xl", tone = "flat", interactive, className, ...rest },
    ref,
  ) => {
    return (
      <div
        ref={ref}
        className={cn(
          toneMap[tone],
          radiusMap[radius],
          padMap[padding],
          interactive && "lift-on-hover hover:shadow-raised",
          className,
        )}
        {...rest}
      />
    );
  },
);
FlatCard.displayName = "FlatCard";
