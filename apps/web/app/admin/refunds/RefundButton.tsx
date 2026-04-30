"use client";
import { useState } from "react";
import { Loader2, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

/**
 * Phase 27 — admin refund trigger. Hits /api/admin/orders/:id/refund
 * which calls Stripe + writes an audit row. The server enforces a
 * 15-minute TOTP step-up window — when expired, the API returns 403
 * `TotpStepUpRequired` and we surface a hint to the admin.
 */
export function RefundButton({ orderId }: { orderId: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function refund() {
    if (!confirm(`Refund order #${orderId} in full? This is irreversible.`)) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data?.error === "TotpStepUpRequired") {
          setMsg("Re-enter your 2FA code first (TOTP step-up has expired).");
        } else {
          setMsg(data?.message ?? data?.error ?? "Refund failed");
        }
        return;
      }
      setMsg("Refunded.");
      router.refresh();
    } catch {
      setMsg("Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <Button type="button" variant="ghost" disabled={busy} onClick={refund}>
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
        {busy ? "Refunding…" : "Refund"}
      </Button>
      {msg && <p className="text-xs text-amber-300 mt-1">{msg}</p>}
    </div>
  );
}
