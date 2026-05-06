"use client";
import { useEffect, useState } from "react";

// Shared cart-count store. Without this, both CartNavIcon (top nav)
// and MobileBottomNav (bottom nav on phone) independently polled
// `/api/cart` every 60 seconds AND on every cart:update event. That
// meant every render of a page with both navs fired 2 simultaneous
// requests; on slow connections we measured /api/cart taking
// 1.2-1.3s — duplicated.
//
// This hook centralises the fetch:
//   1. Module-level `count` + listener set so all subscribers share
//      one piece of state.
//   2. The first subscriber kicks off the polling timer + window
//      event listeners; subsequent subscribers reuse the same loop.
//   3. When the last subscriber unmounts, the timer stops.
//   4. On cart:update or window focus, refetch immediately (same
//      behaviour as before).
//
// Result: 1 request per polling tick instead of 2 (or N).

let cachedCount = 0;
const subscribers = new Set<(n: number) => void>();
let pollTimer: number | null = null;
let inFlight: Promise<number> | null = null;

function emit(n: number) {
  cachedCount = n;
  for (const s of subscribers) s(n);
}

async function refresh(): Promise<number> {
  // Coalesce concurrent calls — if a fetch is already in flight, the
  // duplicate caller awaits the same promise. Prevents 2 simultaneous
  // useEffect mounts from racing.
  if (inFlight) return inFlight;
  inFlight = (async () => {
    try {
      const res = await fetch("/api/cart", { credentials: "include" });
      if (!res.ok) return cachedCount;
      const data = await res.json();
      const lines: Array<{ quantity: number }> = Array.isArray(data?.items) ? data.items : [];
      const next = lines.reduce((sum, l) => sum + (Number(l.quantity) || 0), 0);
      emit(next);
      return next;
    } catch {
      return cachedCount;
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

function startPolling() {
  if (pollTimer != null || typeof window === "undefined") return;
  // Initial fetch + 60s tick — same cadence as before.
  refresh();
  pollTimer = window.setInterval(refresh, 60_000);
  window.addEventListener("cart:update", refresh);
  window.addEventListener("focus", refresh);
}

function stopPolling() {
  if (pollTimer == null || typeof window === "undefined") return;
  window.clearInterval(pollTimer);
  window.removeEventListener("cart:update", refresh);
  window.removeEventListener("focus", refresh);
  pollTimer = null;
}

export function useCartCount(): number {
  const [count, setCount] = useState(cachedCount);
  useEffect(() => {
    subscribers.add(setCount);
    if (subscribers.size === 1) startPolling();
    // Sync to current value in case a sibling already populated it.
    setCount(cachedCount);
    return () => {
      subscribers.delete(setCount);
      if (subscribers.size === 0) stopPolling();
    };
  }, []);
  return count;
}
