"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Phase 40 - scroll-triggered fade-in wrapper.
 *
 * Uses IntersectionObserver to flip a CSS class once the element
 * scrolls into view, so each feature section can animate in
 * progressively as the presenter scrolls. No framer-motion / extra
 * deps - pure Tailwind classes + 30 LOC of vanilla browser API.
 *
 * Props:
 *   delay  - tailwind delay class ("delay-100" / "delay-200" / ...)
 *   from   - "up" (default) | "left" | "right" | "scale"
 *   once   - default true ; set false to re-animate on every scroll-in
 */
export function Reveal({
  children,
  delay = "",
  from = "up",
  once = true,
  className = "",
}: {
  children: ReactNode;
  delay?: string;
  from?: "up" | "left" | "right" | "scale";
  once?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setShown(true);
            if (once) io.unobserve(entry.target);
          } else if (!once) {
            setShown(false);
          }
        }
      },
      { threshold: 0.15 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [once]);

  const start: Record<typeof from, string> = {
    up: "translate-y-8 opacity-0",
    left: "-translate-x-8 opacity-0",
    right: "translate-x-8 opacity-0",
    scale: "scale-95 opacity-0",
  };
  const end = "translate-y-0 translate-x-0 scale-100 opacity-100";

  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out ${delay} ${shown ? end : start[from]} ${className}`}
    >
      {children}
    </div>
  );
}
