"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * While an order is in `?new=1 + status=pending`, gently re-fetch the
 * RSC payload so the page flips to "Paid" once the Stripe webhook
 * lands — without a full meta-refresh page reload (jarring, loses
 * scroll, re-renders TopNav etc.). Polls every 10s and gives up
 * after 5 minutes (Stripe webhook retries cover beyond that).
 */
export function PendingOrderRefresher() {
  const router = useRouter();
  useEffect(() => {
    const POLL_MS = 10_000;
    const GIVE_UP_AT = Date.now() + 5 * 60_000;
    const id = window.setInterval(() => {
      if (Date.now() > GIVE_UP_AT) {
        window.clearInterval(id);
        return;
      }
      router.refresh();
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [router]);
  return null;
}
