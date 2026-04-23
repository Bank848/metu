import { cn } from "@/lib/utils";

/**
 * Hand-rolled "no search results" mark for `<EmptyState>`.
 *
 * Composition: a magnifying glass at a confident angle, with three
 * tiny dots inside the lens (the "we looked but found nothing" beat).
 * Two arc-flecks above the handle suggest motion / wobble — the lens
 * just *finished* looking.
 *
 * Purely currentColor so the parent can tint with `text-coral`,
 * `text-mint`, etc. Sized at 128×128 by default; pair with
 * `EmptyState`'s 20-unit icon slot or override via `className`.
 */
export function NoResults({
  className,
  title = "No results",
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

      {/* Halo behind the lens — softens the silhouette without a
          second colour. Same trick as EmptyCart for visual rhyme. */}
      <circle cx="74" cy="72" r="46" fill="currentColor" opacity="0.08" />

      {/* Magnifying glass — rotated 12° so it doesn't sit dead-flat. */}
      <g transform="rotate(-12 80 80)">
        {/* Lens ring */}
        <circle
          cx="74"
          cy="72"
          r="32"
          stroke="currentColor"
          strokeWidth="4"
        />
        {/* Inner highlight — a thin arc on the upper-left to imply
            glass without heavy shading. */}
        <path
          d="M54 60 Q58 48 70 44"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.55"
        />

        {/* Three "nothing here" dots inside the lens — the visual
            metaphor for an empty result list. Slight horizontal
            offset so they don't feel rubber-stamped. */}
        <circle cx="62" cy="76" r="2.6" fill="currentColor" opacity="0.85" />
        <circle cx="74" cy="76" r="2.6" fill="currentColor" opacity="0.85" />
        <circle cx="86" cy="76" r="2.6" fill="currentColor" opacity="0.85" />

        {/* Handle — tilted, slightly thicker at the tip for weight. */}
        <path
          d="M97 95 L122 120"
          stroke="currentColor"
          strokeWidth="6"
          strokeLinecap="round"
        />
        {/* Grip cap on the handle — tiny perpendicular tick. */}
        <path
          d="M118 122 L128 116"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          opacity="0.7"
        />
      </g>

      {/* Two motion-flecks above the lens — the "just searched" wobble. */}
      <path
        d="M30 38 Q38 32 46 38"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.55"
        fill="none"
      />
      <path
        d="M22 52 Q26 48 32 52"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.4"
        fill="none"
      />

      {/* Ground line — same dashed shadow trick as EmptyCart. */}
      <path
        d="M40 138 H120"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="2 6"
        opacity="0.3"
      />
    </svg>
  );
}
