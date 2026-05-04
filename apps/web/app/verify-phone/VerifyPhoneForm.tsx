"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, KeyRound, Loader2, RefreshCw, Smartphone } from "lucide-react";
import { firebaseConfigured, getFirebaseAuth } from "@/lib/firebase";

// Two paths:
//   1. Firebase SMS (when the project has firebase env vars set) — real
//      SMS through reCAPTCHA, then post the ID token to the server.
//   2. In-house OTP fallback (legacy) — code printed to API logs in
//      DEMO_REVEAL_TOKENS mode.

export function VerifyPhoneForm({ email, defaultPhone }: { email: string; defaultPhone?: string }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);
  const [resending, setResending] = useState(false);
  const [resentMsg, setResentMsg] = useState<string | null>(null);

  // Firebase-only state.
  const [phone, setPhone] = useState(defaultPhone ?? "");
  const [fbStep, setFbStep] = useState<"send" | "verify">("send");
  const recaptchaRef = useRef<HTMLDivElement>(null);
  const confirmationRef = useRef<{
    confirm: (code: string) => Promise<{ user: { getIdToken: () => Promise<string> } }>;
  } | null>(null);

  useEffect(() => {
    return () => {
      try {
        if (recaptchaRef.current) recaptchaRef.current.innerHTML = "";
      } catch {
        /* ignore */
      }
    };
  }, []);

  async function firebaseSend() {
    setError(null);
    setBusy(true);
    try {
      const { RecaptchaVerifier, signInWithPhoneNumber } = await import("firebase/auth");
      const auth = getFirebaseAuth();
      if (!auth) throw new Error("Firebase auth client unavailable.");
      if (recaptchaRef.current) {
        recaptchaRef.current.innerHTML = '<div id="recaptcha-container" />';
      }
      const verifier = new RecaptchaVerifier(auth, "recaptcha-container", { size: "invisible" });
      const formatted = phone.startsWith("+") ? phone : `+${phone.replace(/[^0-9]/g, "")}`;
      const conf = await signInWithPhoneNumber(auth, formatted, verifier);
      confirmationRef.current = conf as any;
      setFbStep("verify");
    } catch (e: any) {
      setError(e?.message ?? "Couldn't send the SMS. Check the number and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function firebaseVerify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (!confirmationRef.current) throw new Error("No pending verification — request a new code first.");
      const result = await confirmationRef.current.confirm(code);
      const idToken = await result.user.getIdToken();
      const res = await fetch("/api/auth/verify-phone-firebase-register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, idToken }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message ?? "Server rejected the verification.");
      setVerified(true);
      setTimeout(() => {
        router.push(data?.emailVerified ? "/" : "/verify-pending");
        router.refresh();
      }, 1200);
    } catch (e: any) {
      setError(e?.message ?? "That code didn't match. Try again or resend.");
    } finally {
      setBusy(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) {
      setError("Your session has expired. Please sign in again from /login.");
      return;
    }
    if (!/^\d{6}$/.test(code)) {
      setError("Enter the 6-digit code from the SMS.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/verify-phone-register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.message ?? data?.error ?? "Couldn't verify the code.");
        return;
      }
      setVerified(true);
      // After phone is verified, send the user to the email-verify
      // pending page if email isn't confirmed yet, otherwise home.
      setTimeout(() => {
        router.push(data?.emailVerified ? "/" : "/verify-pending");
        router.refresh();
      }, 1200);
    } catch {
      setError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    if (!email) return;
    setResending(true);
    setResentMsg(null);
    try {
      const res = await fetch("/api/auth/resend-phone-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (res.ok) setResentMsg("New code sent. Check your phone.");
      else setResentMsg("Couldn't resend right now. Try again in a minute.");
    } catch {
      setResentMsg("Network error.");
    } finally {
      setResending(false);
    }
  }

  if (verified) {
    return (
      <div className="rounded-xl border border-mint/30 bg-mint/5 p-4 flex items-start gap-3">
        <CheckCircle2 className="h-5 w-5 text-mint mt-0.5 shrink-0" />
        <div className="text-sm">
          <div className="font-semibold text-mint mb-0.5">Phone verified ✓</div>
          <div className="text-mint/80">Redirecting…</div>
        </div>
      </div>
    );
  }

  if (firebaseConfigured) {
    return (
      <div className="space-y-4">
        <div ref={recaptchaRef}>
          <div id="recaptcha-container" />
        </div>
        {fbStep === "send" && (
          <>
            <label className="block">
              <span className="block text-xs uppercase tracking-wider text-ink-dim mb-1.5">
                Phone number
              </span>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+66812345678"
                className="w-full rounded-xl border border-white/10 bg-surface-3 px-4 py-3 text-white focus:border-metu-yellow outline-none"
              />
            </label>
            {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
            <button
              type="button"
              onClick={firebaseSend}
              disabled={busy || !phone}
              className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-metu-yellow px-5 py-3 text-sm font-bold text-surface-1 hover:bg-metu-yellow/90 transition disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Smartphone className="h-4 w-4" />}
              {busy ? "Sending SMS…" : "Send SMS code"}
            </button>
          </>
        )}
        {fbStep === "verify" && (
          <form onSubmit={firebaseVerify} className="space-y-4">
            <p className="text-sm text-ink-secondary">
              Enter the 6-digit code we sent to <strong className="text-white">{phone}</strong>.
            </p>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6}"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="123456"
              className="w-full rounded-xl border border-white/10 bg-surface-3 px-4 py-3 text-center tracking-[0.4em] font-mono text-xl text-white focus:border-metu-yellow outline-none"
            />
            {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={busy || code.length !== 6}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-full bg-metu-yellow px-5 py-3 text-sm font-bold text-surface-1 hover:bg-metu-yellow/90 transition disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                {busy ? "Verifying…" : "Verify phone"}
              </button>
              <button
                type="button"
                onClick={() => { setFbStep("send"); setCode(""); setError(null); }}
                className="text-xs text-ink-dim hover:text-white px-3"
              >
                Change number
              </button>
            </div>
          </form>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <label className="block">
        <span className="block text-xs uppercase tracking-wider text-ink-dim mb-1.5">
          OTP code
        </span>
        <input
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d{6}"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          placeholder="123456"
          className="w-full rounded-xl border border-white/10 bg-surface-3 px-4 py-3 text-center tracking-[0.4em] font-mono text-xl text-white focus:border-metu-yellow outline-none"
        />
      </label>

      {error && (
        <p role="alert" className="text-sm text-red-400">
          {error}
        </p>
      )}
      {resentMsg && (
        <p className="text-sm text-mint">{resentMsg}</p>
      )}

      <button
        type="submit"
        disabled={busy || code.length !== 6}
        className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-metu-yellow px-5 py-3 text-sm font-bold text-surface-1 hover:bg-metu-yellow/90 transition disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
        {busy ? "Verifying…" : "Verify phone"}
      </button>

      <button
        type="button"
        onClick={resend}
        disabled={resending || !email}
        className="w-full inline-flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/5 px-5 py-2.5 text-xs font-semibold text-ink-secondary hover:bg-white/10 transition disabled:opacity-50"
      >
        {resending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
        {resending ? "Sending…" : "Resend OTP"}
      </button>
    </form>
  );
}
