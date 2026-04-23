import type { ReactNode, ElementType } from "react";
import { cn } from "@/lib/utils";

/**
 * Phase 10 / Step 2 — section wrapper for authoring forms.
 *
 * Replaces the ad-hoc `rounded-2xl glass-morphism p-6 space-y-4` recipe
 * scattered across NewProductForm, EditProductForm, EditStoreForm, and
 * the upcoming coupon / admin forms. By centralising the surface,
 * radius, padding, and the title-bar accent here we get:
 *
 *   - one place to swap `glass-morphism` → `surface-flat` (per
 *     docs/design-system.md §5)
 *   - a consistent title bar with a coloured accent stripe — defaults to
 *     `metu-yellow`, opt into `mint` / `coral` for non-default sections
 *     (e.g. mint = "preview / live" sections, coral = "danger zone")
 *   - one source of truth for the `space-y-4` rhythm between fields
 *
 * The component does NOT own form state — it's a pure layout primitive.
 * Compose it with the input primitives (TextInput, etc.) inside the
 * `children` slot.
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
  // Wave-1 surface tokens — never raw Tailwind palette colours.
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
                  // 3px tall coloured stripe to the left of the title.
                  // Subtle but enough to mark sections at a glance —
                  // accent stripe replaces the heavy gold hairline that
                  // used to live on every card (see §9 don'ts).
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
          // 2xl matches the radius scale rule for "feature" surfaces;
          // forms read as a feature panel inside the page.
          "rounded-2xl p-5 md:p-6 space-y-4",
        )}
      >
        {children}
      </div>
    </Tag>
  );
}
