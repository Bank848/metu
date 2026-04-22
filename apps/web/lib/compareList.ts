"use client";

/**
 * Tiny client-only "compare drawer" — caps at 3 productIds in
 * localStorage. Toggling a product fires `metu-compare-change` so the
 * floating bar (and any compare button) re-renders.
 */

const KEY = "metu-compare";
export const COMPARE_MAX = 3;

export function readIds(): number[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((n) => Number.isFinite(n)) : [];
  } catch {
    return [];
  }
}

export function toggle(productId: number): number[] {
  const ids = readIds();
  const next = ids.includes(productId)
    ? ids.filter((id) => id !== productId)
    : [...ids, productId].slice(-COMPARE_MAX);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent("metu-compare-change", { detail: next }));
  } catch {
    /* swallow */
  }
  return next;
}

export function clear(): void {
  try {
    localStorage.removeItem(KEY);
    window.dispatchEvent(new CustomEvent("metu-compare-change", { detail: [] }));
  } catch {
    /* swallow */
  }
}
