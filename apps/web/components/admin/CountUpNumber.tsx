"use client";
import { useEffect, useRef, useState } from "react";
import { coins, coinsCompact, thbToCoins } from "@/lib/format";

// Animates a number from 0 → final value over ~700ms on mount.
// Used by the /admin Overview KPI cards so the digits feel "alive"
// when the page loads. Falls back to the static value immediately if
// the user has reduce-motion enabled (no rAF loop runs).
//
// Why not a CSS counter()? Counters don't accept a tween from JS, and
// `@property --n` is still patchy across browsers. A 30-line rAF loop
// is the smallest dependency-free approach.
//
// IMPORTANT: this is a client component called from server components
// (e.g. /admin/page.tsx). Next.js refuses to serialise function
// references across the RSC boundary, so we can't accept a `format:
// (n) => string` prop directly — that's how the digest:363486359
// crash landed in production. Instead we accept a small string enum
// of formatter names, and the client picks the actual function from
// the FORMATTERS table below.

export type CountUpFormat = "int" | "compact-coins";

interface Props {
  /** The end value (not formatted — pass a raw number). For
      compact-coins this is the coin amount (post-thbToCoins), for int
      it's whatever number you want comma-separated. */
  value: number;
  /** Formatter name. Defaults to "int". String enum (not function) so
      Next.js can serialise this prop across the RSC boundary into the
      "use client" boundary. */
  format?: CountUpFormat;
  /** Animation duration in ms. Default 700. */
  durationMs?: number;
  /** Optional className applied to the wrapper span. */
  className?: string;
  /** Optional title for the wrapper span (hover tooltip). */
  title?: string;
}

const FORMATTERS: Record<CountUpFormat, (n: number) => string> = {
  // Comma-separated integer (e.g. 1,234) — matches `.toLocaleString()`
  // output that the static value used before the count-up tween.
  "int": (n: number) => Math.round(n).toLocaleString(),
  // Compact coin display for the GMV card (e.g. ฿49.1K). Caller passes
  // the coin amount; this just dispatches to the existing
  // `coinsCompact` helper so the in-flight formatting is identical
  // to the SSR fallback.
  "compact-coins": (n: number) => coinsCompact(n),
};

// easeOutCubic — quick start, soft landing. Matches the rest of the
// data-viz easing (cubic-bezier(0.22, 1, 0.36, 1)).
const ease = (t: number) => 1 - Math.pow(1 - t, 3);

export function CountUpNumber({
  value,
  format = "int",
  durationMs = 700,
  className,
  title,
}: Props) {
  const [display, setDisplay] = useState(0);
  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    // Honour reduce-motion: snap to the final value, skip the rAF loop.
    if (typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setDisplay(value);
      return;
    }
    startRef.current = null;
    const tick = (ts: number) => {
      if (startRef.current == null) startRef.current = ts;
      const elapsed = ts - startRef.current;
      const t = Math.min(1, elapsed / durationMs);
      setDisplay(value * ease(t));
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setDisplay(value);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [value, durationMs]);

  const fmt = FORMATTERS[format] ?? FORMATTERS.int;
  return (
    <span className={className} title={title}>
      {fmt(display)}
    </span>
  );
}

// Re-exports for callers that want to avoid the named-import dance.
export { coins, coinsCompact, thbToCoins };
