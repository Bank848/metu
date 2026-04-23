import Link from "next/link";
import { cn } from "@/lib/utils";
import { BrandMark } from "./illustrations/BrandMark";

export function Logo({
  className,
  size = "md",
  asLink = true,
  showMark = true,
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
  asLink?: boolean;
  /**
   * Render the small `<BrandMark />` glyph beside the wordmark. Default
   * on for headers / footers; flip off for ultra-compact slots (mobile
   * row collapses, sticky sub-navs, badges) where the M-mark would
   * otherwise crowd a 24px-tall row.
   */
  showMark?: boolean;
}) {
  const sizes = {
    sm: "text-xl",
    md: "text-2xl",
    lg: "text-4xl",
  }[size];

  // Mark scales with the wordmark — same vertical rhythm at every size.
  const markSizes = {
    sm: "h-5 w-5",
    md: "h-6 w-6",
    lg: "h-9 w-9",
  }[size];

  const inner = (
    <span
      className={cn(
        // gap-1.5 (not gap-2 or gap-3) deliberately — the mark sits
        // close to the wordmark so the pair reads as one logotype, not
        // two stacked icons. Asymmetric vs the cluster spacing later.
        "group inline-flex items-center gap-1.5 font-display font-extrabold tracking-tight text-white select-none transition",
        sizes,
        className,
      )}
    >
      {showMark && (
        <BrandMark
          className={cn(
            // Mark inherits gold via text-metu-yellow rather than the
            // wordmark's white — it's the brand glyph, not the type.
            "text-metu-yellow shrink-0 transition-transform duration-300 group-hover:rotate-[-6deg]",
            markSizes,
          )}
        />
      )}
      <span className="leading-none group-hover:text-light-sweep transition-all">
        METU
      </span>
    </span>
  );

  return asLink ? <Link href="/">{inner}</Link> : inner;
}
