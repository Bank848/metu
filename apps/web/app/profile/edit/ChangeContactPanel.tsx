"use client";
import { useState } from "react";
import { Loader2, Mail, Phone, Check } from "lucide-react";

type Mode = "email" | "phone";

export function ChangeContactPanel({
  mode,
  currentValue,
  currentEmail,
}: {
  mode: Mode;
  currentValue: string;
  /** Current email on file — shown as the destination for the OTP. */
  currentEmail: string;
}) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"input" | "verify" | "done">("input");
  const [newValue, setNewValue] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startUrl = mode === "email"
    ? "/api/auth/me/email-change/start"
    : "/api/auth/me/phone-change/start";
  const verifyUrl = mode === "email"
    ? "/api/auth/me/email-change/verify"
    : "/api/auth/me/phone-change/verify";
  const newKey = mode === "email" ? "newEmail" : "newPhone";
  const label = mode === "email" ? "email" : "phone number";

  async function startChange(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(startUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ [newKey]: newValue.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.message ?? `Couldn't start ${label} change.`);
        setBusy(false);
        return;
      }
      setStep("verify");
    } catch {
      setError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  async function verifyChange(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(verifyUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ [newKey]: newValue.trim(), code }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.message ?? "Code didn't match.");
        setBusy(false);
        return;
      }
      setStep("done");
      setBusy(false);
      setTimeout(() => window.location.reload(), 1200);
    } catch {
      setError("Network error.");
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs text-metu-yellow hover:underline"
      >
        Change {label} →
      </button>
    );
  }

  if (step === "done") {
    return (
      <div className="rounded-xl border border-mint/30 bg-mint/5 p-3 flex items-start gap-2 text-sm">
        <Check className="h-4 w-4 text-mint mt-0.5" />
        <div>
          <div className="font-semibold text-mint">{mode === "email" ? "Email" : "Phone"} updated</div>
          <div className="text-mint/80 text-xs">
            {mode === "email"
              ? "We sent a verification link to your new email. Click it to finish."
              : "Reload to see the new phone. You'll be asked to verify it on next sign-in."}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-line bg-space-950 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-white inline-flex items-center gap-1.5">
          {mode === "email" ? <Mail className="h-3.5 w-3.5" /> : <Phone className="h-3.5 w-3.5" />}
          Change {label}
        </h4>
        <button
          type="button"
          onClick={() => { setOpen(false); setStep("input"); setError(null); }}
          className="text-xs text-ink-dim hover:text-white"
        >
          Cancel
        </button>
      </div>

      {step === "input" && (
        <form onSubmit={startChange} className="space-y-2">
          <p className="text-xs text-ink-dim">
            We&apos;ll text a 6-digit code to your <strong className="text-white">current email</strong> ({currentEmail}) to confirm it&apos;s you.
          </p>
          <label className="block">
            <span className="text-xs uppercase tracking-wider text-ink-dim">New {label}</span>
            <input
              type={mode === "email" ? "email" : "tel"}
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              placeholder={mode === "email" ? "new@example.com" : "+66XXXXXXXXX"}
              defaultValue={currentValue}
              required
              autoFocus
              className="w-full mt-1 rounded-lg border border-line bg-space-900 px-3 py-2 text-sm text-white focus:border-metu-yellow outline-none"
            />
          </label>
          {error && <p className="text-xs text-coral">{error}</p>}
          <button
            type="submit"
            disabled={busy || !newValue.trim()}
            className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-metu-yellow px-4 py-2 text-xs font-bold text-surface-1 hover:bg-metu-yellow/90 disabled:opacity-50"
          >
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {busy ? "Sending…" : "Send confirmation code"}
          </button>
        </form>
      )}

      {step === "verify" && (
        <form onSubmit={verifyChange} className="space-y-2">
          <p className="text-xs text-ink-dim">
            We sent a 6-digit code to <strong className="text-white">{currentEmail}</strong>. Enter it below to apply the change to <strong className="text-white">{newValue}</strong>.
          </p>
          <input
            type="text"
            inputMode="numeric"
            pattern="\d{6}"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="123456"
            required
            autoFocus
            className="w-full rounded-lg border border-line bg-space-900 px-3 py-2 text-center font-mono tracking-[0.4em] text-lg text-white focus:border-metu-yellow outline-none"
          />
          {error && <p className="text-xs text-coral">{error}</p>}
          <button
            type="submit"
            disabled={busy || code.length !== 6}
            className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-metu-yellow px-4 py-2 text-xs font-bold text-surface-1 hover:bg-metu-yellow/90 disabled:opacity-50"
          >
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {busy ? "Verifying…" : `Confirm change`}
          </button>
        </form>
      )}
    </div>
  );
}
