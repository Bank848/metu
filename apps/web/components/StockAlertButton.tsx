"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Bell, BellRing } from "lucide-react";

/**
 * "Notify me when in stock" toggle. Auth-gated — bounces guests through
 * /login. Server-side handler at /api/stock-alerts/[productItemId].
 */
export function StockAlertButton({
  productItemId,
  initialSubscribed,
}: {
  productItemId: number;
  initialSubscribed: boolean;
}) {
  const router = useRouter();
  const [subscribed, setSubscribed] = useState(initialSubscribed);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    if (busy) return;
    setBusy(true);
    const next = !subscribed;
    setSubscribed(next); // optimistic
    try {
      const res = await fetch(`/api/stock-alerts/${productItemId}`, {
        method: next ? "POST" : "DELETE",
        credentials: "include",
      });
      if (res.status === 401) {
        const here = typeof window !== "undefined" ? window.location.pathname : "/";
        router.push(`/login?next=${encodeURIComponent(here)}`);
        setSubscribed(!next);
        return;
      }
      if (!res.ok) setSubscribed(!next);
    } catch {
      setSubscribed(!next);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      className={
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 " +
        (subscribed
          ? "bg-metu-yellow/15 border-metu-yellow/40 text-metu-yellow"
          : "bg-white/5 border-white/10 text-ink-secondary hover:border-metu-yellow/40 hover:text-metu-yellow")
      }
    >
      {subscribed ? <BellRing className="h-3.5 w-3.5" /> : <Bell className="h-3.5 w-3.5" />}
      {subscribed ? "We'll notify you" : "Notify me when in stock"}
    </button>
  );
}
