"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ArrowDownToLine } from "lucide-react";

/**
 * Phase 33B — manual payout trigger. Stripe TH Connect schedules
 * payouts weekly by default ; this button lets the seller pull funds
 * to their bank on demand (useful for the demo and for real sellers
 * who want their balance now).
 *
 * Disabled when availableSatang <= 0 because Stripe rejects empty
 * payouts. The amount field defaults to the full available balance
 * but the seller can edit it down (e.g. leave a buffer for refunds).
 */
export function RequestPayoutButton({ availableSatang }: { availableSatang: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const availableBaht = availableSatang / 100;

  async function request() {
    const input = prompt(
      `How much (in baht) to pay out? Available: ฿${availableBaht.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      String(availableBaht),
    );
    if (input === null) return; // cancelled
    const amountBaht = Number(input);
    if (!Number.isFinite(amountBaht) || amountBaht <= 0) {
      setMsg("Enter a positive amount in baht.");
      return;
    }

    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/seller/stripe/payout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ amountBaht }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(data?.message ?? data?.error ?? "Payout failed");
        return;
      }
      setMsg(`Payout requested ✓ (${data.payoutId} — status ${data.status})`);
      router.refresh();
    } catch {
      setMsg("Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={request}
        disabled={busy || availableSatang <= 0}
        className="inline-flex items-center gap-2 rounded-full bg-mint text-space-950 px-4 py-2 text-xs font-bold hover:bg-mint/90 disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowDownToLine className="h-3.5 w-3.5" />}
        {busy ? "Requesting…" : "Request payout"}
      </button>
      {msg && <p className="mt-2 text-xs text-amber-300">{msg}</p>}
    </div>
  );
}
