"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { RotateCcw, Trash2 } from "lucide-react";
import { ActionRow, type ActionRowItem } from "./ActionRow";

/**
 * Phase 10 / Step 3b — repackaged as an `<ActionRow>` dropdown.
 *
 * Both API calls (POST /refund and DELETE) are identical to the prior
 * implementation — only the trigger surface changed. The `type` prop
 * still gates Refund: it only appears for purchases.
 */
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

  const actions: ActionRowItem[] = [
    ...(type === "purchase"
      ? [
          {
            label: "Refund purchase",
            icon: RotateCcw,
            tone: "primary" as const,
            onClick: refund,
            confirm: `Refund TX #${transactionId} for ${buyerName}? Linked orders will be marked refunded and a new refund transaction will be recorded.`,
            disabled: busy !== null,
          },
        ]
      : []),
    {
      label: "Delete transaction",
      icon: Trash2,
      tone: "destructive",
      onClick: remove,
      confirm: `Delete TX #${transactionId}? Audit trail will lose this row permanently.`,
      disabled: busy !== null,
    },
  ];

  return (
    <div className="inline-flex flex-col items-end gap-1">
      <ActionRow actions={actions} ariaLabel={`Actions for transaction #${transactionId}`} />
      {error && (
        <span className="text-[10px] text-coral max-w-[140px] truncate" title={error}>
          {error}
        </span>
      )}
    </div>
  );
}
