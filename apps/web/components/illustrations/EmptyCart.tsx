import { cn } from "@/lib/utils";

/**
 * Hand-rolled empty-cart mark for `<EmptyState>`.
 *
 * Design intent (per docs/design-system.md §7): replace the generic
 * lucide bag in the cart empty-state with something that doesn't read
 * as "AI startup default 2021." We keep it tiny — pure SVG, no
 * dependencies, ~120 lines of geometry — and let `currentColor` carry
 * the tint so consumers can switch between `text-mint`, `text-coral`,
 * or `text-metu-yellow` without editing this file.
 *
 * The composition: a tilted shopping basket (geometric, mid-century
 * crate vibe rather than the slick mall-cart silhouette) with a
 * floating sparkle to the upper-right. The basket is intentionally
 * *empty inside* — that emptiness IS the message. Two sub-tones via
 * opacity so the mark has depth without needing a second colour.
 */
export function EmptyCart({
  className,
  title = "Empty cart",
}: {
  className?: string;
  title?: string;
}) {
  return (
    <svg
      viewBox="0 0 160 160"
      role="img"
      aria-label={title}
      className={cn("h-32 w-32", className)}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>{title}</title>

      {/* Soft halo behind the basket — pure currentColor at low alpha
          so it reads as ambient warmth, not a hard ring. */}
      <circle cx="80" cy="86" r="44" fill="currentColor" opacity="0.08" />

      {/* Basket body — a flared trapezoid on a 3-degree tilt. The tilt
          is the difference between "drawn by a designer" and "exported
          from a free icon set." Keep it. */}
      <g transform="rotate(-4 80 90)">
        <path
          d="M44 70 H116 L108 116 Q107 122 101 122 H59 Q53 122 52 116 Z"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinejoin="round"
          opacity="0.95"
        />

        {/* Vertical weave lines — six of them, evenly spaced, just
            short enough that the basket reads as woven without going
            full hatching. */}
        <line x1="58"  y1="74" x2="56"  y2="118" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
        <line x1="68"  y1="74" x2="67"  y2="119" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
        <line x1="80"  y1="74" x2="80"  y2="120" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
        <line x1="92"  y1="74" x2="93"  y2="119" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
        <line x1="102" y1="74" x2="104" y2="118" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />

        {/* Top rim — slightly bolder so the silhouette reads at
            thumbnail size. */}
        <path
          d="M40 70 H120"
          stroke="currentColor"
          strokeWidth="3.5"
          strokeLinecap="round"
        />

        {/* Handles — two arcs that loop up from the rim. */}
        <path
          d="M58 70 Q60 48 80 48 Q100 48 102 70"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
          opacity="0.85"
        />
      </g>

      {/* Floating sparkle — tiny four-point star, top-right. Positioned
          off the basket so it doesn't crowd the silhouette. */}
      <g transform="translate(122 38)">
        <path
          d="M0 -8 L2 -2 L8 0 L2 2 L0 8 L-2 2 L-8 0 L-2 -2 Z"
          fill="currentColor"
          opacity="0.9"
        />
      </g>

      {/* Second, smaller sparkle for compositional rhythm. */}
      <g transform="translate(34 50)">
        <path
          d="M0 -4 L1 -1 L4 0 L1 1 L0 4 L-1 1 L-4 0 L-1 -1 Z"
          fill="currentColor"
          opacity="0.6"
        />
      </g>

      {/* Ground line — short dash beneath the basket, gives gravity. */}
      <path
        d="M48 132 H112"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="2 6"
        opacity="0.35"
      />
    </svg>
  );
}
