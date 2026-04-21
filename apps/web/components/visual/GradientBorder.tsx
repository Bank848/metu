import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Wraps children in an animated gold conic-gradient border.
 * Uses CSS only (no framer-motion) — the spin keyframe is in tailwind.config.
 */
export function GradientBorder({
  children,
  className,
  rounded = "rounded-2xl",
  active = true,
}: {
  children: ReactNode;
  className?: string;
  rounded?: string;
  /** Set false to keep the layout but hide the border (for unfocused state). */
  active?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative",
        rounded,
        active && "gradient-border",
        className,
      )}
    >
      {children}
    </div>
  );
}
