"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, Send, AlertCircle } from "lucide-react";
import { GlassButton } from "@/components/visual/GlassButton";

/**
 * Phase 20.2 — withdrawal request form.
 *
 * Live preview of fee + net payout. Server validates (Zod + balance
 * check + lockout guard) so client validation is purely UX hygiene.
 *
 * On success: pushes back to /seller/wallet so the seller sees the
 * new pending row in their queue.
 */
export function WithdrawalRequestForm({
  availableCoins,
  withdrawalFeePercent,
}: {
  availableCoins: number;
  withdrawalFeePercent: number;
}) {
  const router = useRouter();
  const [amount, setAmount] = useState<string>("");
  const [bankName, setBankName] = useState("");
  const [bankAccountNo, setBankAccountNo] = useState("");
  const [bankAccountName, setBankAccountName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const amountNum = Math.max(0, Math.floor(Number(amount) || 0));
  const feePercentBp = Math.round(withdrawalFeePercent * 100);
  const feeCoins = Math.floor((amountNum * feePercentBp) / 10000);
  const netCoins = amountNum - feeCoins;
  const netBaht = (netCoins / 10).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const valid =
    amountNum >= 100 &&
    amountNum <= availableCoins &&
    bankName.trim().length >= 2 &&
    /^[0-9]{10,12}$/.test(bankAccountNo.trim()) &&
    bankAccountName.trim().length >= 2;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/seller/withdrawals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          amountCoins: amountNum,
          bankName: bankName.trim(),
          bankAccountNo: bankAccountNo.trim(),
          bankAccountName: bankAccountName.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.message || data.error || "Failed to submit request");
        return;
      }
      router.push("/seller/wallet");
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="rounded-2xl border border-line bg-space-900 p-6 space-y-5 max-w-2xl">
      {error && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 flex items-start gap-2 text-sm text-red-200">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div>
        <label htmlFor="amount" className="block text-sm font-semibold text-white mb-1">
          Amount (coins)
        </label>
        <input
          id="amount"
          type="number"
          min={100}
          max={availableCoins}
          step={1}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="100"
          className="w-full max-w-xs rounded-xl border border-white/10 bg-surface-3 px-4 py-2.5 text-white font-mono focus:border-metu-yellow outline-none"
        />
        <p className="text-xs text-ink-dim mt-1">
          Min 100 coins (≈ ฿10) · Max {availableCoins.toLocaleString()} coins (your balance)
        </p>
      </div>

      {/* Live preview — hidden until amount is non-zero so the form
          doesn't leak default zero numbers when the seller hasn't
          typed yet. */}
      {amountNum > 0 && (
        <div className="rounded-xl border border-line bg-space-850 p-4 text-sm">
          <dl className="grid grid-cols-2 gap-y-1.5">
            <dt className="text-ink-dim">Coins requested</dt>
            <dd className="text-white text-right font-mono">{amountNum.toLocaleString()}</dd>
            <dt className="text-ink-dim">Fee ({withdrawalFeePercent}%)</dt>
            <dd className="text-coral text-right font-mono">−{feeCoins.toLocaleString()}</dd>
            <dt className="text-ink-dim border-t border-line pt-1.5 mt-1">Net coins</dt>
            <dd className="text-mint text-right font-mono border-t border-line pt-1.5 mt-1">{netCoins.toLocaleString()}</dd>
            <dt className="text-ink-dim">You'll receive</dt>
            <dd className="text-metu-yellow text-right font-display font-bold">฿{netBaht}</dd>
          </dl>
        </div>
      )}

      <div className="border-t border-line pt-5">
        <h3 className="font-display text-sm font-bold text-white mb-3">Bank details</h3>
        <div className="space-y-3">
          <div>
            <label htmlFor="bank-name" className="block text-xs font-semibold text-white mb-1">
              Bank name
            </label>
            <input
              id="bank-name"
              type="text"
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              placeholder="e.g. SCB, Kasikorn, Krungthai"
              maxLength={60}
              className="w-full rounded-xl border border-white/10 bg-surface-3 px-4 py-2.5 text-white focus:border-metu-yellow outline-none"
            />
          </div>
          <div>
            <label htmlFor="bank-account-no" className="block text-xs font-semibold text-white mb-1">
              Account number
            </label>
            <input
              id="bank-account-no"
              type="text"
              inputMode="numeric"
              value={bankAccountNo}
              onChange={(e) => setBankAccountNo(e.target.value.replace(/[^0-9]/g, ""))}
              placeholder="10–12 digits, no spaces"
              maxLength={12}
              className="w-full max-w-xs rounded-xl border border-white/10 bg-surface-3 px-4 py-2.5 text-white font-mono focus:border-metu-yellow outline-none"
            />
          </div>
          <div>
            <label htmlFor="bank-account-name" className="block text-xs font-semibold text-white mb-1">
              Account holder name
            </label>
            <input
              id="bank-account-name"
              type="text"
              value={bankAccountName}
              onChange={(e) => setBankAccountName(e.target.value)}
              placeholder="As printed on the passbook"
              maxLength={80}
              className="w-full rounded-xl border border-white/10 bg-surface-3 px-4 py-2.5 text-white focus:border-metu-yellow outline-none"
            />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 pt-2 border-t border-line">
        <GlassButton tone="gold" type="submit" disabled={busy || !valid}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {busy ? "Submitting…" : "Submit request"}
        </GlassButton>
        <p className="text-xs text-ink-dim">
          Coins are escrowed immediately. An admin reviews + transfers within 1–2 business days.
        </p>
      </div>
    </form>
  );
}
