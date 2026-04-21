import { cn } from "@/lib/utils";

export function DotGrid({
  className,
  opacity = 40,
}: {
  className?: string;
  opacity?: number;
}) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 bg-dot-grid bg-dot-grid",
        className,
      )}
      style={{ opacity: opacity / 100 }}
    />
  );
}

export function StarField({
  className,
  density = "md",
}: {
  className?: string;
  density?: "sm" | "md" | "high";
}) {
  const layer = density === "high" ? "stars-high-density" : density === "sm" ? "stars-sm" : "stars-md";
  return (
    <div aria-hidden className={cn("pointer-events-none absolute inset-0", className)}>
      <div className={cn("absolute inset-0", layer)} />
      <div className="absolute inset-0 bg-dot-grid bg-dot-grid opacity-[0.05]" />
    </div>
  );
}
