"use client";
import { useEffect, useState } from "react";

// Shared cart-count store. CartNavIcon and MobileBottomNav both
// subscribe to one polling loop instead of fetching independently.
// Refetches on `cart:update` and window focus.

let cachedCount = 0;
const subscribers = new Set<(n: number) => void>();
let pollTimer: number | null = null;
let inFlight: Promise<number> | null = null;

function emit(n: number) {
  cachedCount = n;
  for (const s of subscribers) s(n);
}

async function refresh(): Promise<number> {
  // Coalesce concurrent calls so simultaneous mounts don't race.
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
