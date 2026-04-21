"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { RotateCcw, Trash2 } from "lucide-react";

export function TransactionActions({
  transactionId,
  type,
  buyerName,
}: {
  transactionId: number;
  type: string;
  buyerName: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<"refund" | "delete" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refund() {
    if (!window.confirm(`Refund TX #${transactionId} for ${buyerName}? Linked orders will be marked refunded and a new refund transaction will be recorded.`)) return;
    setError(null);
    setBusy("refund");
    try {
      const res = await fetch(`/api/admin/transactions/${transactionId}/refund`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.message ?? "Failed to refund");
        setBusy(null);
        return;
      }
      router.refresh();
    } catch {
      setError("Network error");
    }
    setBusy(null);
  }

  async function remove() {
    if (!window.confirm(`Delete TX #${transactionId}? Audit trail will lose this row permanently.`)) return;
    setError(null);
    setBusy("delete");
    try {
      const res = await fetch(`/api/admin/transactions/${transactionId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.message ?? "Failed to delete");
        setBusy(null);
        return;
      }
      router.refresh();
    } catch {
      setError("Network error");
    }
    setBusy(null);
  }

  return (
    <div className="flex items-center gap-1.5">
      {type === "purchase" && (
        <button
          type="button"
          onClick={refund}
          disabled={busy !== null}
          title="Refund this purchase"
          className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 hover:border-metu-yellow/40 hover:text-metu-yellow px-2.5 py-1 text-[11px] font-semibold text-ink-secondary transition disabled:opacity-50"
        >
          <RotateCcw className="h-3 w-3" />
          {busy === "refund" ? "…" : "Refund"}
        </button>
      )}
      <button
        type="button"
        onClick={remove}
        disabled={busy !== null}
        title="Delete transaction record"
        className="rounded-full p-1.5 text-ink-dim hover:text-metu-red hover:bg-white/5 disabled:opacity-30"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
      {error && <span className="text-[10px] text-red-400 ml-1 max-w-[140px] truncate" title={error}>{error}</span>}
    </div>
  );
}
