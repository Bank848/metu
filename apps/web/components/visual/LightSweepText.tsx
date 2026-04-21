import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Yellow text with an animated diagonal "light sweep" highlight that
 * loops every ~3 seconds. Use for hero headlines on the brand word.
 *
 * Implementation: linear-gradient that includes a brief lighter band,
 * stretched 200%, scrolling left-to-right via tailwind `animate-shimmer`.
 */
export function LightSweepText({
  children,
  className,
  as: Tag = "span",
}: {
  children: ReactNode;
  className?: string;
  as?: keyof JSX.IntrinsicElements;
}) {
  const Component = Tag as any;
  return (
    <Component className={cn("text-light-sweep inline-block", className)}>
      {children}
    </Component>
  );
}
