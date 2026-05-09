import { forwardRef } from "react";
import { cn } from "@/lib/utils";

/**
 * Non-glass card primitive over the `surface-flat` class. Pair with
 * `lift-on-hover` for hover states. Deliberately small — no animation,
 * no polymorphism; compose for anchor/button semantics.
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
  /** Adds the `lift-on-hover` class — opt-in. */
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
