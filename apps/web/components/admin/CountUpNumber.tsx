"use client";
import { useEffect, useRef, useState } from "react";

// Animates a number from 0 → final value over ~700ms on mount.
// Used by the /admin Overview KPI cards so the digits feel "alive"
// when the page loads. Falls back to the static value immediately if
// the user has reduce-motion enabled (no rAF loop runs).
//
// We only animate the numeric portion — `prefix` (e.g. "฿") and
// `suffix` are rendered statically around it, and the final string
// is run through the supplied `format` so the output looks identical
// to whatever the page used to render.
//
// Why not a CSS counter()? Counters don't accept a tween from JS, and
// `@property --n` is still patchy across browsers. A 30-line rAF loop
// is the smallest dependency-free approach.

interface Props {
  /** The end value (not formatted — pass a raw number). */
  value: number;
  /** Format the in-flight value to a display string. Default: comma-separated integer. */
  format?: (n: number) => string;
  /** Animation duration in ms. Default 700. */
  durationMs?: number;
  /** Optional className applied to the wrapper span. */
  className?: string;
  /** Optional title for the wrapper span (hover tooltip). */
  title?: string;
}

const DEFAULT_FORMAT = (n: number) => Math.round(n).toLocaleString();

// easeOutCubic — quick start, soft landing. Matches the rest of the
// data-viz easing (cubic-bezier(0.22, 1, 0.36, 1)).
const ease = (t: number) => 1 - Math.pow(1 - t, 3);

export function CountUpNumber({
  value,
  format = DEFAULT_FORMAT,
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

  return (
    <span className={className} title={title}>
      {format(display)}
    </span>
  );
}
