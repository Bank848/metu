"use client";
import { useEffect, useRef, useState } from "react";

// Count-up animation that re-fires every time the slide becomes active
// in the kiosk loop. Unlike the legacy IntersectionObserver counter that
// only fired once, this one resets when `active` toggles back to true so
// the hero numbers feel alive on every loop.
export function LiveCounter({
  target,
  active,
  duration = 1100,
  formatter,
}: {
  target: number;
  active: boolean;
  duration?: number;
  formatter?: (n: number) => string;
}) {
  const [value, setValue] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!active) return;
    setValue(0);
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(eased * target));
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [active, target, duration]);

  return (
    <span className="tabular-nums">
      {formatter ? formatter(value) : value.toLocaleString()}
    </span>
  );
}
