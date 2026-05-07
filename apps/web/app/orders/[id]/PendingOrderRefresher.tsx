"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * While an order is `?new=1 + status=pending`, fire one immediate
 * Stripe sync (covers the slow-webhook case in <2s) then poll every
 * 4s for an RSC re-fetch in case the webhook lands later. Gives up
 * after 3 minutes.
 */
export function PendingOrderRefresher({ orderId }: { orderId: number }) {
  const router = useRouter();
  useEffect(() => {
    let cancelled = false;
    const POLL_MS = 4_000;
    const GIVE_UP_AT = Date.now() + 3 * 60_000;

    // Immediate sync: the user just paid and Stripe almost always has
    // the PI in `succeeded` by the time the browser redirects back.
    // Calling /sync directly skips the webhook-delivery wait and lets
    // the page flip to Paid in ~1-2s.
    (async () => {
      try {
        const res = await fetch(`/api/orders/${orderId}/sync`, {
          method: "POST",
          credentials: "include",
        });
        if (res.ok && !cancelled) router.refresh();
      } catch {
        /* fall through to polling */
      }
    })();

    const id = window.setInterval(() => {
      if (cancelled || Date.now() > GIVE_UP_AT) {
        window.clearInterval(id);
        return;
      }
      router.refresh();
    }, POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [router, orderId]);
  return null;
}
