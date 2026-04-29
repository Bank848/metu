"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { ArrowDownToLine, Check, Loader2, Upload, X, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { coins } from "@/lib/format";

/**
 * Phase 17.3 — top-up modal.
 *
 * Three-step inline flow (no router push, all client-side state):
 *   1. PICK   — buyer chooses an amount (preset chips or custom).
 *               POST /wallet/topup → returns the QR payload.
 *   2. PAY    — render the QR + "I paid" button. Buyer scans with
 *               banking app, pays, gets a slip back from the bank.
 *   3. UPLOAD — buyer uploads the slip image. POST /wallet/topup/:id/slip
 *               → server runs slip-QR auto-verify. On success the
 *               wallet is auto-credited; on failure the slip is
 *               queued for admin review.
 *
 * The modal stays open through all 3 steps so the buyer doesn't
 * lose context. Closing wipes the in-flight topup state (the row
 * itself stays in the DB as `pending`; admin can still approve it
 * later if the buyer DID actually pay — see /admin/topups).
 */

const PRESET_AMOUNTS = [50, 100, 200, 500, 1000];

type Step = "pick" | "pay" | "upload" | "result";

interface TopupResp {
  topupId: number;
  amountBaht: number;
  coinsExpected: number;
  promptpayPayload: string;
  promptpayId: string;
  expiresAt: string;
}

interface SlipResp {
  topupId: number;
  status: "pending" | "paid" | "rejected";
  autoApproved: boolean;
  rejectionReason?: string;
  balanceAfter?: number;
}

export function TopupModal({ walletEnabled }: { walletEnabled: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("pick");
  const [amount, setAmount] = useState<number>(100);
  const [customAmount, setCustomAmount] = useState<string>("");
  const [topup, setTopup] = useState<TopupResp | null>(null);
  const [slipDataUrl, setSlipDataUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SlipResp | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const effectiveAmount = customAmount ? Number(customAmount) || 0 : amount;
  const validAmount = effectiveAmount >= 20 && effectiveAmount <= 50_000;

  function reset() {
    setStep("pick");
    setTopup(null);
    setSlipDataUrl(null);
    setBusy(false);
    setError(null);
    setResult(null);
  }

  function close() {
    setOpen(false);
    reset();
    if (result?.autoApproved) router.refresh(); // refresh balance + ledger
  }

  // Lock body scroll while modal is open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  async function startTopup() {
    if (!validAmount) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/wallet/topup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountBaht: effectiveAmount }),
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.message || data?.error || "Could not start top-up");
        setBusy(false);
        return;
      }
      setTopup(data);
      setStep("pay");
      setBusy(false);
    } catch {
      setError("Network error");
      setBusy(false);
    }
  }

  async function onSlipPicked(file: File) {
    if (file.size > 1_500_000) {
      setError("Slip image must be smaller than 1.5 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setSlipDataUrl(String(reader.result));
    reader.onerror = () => setError("Failed to read the slip file.");
    reader.readAsDataURL(file);
  }

  async function submitSlip() {
    if (!topup || !slipDataUrl) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/wallet/topup/${topup.topupId}/slip`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slipImage: slipDataUrl }),
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.message || data?.error || "Slip submission failed");
        setBusy(false);
        return;
      }
      setResult(data);
      setStep("result");
      setBusy(false);
    } catch {
      setError("Network error");
      setBusy(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="primary"
        size="lg"
        onClick={() => setOpen(true)}
      >
        <ArrowDownToLine className="h-4 w-4" />
        Top up coins
      </Button>

      {!open ? null : (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Top up coins"
        >
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="absolute inset-0 bg-black/70 backdrop-blur-sm cursor-default"
          />
          <div className="relative w-full max-w-md rounded-2xl border border-line bg-space-900 shadow-floating overflow-hidden">
            <header className="flex items-center justify-between border-b border-line px-5 py-3">
              <div className="font-display font-bold text-white">
                {step === "pick" && "Top up coins"}
                {step === "pay" && "Scan + pay"}
                {step === "upload" && "Upload your slip"}
                {step === "result" && (result?.autoApproved ? "Top-up complete!" : "Submitted for review")}
              </div>
              <button
                type="button"
                onClick={close}
                aria-label="Close"
                className="rounded-full p-2 text-ink-secondary hover:bg-white/5 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="p-5">
              {!walletEnabled && step === "pick" && (
                <div className="mb-4 rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-100">
                  Demo mode: wallet is disabled, but you can still top up to test the flow. Coins won't be deducted at checkout.
                </div>
              )}

              {step === "pick" && (
                <>
                  <label className="block text-xs font-semibold text-ink-dim uppercase tracking-wider mb-2">
                    Amount (baht)
                  </label>
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    {PRESET_AMOUNTS.map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => {
                          setAmount(n);
                          setCustomAmount("");
                        }}
                        className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                          !customAmount && amount === n
                            ? "border-metu-yellow bg-metu-yellow/15 text-metu-yellow"
                            : "border-line text-ink-secondary hover:border-metu-yellow/40 hover:text-white"
                        }`}
                      >
                        ฿{n.toLocaleString()}
                      </button>
                    ))}
                  </div>
                  <input
                    type="number"
                    inputMode="numeric"
                    placeholder="Or custom amount"
                    value={customAmount}
                    onChange={(e) => setCustomAmount(e.target.value.replace(/[^0-9]/g, ""))}
                    min={20}
                    max={50_000}
                    className="w-full rounded-xl border border-line bg-surface-3 px-4 py-2.5 text-white focus:border-metu-yellow outline-none"
                  />
                  <div className="mt-3 flex items-center justify-between text-sm">
                    <span className="text-ink-dim">You'll get</span>
                    <span className="font-display font-bold text-mint tabular-nums">
                      {coins(effectiveAmount * 10)}
                    </span>
                  </div>
                  {error && (
                    <p role="alert" className="mt-3 text-sm text-red-400">{error}</p>
                  )}
                  <Button
                    type="button"
                    variant="primary"
                    size="lg"
                    className="w-full mt-4"
                    disabled={!validAmount || busy}
                    onClick={startTopup}
                  >
                    {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                    {busy ? "Generating QR…" : `Continue with ฿${effectiveAmount.toLocaleString()}`}
                  </Button>
                </>
              )}

              {step === "pay" && topup && (
                <>
                  <p className="text-sm text-ink-secondary mb-4">
                    Open your banking app, scan this QR, and confirm payment of{" "}
                    <span className="font-bold text-white">฿{topup.amountBaht.toLocaleString()}</span>.
                  </p>
                  <div className="mx-auto w-fit rounded-2xl bg-white p-5">
                    <QRCodeSVG value={topup.promptpayPayload} size={232} level="M" />
                  </div>
                  <div className="mt-3 text-center text-xs text-ink-dim">
                    Recipient: <span className="font-mono text-white">{topup.promptpayId}</span>
                  </div>
                  <Button
                    type="button"
                    variant="primary"
                    size="lg"
                    className="w-full mt-5"
                    onClick={() => setStep("upload")}
                  >
                    <Upload className="h-4 w-4" />
                    I paid — upload slip
                  </Button>
                  <button
                    type="button"
                    onClick={reset}
                    className="block mx-auto mt-3 text-xs text-ink-dim hover:text-metu-yellow"
                  >
                    ← Pick a different amount
                  </button>
                </>
              )}

              {step === "upload" && topup && (
                <>
                  <p className="text-sm text-ink-secondary mb-4">
                    Upload the slip you got from your banking app. We'll auto-verify the QR on the slip.
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) onSlipPicked(f);
                    }}
                    className="hidden"
                  />
                  {!slipDataUrl ? (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full rounded-2xl border-2 border-dashed border-line bg-space-950 p-8 text-center hover:border-metu-yellow/40 transition"
                    >
                      <Upload className="h-8 w-8 mx-auto text-ink-dim mb-2" />
                      <div className="text-sm text-ink-secondary">Tap to choose slip image</div>
                      <div className="text-xs text-ink-dim mt-1">PNG or JPG, max 1.5 MB</div>
                    </button>
                  ) : (
                    <div>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={slipDataUrl}
                        alt="Selected slip"
                        className="mx-auto max-h-72 rounded-xl border border-line"
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="block mx-auto mt-2 text-xs text-ink-dim hover:text-metu-yellow"
                      >
                        Choose a different image
                      </button>
                    </div>
                  )}
                  {error && (
                    <p role="alert" className="mt-3 text-sm text-red-400">{error}</p>
                  )}
                  <Button
                    type="button"
                    variant="primary"
                    size="lg"
                    className="w-full mt-5"
                    disabled={!slipDataUrl || busy}
                    onClick={submitSlip}
                  >
                    {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                    {busy ? "Verifying slip…" : "Submit slip"}
                  </Button>
                </>
              )}

              {step === "result" && result && (
                <>
                  {result.autoApproved ? (
                    <div className="text-center py-4">
                      <div className="mx-auto h-14 w-14 rounded-full bg-mint/20 flex items-center justify-center mb-3">
                        <Check className="h-7 w-7 text-mint" />
                      </div>
                      <div className="font-display text-xl font-bold text-white mb-1">
                        Slip verified!
                      </div>
                      <p className="text-sm text-ink-secondary">
                        {coins(topup?.coinsExpected ?? 0)} added to your wallet.
                        New balance: <span className="font-bold text-white">{coins(result.balanceAfter ?? 0)}</span>
                      </p>
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <div className="mx-auto h-14 w-14 rounded-full bg-amber-400/20 flex items-center justify-center mb-3">
                        <AlertTriangle className="h-7 w-7 text-amber-400" />
                      </div>
                      <div className="font-display text-xl font-bold text-white mb-1">
                        Submitted for admin review
                      </div>
                      <p className="text-sm text-ink-secondary mb-2">
                        Auto-verify couldn't confirm the slip:
                      </p>
                      <p className="text-xs text-amber-200 bg-amber-400/10 border border-amber-400/30 rounded-lg p-3 mb-3">
                        {result.rejectionReason}
                      </p>
                      <p className="text-xs text-ink-dim">
                        An admin will review and credit the coins manually if the slip is valid.
                      </p>
                    </div>
                  )}
                  <Button type="button" variant="primary" size="lg" className="w-full mt-4" onClick={close}>
                    Done
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
