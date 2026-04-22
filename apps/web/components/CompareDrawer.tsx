"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Scale, X } from "lucide-react";
import { COMPARE_MAX, clear, readIds, toggle } from "@/lib/compareList";

/**
 * Floating bottom-right pill that shows up whenever the user has at
 * least one product staged for comparison. Clicking the chip count
 * navigates to /compare; the X clears the staging.
 */
export function CompareDrawer() {
  const [ids, setIds] = useState<number[]>([]);

  useEffect(() => {
    setIds(readIds());
    const handler = (e: Event) => setIds((e as CustomEvent).detail as number[]);
    window.addEventListener("metu-compare-change", handler);
    return () => window.removeEventListener("metu-compare-change", handler);
  }, []);

  if (ids.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-40 inline-flex items-center gap-2 rounded-full glass-morphism-strong border border-metu-yellow/40 px-4 py-2 shadow-pop">
      <Scale className="h-4 w-4 text-metu-yellow" />
      <Link href="/compare" className="text-sm font-semibold text-white hover:text-metu-yellow">
        Compare {ids.length} of {COMPARE_MAX}
      </Link>
      <button
        type="button"
        onClick={() => clear()}
        aria-label="Clear comparison"
        className="ml-1 text-ink-dim hover:text-metu-red"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

/** Inline compare toggle button — slot into ProductCard / product detail. */
export function CompareToggle({ productId }: { productId: number }) {
  const [active, setActive] = useState(false);
  useEffect(() => {
    const sync = () => setActive(readIds().includes(productId));
    sync();
    const handler = () => sync();
    window.addEventListener("metu-compare-change", handler);
    return () => window.removeEventListener("metu-compare-change", handler);
  }, [productId]);

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle(productId);
      }}
      title={active ? "Remove from comparison" : "Add to comparison"}
      aria-label={active ? "Remove from comparison" : "Add to comparison"}
      className={
        "inline-flex h-8 w-8 items-center justify-center rounded-full border backdrop-blur transition " +
        (active
          ? "bg-metu-yellow/30 border-metu-yellow text-metu-yellow"
          : "bg-surface-1/70 border-white/15 text-white/80 hover:text-metu-yellow hover:border-metu-yellow/50")
      }
    >
      <Scale className="h-3.5 w-3.5" />
    </button>
  );
}
