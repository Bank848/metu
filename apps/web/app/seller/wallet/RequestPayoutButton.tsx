"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ArrowDownToLine, X } from "lucide-react";

/**
 * Manual payout trigger. Stripe TH Connect schedules payouts weekly
 * by default; this button lets the seller pull funds to their bank
 * on demand. Disabled when availableSatang <= 0 (Stripe rejects empty
 * payouts). Amount field defaults to full available balance, editable
 * down (leave a buffer for refunds). Replaced the prior native
 * window.prompt() with an in-app modal so the UI matches the rest of
 * the app and keyboard nav / focus trap work properly.
 */
export function RequestPayoutButton({ availableSatang }: { availableSatang: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");

  const availableBaht = availableSatang / 100;
  const inputRef = useRef<HTMLInputElement | null>(null);

  function openModal() {
    setMsg(null);
    setAmount(availableBaht.toFixed(2));
    setOpen(true);
  }

  function closeModal() {
    if (busy) return;
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => inputRef.current?.select(), 50);
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeModal();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const amountBaht = Number(amount);
    if (!Number.isFinite(amountBaht) || amountBaht <= 0) {
      setMsg("Enter a positive amount in baht.");
      return;
    }
    if (amountBaht > availableBaht) {
      setMsg(`Amount exceeds available balance (฿${availableBaht.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}).`);
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
      setOpen(false);
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
        onClick={openModal}
        disabled={busy || availableSatang <= 0}
        className="inline-flex items-center gap-2 rounded-full bg-mint text-space-950 px-4 py-2 text-xs font-bold hover:bg-mint/90 disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowDownToLine className="h-3.5 w-3.5" />}
        {busy ? "Requesting…" : "Request payout"}
      </button>
      {msg && !open && <p className="mt-2 text-xs text-amber-300">{msg}</p>}

      {open && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="payout-title"
          onClick={closeModal}
        >
          <form
            onSubmit={submit}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-2xl border border-line bg-space-900 p-5 shadow-2xl"
          >
            <div className="flex items-start justify-between mb-4">
              <h2 id="payout-title" className="text-base font-display font-bold text-white">
                Request payout
              </h2>
              <button
                type="button"
                onClick={closeModal}
                disabled={busy}
                className="text-ink-dim hover:text-white disabled:opacity-50"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs text-ink-secondary mb-2">
              Available balance: <span className="font-mono text-mint">฿{availableBaht.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </p>

            <label htmlFor="payout-amount" className="block text-xs font-medium text-ink-secondary mb-1.5">
              Amount (baht)
            </label>
            <input
              id="payout-amount"
              ref={inputRef}
              type="number"
              min="0.01"
              max={availableBaht}
              step="0.01"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={busy}
              className="w-full rounded-lg border border-line bg-space-950 px-3 py-2 text-sm font-mono text-white outline-none focus:border-mint disabled:opacity-50"
            />

            <p className="mt-2 text-xs text-ink-dim">
              Funds will arrive in your linked bank account within 1–2 business days (Stripe schedule).
            </p>

            {msg && <p className="mt-2 text-xs text-red-400">{msg}</p>}

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={closeModal}
                disabled={busy}
                className="rounded-full px-4 py-2 text-xs font-semibold text-ink-secondary hover:text-white disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy || amount === ""}
                className="inline-flex items-center gap-2 rounded-full bg-mint text-space-950 px-4 py-2 text-xs font-bold hover:bg-mint/90 disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowDownToLine className="h-3.5 w-3.5" />}
                {busy ? "Requesting…" : "Confirm payout"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
