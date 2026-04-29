"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, CheckCircle2, XCircle, Upload, AlertCircle } from "lucide-react";
import { GlassButton } from "@/components/visual/GlassButton";

/**
 * Phase 20.2 — admin review actions on a pending withdrawal.
 *
 * Two paths:
 *   - Approve → upload bank-transfer slip image (base64 inline,
 *     mirrors topup.slipImage). Server records it on the row.
 *   - Reject → free-text reason (1..200 chars). Coins return to
 *     Store.coinBalance via withdraw_reverse StoreTransaction.
 *
 * Both refresh the page on success so the parent re-renders into the
 * approved/rejected display branch.
 */
export function WithdrawalReviewActions({ withdrawalId }: { withdrawalId: number }) {
  const router = useRouter();
  const [tab, setTab] = useState<"approve" | "reject">("approve");
  const [slipDataUrl, setSlipDataUrl] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function onSlipFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1_000_000) {
      setError("Slip image must be under 1 MB. Compress to JPEG before uploading.");
      e.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setSlipDataUrl(String(reader.result));
    reader.onerror = () => setError("Couldn't read the file. Try again.");
    reader.readAsDataURL(file);
  }

  async function onApprove() {
    if (!slipDataUrl) {
      setError("Upload a bank-transfer slip first.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/withdrawals/${withdrawalId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ paidProofImage: slipDataUrl }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.message || data.error || "Approve failed");
        return;
      }
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  async function onReject() {
    if (reason.trim().length < 1) {
      setError("Provide a rejection reason for the audit log.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/withdrawals/${withdrawalId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ reason: reason.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.message || data.error || "Reject failed");
        return;
      }
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-line bg-space-900 p-6">
      <div className="flex items-center gap-1 border-b border-line mb-4">
        <button
          type="button"
          onClick={() => setTab("approve")}
          className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition ${
            tab === "approve"
              ? "border-mint text-mint"
              : "border-transparent text-ink-dim hover:text-white"
          }`}
        >
          <CheckCircle2 className="h-4 w-4 inline mr-1.5" />
          Approve
        </button>
        <button
          type="button"
          onClick={() => setTab("reject")}
          className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition ${
            tab === "reject"
              ? "border-coral text-coral"
              : "border-transparent text-ink-dim hover:text-white"
          }`}
        >
          <XCircle className="h-4 w-4 inline mr-1.5" />
          Reject
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 p-3 flex items-start gap-2 text-sm text-red-200">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {tab === "approve" ? (
        <div className="space-y-4">
          <p className="text-sm text-ink-secondary">
            Transfer the amount above to the seller's bank account, then upload the
            bank-transfer slip as proof. The slip is stored on the withdrawal row
            for audit lookups — no separate document storage.
          </p>
          <div>
            <label
              htmlFor="slip-upload"
              className="inline-flex items-center gap-2 rounded-full border border-dashed border-line bg-space-850 px-4 py-2.5 text-sm text-white cursor-pointer hover:border-metu-yellow/50 transition"
            >
              <Upload className="h-4 w-4" />
              {slipDataUrl ? "Change slip image" : "Choose slip image (PNG / JPEG)"}
              <input
                id="slip-upload"
                type="file"
                accept="image/png,image/jpeg"
                className="sr-only"
                onChange={onSlipFileChange}
              />
            </label>
            {slipDataUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={slipDataUrl}
                alt="Slip preview"
                className="mt-3 max-w-md rounded-xl border border-line object-contain bg-black/40"
              />
            )}
          </div>
          <GlassButton
            tone="gold"
            type="button"
            onClick={onApprove}
            disabled={busy || !slipDataUrl}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            {busy ? "Approving…" : "Mark paid + record slip"}
          </GlassButton>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-ink-secondary">
            Coins will be refunded to the store's balance immediately. The seller
            will see the rejection reason in their wallet history.
          </p>
          <div>
            <label htmlFor="reject-reason" className="block text-xs font-semibold text-white mb-1">
              Rejection reason
            </label>
            <textarea
              id="reject-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Account number doesn't match the seller's verified ID."
              maxLength={200}
              rows={3}
              className="w-full rounded-xl border border-white/10 bg-surface-3 px-4 py-2.5 text-white focus:border-coral outline-none"
            />
            <p className="text-xs text-ink-dim mt-1">{reason.length} / 200 characters</p>
          </div>
          <GlassButton
            tone="coral"
            type="button"
            onClick={onReject}
            disabled={busy || reason.trim().length < 1}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
            {busy ? "Rejecting…" : "Reject + refund coins"}
          </GlassButton>
        </div>
      )}
    </section>
  );
}
