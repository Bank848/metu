import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

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
