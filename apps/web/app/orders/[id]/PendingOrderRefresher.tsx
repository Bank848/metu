"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Stage = "verifying" | "syncing" | "polling" | "confirmed";

/**
 * While an order is `?new=1 + status=pending`, fire an immediate
 * Stripe sync then poll a tiny GET /orders/:id/status endpoint every
 * 1.5s. The moment the server-side flips to paid, trigger ONE full
 * router.refresh() so the page flips to the confirmed receipt UI.
 * Surfaces a progress chip so the buyer sees what's happening.
 */
export function PendingOrderRefresher({ orderId }: { orderId: number }) {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("verifying");

  useEffect(() => {
    let cancelled = false;
    const POLL_MS = 1_500;
    const GIVE_UP_AT = Date.now() + 3 * 60_000;

    async function checkStatus(): Promise<boolean> {
      try {
        const res = await fetch(`/api/orders/${orderId}/status`, {
          credentials: "include",
          cache: "no-store",
        });
        if (!res.ok) return false;
        const data = (await res.json()) as { status?: string };
        if (data.status === "paid" || data.status === "fulfilled") {
          if (!cancelled) {
            setStage("confirmed");
            router.refresh();
          }
          return true;
        }
      } catch {
        /* network blip — keep polling */
      }
      return false;
    }

    (async () => {
      // Step 1: probe — maybe the webhook already landed.
      if (await checkStatus()) return;
      if (cancelled) return;

      // Step 2: ask the server to pull the PI from Stripe directly.
      setStage("syncing");
      try {
        await fetch(`/api/orders/${orderId}/sync`, {
          method: "POST",
          credentials: "include",
        });
      } catch {
        /* fall through to polling */
      }
      if (await checkStatus()) return;
      if (cancelled) return;

      // Step 3: tight 1.5s poll for the rare case where the PI is
      // still propagating. Stops as soon as status flips.
      setStage("polling");
      const id = window.setInterval(async () => {
        if (cancelled || Date.now() > GIVE_UP_AT) {
          window.clearInterval(id);
          return;
        }
        if (await checkStatus()) {
          window.clearInterval(id);
        }
      }, POLL_MS);
    })();

    return () => {
      cancelled = true;
    };
  }, [router, orderId]);

  const label =
    stage === "verifying"
      ? "Checking with Stripe…"
      : stage === "syncing"
        ? "Confirming your payment…"
        : stage === "polling"
          ? "Almost there — finalising the order…"
          : "Order confirmed!";
  return (
    <p className="text-xs text-ink-dim mt-2 text-center">
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-metu-yellow mr-1.5 animate-pulse" />
      {label}
    </p>
  );
}
