"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";

type Status = "pending" | "paid" | "fulfilled" | "cancelled" | "refunded";

/**
 * Seller-side order actions. Shown on /seller/orders rows. Only two
 * transitions are allowed: paid → fulfilled, or paid → cancelled. The
 * API enforces the same rules — buttons here just gate the UI.
 */
export function OrderStatusActions({
  orderId,
  currentStatus,
}: {
  orderId: number;
  currentStatus: Status;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<null | "fulfilled" | "cancelled">(null);
  const [error, setError] = useState<string | null>(null);

  async function setStatus(next: "fulfilled" | "cancelled") {
    const verb = next === "fulfilled" ? "mark this order as fulfilled" : "cancel this order";
    if (!window.confirm(`Are you sure you want to ${verb}?`)) return;
    setError(null);
    setBusy(next);
    try {
      const res = await fetch(`/api/seller/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.message ?? "Update failed");
        setBusy(null);
        return;
      }
      router.refresh();
    } catch {
      setError("Network error");
    }
    setBusy(null);
  }

  // Only live on orders that are currently paid. Otherwise show nothing —
  // the Badge already communicates the final state.
  if (currentStatus !== "paid") return null;

  return (
    <div className="flex items-center gap-2 mt-3">
      <button
        type="button"
        onClick={() => setStatus("fulfilled")}
        disabled={busy !== null}
        className="inline-flex items-center gap-1 rounded-full border border-green-400/30 bg-green-400/10 hover:border-green-400/50 hover:bg-green-400/15 px-3 py-1 text-[11px] font-semibold text-green-300 transition disabled:opacity-50"
      >
        <CheckCircle2 className="h-3 w-3" />
        {busy === "fulfilled" ? "Marking…" : "Mark fulfilled"}
      </button>
      <button
        type="button"
        onClick={() => setStatus("cancelled")}
        disabled={busy !== null}
        className="inline-flex items-center gap-1 rounded-full border border-metu-red/30 bg-metu-red/10 hover:border-metu-red/60 hover:bg-metu-red/20 px-3 py-1 text-[11px] font-semibold text-red-300 transition disabled:opacity-50"
      >
        <XCircle className="h-3 w-3" />
        {busy === "cancelled" ? "Cancelling…" : "Cancel"}
      </button>
      {error && <span className="text-[10px] text-red-400 max-w-[160px] truncate" title={error}>{error}</span>}
    </div>
  );
}
