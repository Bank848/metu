import { cn } from "@/lib/utils";

/**
 * Tiny "M" brand glyph that pairs with the METU wordmark.
 *
 * Two strokes form a slightly squashed M with a coral spark crossing
 * the gap — the spark is the only mint/coral hit in the chrome and
 * earns the user's eye on the first paint. Sized small (24px square
 * by default) so it sits at-baseline next to the wordmark; consumers
 * may grow it via `className`.
 *
 * Pure currentColor + a single hard-coded coral hex for the spark so
 * the wordmark's `text-white` doesn't bleach the accent away. Keep it
 * to one accent — adding mint here would break the hierarchy.
 */
export function BrandMark({
  className,
  title = "METU mark",
}: {
  className?: string;
  title?: string;
}) {
  return (
    <svg
      viewBox="0 0 32 32"
      role="img"
      aria-label={title}
      className={cn("h-6 w-6", className)}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>{title}</title>

      {/* Left + right uprights of the M — two parallel strokes, gold
          (currentColor inherits from the wordmark or its parent so we
          stay in palette without hard-coding yellow). */}
      <path
        d="M5 26 V8"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M27 26 V8"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />

      {/* The valley — two diagonals meeting low-centre, leaving a
          small gap at the bottom for the spark to cross. */}
      <path
        d="M5 8 L15 20"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M27 8 L17 20"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />

      {/* Coral spark in the gap — the one accent moment. Hard-coded
          because the surrounding wordmark is `text-white` and we
          don't want the spark inheriting white. */}
      <circle cx="16" cy="22" r="2.4" fill="#FB7185" />
    </svg>
  );
}
