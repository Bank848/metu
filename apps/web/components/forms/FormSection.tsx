import type { ReactNode, ElementType } from "react";
import { cn } from "@/lib/utils";

/**
 * Section wrapper for authoring forms — owns the surface, radius,
 * padding, and title-bar accent. Pure layout primitive (no form state);
 * compose with input primitives like TextInput in the `children` slot.
 */
type Accent = "default" | "mint" | "coral";
type Variant = "flat" | "accent" | "editorial";
type As = "section" | "div";

const accentBar: Record<Accent, string> = {
  default: "bg-metu-yellow",
  mint:    "bg-mint",
  coral:   "bg-coral",
};

const variantSurface: Record<Variant, string> = {
  flat:      "surface-flat",
  accent:    "surface-accent",
  editorial: "surface-editorial",
};

export interface FormSectionProps {
  title?: string;
  description?: string;
  accent?: Accent;
  variant?: Variant;
  as?: As;
  className?: string;
  children: ReactNode;
}

export function FormSection({
  title,
  description,
  accent = "default",
  variant = "flat",
  as = "section",
  className,
  children,
}: FormSectionProps) {
  const Tag = as as ElementType;
  return (
    <Tag className={cn("space-y-3", className)}>
      {(title || description) && (
        <header className="space-y-1">
          {title && (
            <div className="flex items-center gap-2.5">
              <span
                aria-hidden
                className={cn(
                  // Coloured stripe to the left of the title.
                  "inline-block h-4 w-1 rounded-full",
                  accentBar[accent],
                )}
              />
              <h2 className="font-display font-bold text-lg text-white">
                {title}
              </h2>
            </div>
          )}
          {description && (
            <p className="text-xs text-ink-dim leading-relaxed pl-3.5">
              {description}
            </p>
          )}
        </header>
      )}
      <div
        className={cn(
          variantSurface[variant],
          "rounded-2xl p-5 md:p-6 space-y-4",
        )}
      >
        {children}
      </div>
    </Tag>
  );
}
