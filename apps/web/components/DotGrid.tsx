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

export function StarField({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn("pointer-events-none absolute inset-0", className)}
    >
      <div className="absolute inset-0 bg-star-field" />
      <div className="absolute inset-0 bg-dot-grid bg-dot-grid opacity-[0.07]" />
    </div>
  );
}
