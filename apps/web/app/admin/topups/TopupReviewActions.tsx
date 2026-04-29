"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/Button";

/**
 * Phase 17.3 — admin actions for one pending top-up.
 *
 * Approve: instant POST /admin/topups/:id/approve, refresh on success.
 * Reject: prompts for a reason inline (REQUIRED so the audit row is
 * useful + the user gets actionable feedback later).
 */
export function TopupReviewActions({ topupId }: { topupId: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"" | "approve" | "reject">("");
  const [error, setError] = useState<string | null>(null);
  const [rejectMode, setRejectMode] = useState(false);
  const [reason, setReason] = useState("");

  async function approve() {
    if (!confirm(`Manually approve top-up #${topupId}? This credits coins to the user.`)) return;
    setBusy("approve");
    setError(null);
    try {
      const res = await fetch(`/api/admin/topups/${topupId}/approve`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.message || data?.error || "Approve failed");
        setBusy("");
        return;
      }
      router.refresh();
    } catch {
      setError("Network error");
      setBusy("");
    }
  }

  async function reject() {
    if (reason.trim().length < 1) {
      setError("Reason is required.");
      return;
    }
    setBusy("reject");
    setError(null);
    try {
      const res = await fetch(`/api/admin/topups/${topupId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason.trim() }),
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.message || data?.error || "Reject failed");
        setBusy("");
        return;
      }
      router.refresh();
    } catch {
      setError("Network error");
      setBusy("");
    }
  }

  return (
    <div className="mt-4">
      {!rejectMode ? (
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={approve}
            disabled={Boolean(busy)}
          >
            {busy === "approve" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            Approve + credit coins
          </Button>
          <Button
            type="button"
            variant="danger"
            size="sm"
            onClick={() => setRejectMode(true)}
            disabled={Boolean(busy)}
          >
            <X className="h-3.5 w-3.5" />
            Reject
          </Button>
        </div>
      ) : (
        <div className="rounded-xl border border-coral/30 bg-coral/5 p-3">
          <label className="block text-xs font-semibold text-white mb-1">
            Rejection reason (shown to user)
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value.slice(0, 200))}
            rows={2}
            placeholder="e.g. slip is for a different amount / different recipient / unreadable QR"
            className="w-full rounded-lg border border-line bg-surface-3 px-3 py-2 text-sm text-white focus:border-coral outline-none"
          />
          <div className="mt-2 flex items-center gap-2">
            <Button
              type="button"
              variant="danger"
              size="sm"
              onClick={reject}
              disabled={busy === "reject" || reason.trim().length < 1}
            >
              {busy === "reject" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
              Confirm reject
            </Button>
            <button
              type="button"
              onClick={() => {
                setRejectMode(false);
                setReason("");
              }}
              className="text-xs text-ink-dim hover:text-white"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      {error && (
        <p role="alert" className="mt-2 text-xs text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
