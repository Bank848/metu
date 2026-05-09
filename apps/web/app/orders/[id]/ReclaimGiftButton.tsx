"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Undo2 } from "lucide-react";

// Buyer's escape hatch when "this is a gift" was ticked by mistake.
// Server enforces strict policy: blocked once recipient has opened
// the gift link (any order.gift.viewed audit row for the orderId).
export function ReclaimGiftButton({ orderId }: { orderId: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function handle() {
    if (busy) return;
    const ok = window.confirm(
      "Reclaim this gift for yourself? Your recipient will not be able to claim it anymore. This can't be undone.",
    );
    if (!ok) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/orders/${orderId}/reclaim-gift`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({} as { message?: string; error?: string }));
        if (data?.error === "RecipientAlreadyViewed") {
          setMsg(
            "Your recipient already opened this gift. Contact the seller for a refund instead.",
          );
        } else {
          setMsg(data?.message ?? data?.error ?? "Couldn't reclaim this gift right now.");
        }
        return;
      }
      router.refresh();
    } catch {
      setMsg("Network error — try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={handle}
        disabled={busy}
        className="inline-flex items-center gap-2 rounded-full ring-1 ring-line bg-space-900 text-ink-secondary px-4 py-2 text-xs font-semibold hover:ring-coral/40 hover:text-white transition disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Undo2 className="h-3.5 w-3.5" />}
        {busy ? "Reclaiming…" : "Was this a mistake? Reclaim for myself"}
      </button>
      {msg && (
        <p role="alert" className="mt-2 text-xs text-coral">
          {msg}
        </p>
      )}
    </div>
  );
}
