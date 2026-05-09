import type { ReactNode, ElementType } from "react";
import { cn } from "@/lib/utils";

type Variant = "flat" | "accent" | "editorial";
type As = "section" | "div";

const variantSurface: Record<Variant, string> = {
  // Wave-1 surface tokens — never raw Tailwind palette colours.
  flat:      "surface-flat",
  accent:    "surface-accent",
  editorial: "surface-editorial",
};

export interface FormSectionProps {
  title?: string;
  description?: string;
  variant?: Variant;
  as?: As;
  className?: string;
  children: ReactNode;
}

export function FormSection({
  title,
  description,
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
              <h2 className="font-display font-bold text-xl text-metu-yellow">
                {title}
              </h2>
            </div>
          )}
          {description && (
            <p className="text-sm text-ink-dim pt-2 leading-relaxed">
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
