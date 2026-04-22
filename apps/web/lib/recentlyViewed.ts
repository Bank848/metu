"use client";

/**
 * Tiny client-only history of products the user has opened. Persisted to
 * `localStorage` so it survives reloads but never hits the server (no
 * tracking PII; works without auth).
 *
 * Cap at 12 entries so the strip on /browse stays scannable.
 */

const KEY = "metu-recent";
const MAX = 12;

export function recordVisit(productId: number): void {
  if (typeof window === "undefined") return;
  try {
    const ids = readIds();
    const next = [productId, ...ids.filter((id) => id !== productId)].slice(0, MAX);
    localStorage.setItem(KEY, JSON.stringify(next));
    // Broadcast so the strip re-hydrates without a navigation.
    window.dispatchEvent(new CustomEvent("metu-recent-change", { detail: next }));
  } catch {
    /* private mode / quota — silent fail */
  }
}

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

export function clear(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(KEY);
    window.dispatchEvent(new CustomEvent("metu-recent-change", { detail: [] }));
  } catch {
    /* swallow */
  }
}
