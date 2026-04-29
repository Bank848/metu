"use client";
import { useEffect, useRef, useState } from "react";
import { Loader2, ShieldCheck, X, AlertCircle } from "lucide-react";

/**
 * Phase 23.3 — TOTP step-up modal.
 *
 * Use pattern (in any client form that calls a sensitive endpoint):
 *
 *   const [stepUpOpen, setStepUpOpen] = useState(false);
 *   const [retry, setRetry] = useState<(() => Promise<void>) | null>(null);
 *
 *   async function submit() {
 *     const res = await fetch(...);
 *     if (res.status === 403) {
 *       const body = await res.json();
 *       if (body.error === "TotpStepUpRequired") {
 *         setRetry(() => submit);
 *         setStepUpOpen(true);
 *         return;
 *       }
 *     }
 *     // ... handle other cases
 *   }
 *
 *   <TotpStepUpModal
 *     open={stepUpOpen}
 *     onClose={() => setStepUpOpen(false)}
 *     onSuccess={() => { setStepUpOpen(false); retry?.(); }}
 *   />
 *
 * The modal calls /api/auth/totp/step-up with the code. On success
 * it invokes onSuccess; the caller's `retry` fires the original
 * fetch which now passes the requireRecent2FA gate.
 */
export function TotpStepUpModal({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus the input + clear state when the modal opens.
  useEffect(() => {
    if (open) {
      setCode("");
      setError(null);
      // Defer to next tick so the input is mounted by the time
      // we call .focus() — Safari otherwise no-ops the focus.
      const t = setTimeout(() => inputRef.current?.focus(), 30);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Esc to close.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!/^[0-9]{6}$/.test(code)) {
      setError("Enter the 6-digit code from your authenticator.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/totp/step-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ code }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.message || body.error || "Step-up failed");
        return;
      }
      onSuccess();
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="totp-step-up-title"
      className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-sm rounded-2xl border border-line bg-space-900 p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-mint" />
            <h2 id="totp-step-up-title" className="font-display text-base font-bold text-white">
              Verify it's still you
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close"
            className="text-ink-dim hover:text-white disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="text-sm text-ink-secondary mb-4">
          Enter the 6-digit code from your authenticator app to authorise this
          sensitive action. Required every 15 minutes for sensitive flows
          (withdrawals, password change, account changes).
        </p>

        {error && (
          <div className="mb-3 rounded-lg border border-red-500/40 bg-red-500/10 p-3 flex items-start gap-2 text-sm text-red-200">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={submit}>
          <input
            ref={inputRef}
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ""))}
            placeholder="000000"
            className="w-full rounded-xl border border-white/10 bg-surface-3 px-4 py-3 text-center text-2xl font-mono tracking-[0.5em] text-white focus:border-metu-yellow outline-none"
          />
          <div className="mt-4 flex items-center gap-2">
            <button
              type="submit"
              disabled={busy || code.length !== 6}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-full button-gradient text-surface-1 px-5 py-2.5 text-sm font-semibold transition disabled:opacity-50 hover:brightness-110"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              {busy ? "Verifying…" : "Verify"}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="rounded-full border border-line bg-space-850 px-4 py-2.5 text-sm font-semibold text-ink-secondary hover:text-white disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
