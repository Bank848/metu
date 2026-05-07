"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * While an order is in `?new=1 + status=pending`, gently re-fetch the
 * RSC payload every 10s. After 15s without a flip, also POST
 * /orders/:id/sync to ask the server to re-pull the PI from Stripe
 * directly — covers the case where the Stripe webhook is slow or
 * dropped. Gives up the whole loop after 5 min.
 */
export function PendingOrderRefresher({ orderId }: { orderId: number }) {
  const router = useRouter();
  useEffect(() => {
    const POLL_MS = 10_000;
    const SYNC_AFTER_MS = 15_000;
    const GIVE_UP_AT = Date.now() + 5 * 60_000;
    const startedAt = Date.now();
    let syncInFlight = false;
    let syncDone = false;

    const id = window.setInterval(async () => {
      if (Date.now() > GIVE_UP_AT) {
        window.clearInterval(id);
        return;
      }
      // After ~15s of waiting, kick a one-shot sync. If it succeeds,
      // the next router.refresh() picks up the flipped status.
      if (
        !syncDone &&
        !syncInFlight &&
        Date.now() - startedAt >= SYNC_AFTER_MS
      ) {
        syncInFlight = true;
        try {
          const res = await fetch(`/api/orders/${orderId}/sync`, {
            method: "POST",
            credentials: "include",
          });
          if (res.ok) syncDone = true;
        } catch {
          // Best-effort — keep polling on failure.
        } finally {
          syncInFlight = false;
        }
      }
      router.refresh();
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [router, orderId]);
  return null;
}
