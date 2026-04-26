"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CheckCircle2, XCircle, RotateCcw } from "lucide-react";
import { ConfirmDialog } from "@/components/forms/ConfirmDialog";

type Status = "pending" | "paid" | "fulfilled" | "cancelled" | "refunded";

// Phase 11 / F19 — pending confirm-dialog state. Each entry maps a
// transition kind to the human-readable copy shown in the modal body
// and the destructive tone (refund/cancel = destructive, fulfil =
// neutral). The handler reads back through this map on confirm so the
// dialog can drive every transition without three separate components.
type Pending =
  | { kind: "fulfilled"; title: string; body: string; confirmLabel: string }
  | { kind: "cancelled"; title: string; body: string; confirmLabel: string }
  | { kind: "refunded";  title: string; body: string; confirmLabel: string };

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
  const [pending, setPending] = useState<Pending | null>(null);

  async function patch(next: "fulfilled" | "cancelled") {
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

  // Open the in-page confirm modal — never call the action directly.
  function askPatch(next: "fulfilled" | "cancelled") {
    setPending(
      next === "fulfilled"
        ? {
            kind: "fulfilled",
            title: "Mark order as fulfilled?",
            body: "The buyer is notified that their order is on the way / available for download.",
            confirmLabel: "Mark fulfilled",
          }
        : {
            kind: "cancelled",
            title: "Cancel this order?",
            body: "The order moves to cancelled. The buyer keeps their payment record but the line is no longer pending fulfilment.",
            confirmLabel: "Cancel order",
          },
    );
  }

  function askRefund() {
    setPending({
      kind: "refunded",
      title: "Refund this order?",
      body: "The full total is returned to the buyer and a refund transaction is recorded. Use this for out-of-stock or can't-fulfil situations.",
      confirmLabel: "Refund order",
    });
  }

  function runPending() {
    const p = pending;
    setPending(null);
    if (!p) return;
    if (p.kind === "fulfilled" || p.kind === "cancelled") return patch(p.kind);
    if (p.kind === "refunded") return refund();
  }

  const canFulfilOrCancel = currentStatus === "paid";
  const canRefund = currentStatus === "paid" || currentStatus === "fulfilled";

  if (!canFulfilOrCancel && !canRefund) return null;

  // Phase 11 run #2 / F22 — pixel-position clicks on these action
  // buttons were failing in QA (only `button.click()` via devtools
  // triggered the dialog). Most likely cause: a transparent ancestor
  // (or a sibling growing on hover via the row-card transform) was
  // floating above the button's hit-box at the rendered coordinates.
  // We pin the action row to `relative z-10` and stop click propagation
  // so each button owns its rectangle outright. Belt-and-braces — the
  // change is purely defensive, no visual delta.
  return (
    <div className="relative z-10 flex flex-wrap items-center gap-2 mt-3">
      {canFulfilOrCancel && (
        <>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); askPatch("fulfilled"); }}
            disabled={busy !== null}
            className="relative z-10 inline-flex items-center gap-1 rounded-full border border-green-400/30 bg-green-400/10 hover:border-green-400/50 hover:bg-green-400/15 px-3 py-1 text-[11px] font-semibold text-green-300 transition disabled:opacity-50"
          >
            <CheckCircle2 className="h-3 w-3" />
            {busy === "fulfilled" ? "Marking…" : "Mark fulfilled"}
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); askPatch("cancelled"); }}
            disabled={busy !== null}
            className="relative z-10 inline-flex items-center gap-1 rounded-full border border-metu-red/30 bg-metu-red/10 hover:border-metu-red/60 hover:bg-metu-red/20 px-3 py-1 text-[11px] font-semibold text-red-300 transition disabled:opacity-50"
          >
            <XCircle className="h-3 w-3" />
            {busy === "cancelled" ? "Cancelling…" : "Cancel"}
          </button>
        </>
      )}
      {canRefund && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); askRefund(); }}
          disabled={busy !== null}
          className="relative z-10 inline-flex items-center gap-1 rounded-full border border-purple-400/30 bg-purple-400/10 hover:border-purple-400/60 hover:bg-purple-400/20 px-3 py-1 text-[11px] font-semibold text-purple-300 transition disabled:opacity-50"
          title="Refund this order — e.g. out of stock, can't fulfil"
        >
          <RotateCcw className="h-3 w-3" />
          {busy === "refunded" ? "Refunding…" : "Refund"}
        </button>
      )}
      {error && <span className="text-[10px] text-red-400 max-w-[160px] truncate" title={error}>{error}</span>}
      <ConfirmDialog
        open={pending !== null}
        title={pending?.title ?? ""}
        body={pending?.body}
        confirmLabel={pending?.confirmLabel ?? "Confirm"}
        // Cancel + refund are destructive register; "mark fulfilled" is a
        // forward / positive transition so it stays on the default tone.
        tone={pending && pending.kind !== "fulfilled" ? "destructive" : "default"}
        onConfirm={runPending}
        onCancel={() => setPending(null)}
      />
    </div>
  );
}
