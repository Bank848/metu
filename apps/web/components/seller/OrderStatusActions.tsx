"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CheckCircle2, XCircle, RotateCcw } from "lucide-react";

type Status = "pending" | "paid" | "fulfilled" | "cancelled" | "refunded";

/**
 * Seller-side order actions. Shown on /seller/orders rows.
 *
 * Transitions allowed from `paid`:  fulfilled · cancelled · refunded
 * Transitions allowed from `fulfilled`:  refunded (e.g. buyer reports a
 *   problem after delivery)
 * Everything else shows nothing — the Badge already communicates the
 * final state.
 */
export function OrderStatusActions({
  orderId,
  currentStatus,
}: {
  orderId: number;
  currentStatus: Status;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<null | "fulfilled" | "cancelled" | "refunded">(null);
  const [error, setError] = useState<string | null>(null);

  async function patch(next: "fulfilled" | "cancelled") {
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

  async function refund() {
    if (
      !window.confirm(
        `Refund this order? The full total is returned to the buyer and a refund transaction is recorded. This is used for out-of-stock / can't-fulfil situations.`,
      )
    ) {
      return;
    }
    setError(null);
    setBusy("refunded");
    try {
      const res = await fetch(`/api/seller/orders/${orderId}/refund`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.message ?? "Refund failed");
        setBusy(null);
        return;
      }
      router.refresh();
    } catch {
      setError("Network error");
    }
    setBusy(null);
  }

  const canFulfilOrCancel = currentStatus === "paid";
  const canRefund = currentStatus === "paid" || currentStatus === "fulfilled";

  if (!canFulfilOrCancel && !canRefund) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 mt-3">
      {canFulfilOrCancel && (
        <>
          <button
            type="button"
            onClick={() => patch("fulfilled")}
            disabled={busy !== null}
            className="inline-flex items-center gap-1 rounded-full border border-green-400/30 bg-green-400/10 hover:border-green-400/50 hover:bg-green-400/15 px-3 py-1 text-[11px] font-semibold text-green-300 transition disabled:opacity-50"
          >
            <CheckCircle2 className="h-3 w-3" />
            {busy === "fulfilled" ? "Marking…" : "Mark fulfilled"}
          </button>
          <button
            type="button"
            onClick={() => patch("cancelled")}
            disabled={busy !== null}
            className="inline-flex items-center gap-1 rounded-full border border-metu-red/30 bg-metu-red/10 hover:border-metu-red/60 hover:bg-metu-red/20 px-3 py-1 text-[11px] font-semibold text-red-300 transition disabled:opacity-50"
          >
            <XCircle className="h-3 w-3" />
            {busy === "cancelled" ? "Cancelling…" : "Cancel"}
          </button>
        </>
      )}
      {canRefund && (
        <button
          type="button"
          onClick={refund}
          disabled={busy !== null}
          className="inline-flex items-center gap-1 rounded-full border border-purple-400/30 bg-purple-400/10 hover:border-purple-400/60 hover:bg-purple-400/20 px-3 py-1 text-[11px] font-semibold text-purple-300 transition disabled:opacity-50"
          title="Refund this order — e.g. out of stock, can't fulfil"
        >
          <RotateCcw className="h-3 w-3" />
          {busy === "refunded" ? "Refunding…" : "Refund"}
        </button>
      )}
      {error && <span className="text-[10px] text-red-400 max-w-[160px] truncate" title={error}>{error}</span>}
    </div>
  );
}
