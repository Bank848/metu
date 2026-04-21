import Link from "next/link";
import { cn } from "@/lib/utils";

export function Logo({
  className,
  size = "md",
  asLink = true,
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
  asLink?: boolean;
}) {
  const sizes = {
    sm: "text-xl",
    md: "text-2xl",
    lg: "text-4xl",
  }[size];

  const inner = (
    <span
      className={cn(
        "group inline-flex items-baseline font-display font-extrabold tracking-tight text-white select-none transition",
        sizes,
        className,
      )}
    >
      <span className="group-hover:text-light-sweep transition-all">METU</span>
    </span>
  );

  return asLink ? <Link href="/">{inner}</Link> : inner;
}
