"use client";
import { useState } from "react";
import { Loader2, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { TotpStepUpModal } from "@/components/TotpStepUpModal";
import { ConfirmDialog } from "@/components/forms/ConfirmDialog";

/**
 * admin refund trigger. Hits /api/admin/orders/:id/refund
 * which calls Stripe + writes an audit row. The server enforces a
 * 15-minute TOTP step-up window via requireRecent2FA(15).
 * when the API returns 403 TotpStepUpRequired we pop the
 * step-up modal, capture the fresh code, then auto-retry the refund
 * so the admin doesn't have to confirm the irreversible action twice.
 * Confirm step uses <ConfirmDialog> (matches every other destructive
 * surface — seller order status, review delete, etc.) instead of the
 * native window.confirm() which jarringly broke the design system.
 */
export function RefundButton({ orderId }: { orderId: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [stepUpOpen, setStepUpOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  async function callRefund(): Promise<"ok" | "needs-totp" | "error"> {
    const res = await fetch(`/api/admin/orders/${orderId}/refund`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({}),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setMsg("Refunded.");
      router.refresh();
      return "ok";
    }
    if (res.status === 403 && data?.error === "TotpStepUpRequired") {
      return "needs-totp";
    }
    setMsg(data?.message ?? data?.error ?? "Refund failed");
    return "error";
  }

  function openConfirm() {
    setMsg(null);
    setConfirmOpen(true);
  }

  async function onConfirm() {
    setConfirmOpen(false);
    setBusy(true);
    try {
      const outcome = await callRefund();
      if (outcome === "needs-totp") {
        // Don't drop busy here — the step-up modal owns the next step.
        setStepUpOpen(true);
        return;
      }
    } catch {
      setMsg("Network error");
    } finally {
      // Step-up flow keeps busy=true until success/cancel below.
      if (!stepUpOpen) setBusy(false);
    }
  }

  async function onStepUpSuccess() {
    setStepUpOpen(false);
    setMsg(null);
    try {
      await callRefund();
    } catch {
      setMsg("Network error");
    } finally {
      setBusy(false);
    }
  }

  function onStepUpClose() {
    setStepUpOpen(false);
    setBusy(false);
    setMsg("Refund cancelled — re-enter your 2FA code to retry.");
  }

  return (
    <div>
      <Button type="button" variant="ghost" disabled={busy} onClick={openConfirm}>
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
        {busy ? "Refunding…" : "Refund"}
      </Button>
      {msg && <p className="text-xs text-amber-300 mt-1">{msg}</p>}
      <ConfirmDialog
        open={confirmOpen}
        tone="destructive"
        title={`Refund order #${orderId}?`}
        body="This refunds the full charge via Stripe and is irreversible. The buyer will be notified."
        confirmLabel="Refund"
        onConfirm={onConfirm}
        onCancel={() => setConfirmOpen(false)}
      />
      <TotpStepUpModal
        open={stepUpOpen}
        onSuccess={onStepUpSuccess}
        onClose={onStepUpClose}
      />
    </div>
  );
}
