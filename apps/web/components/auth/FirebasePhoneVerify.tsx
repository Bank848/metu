"use client";
/**
 * Phase 46 — drop-in phone verification using Firebase Phone Auth.
 *
 * Flow:
 *   1. User types phone (with country picker — reuses our PhoneInput).
 *   2. We render an invisible reCAPTCHA + call signInWithPhoneNumber.
 *   3. Firebase sends SMS via its own pipeline — first 10 verifications
 *      per day are free on the Spark plan; pay-as-you-go after.
 *   4. User enters the 6-digit code; we confirm via Firebase, get an
 *      ID token, then POST the token to /api/auth/verify-phone-firebase
 *      so our server stamps `phoneVerifiedAt` for the current session.
 *
 * If `firebaseConfigured` is false (env vars not set yet on Fly), the
 * component renders a polite notice and a "use in-house OTP instead"
 * button so the page stays usable in pre-Firebase environments.
 *
 * NOTE: this component is opt-in. /verify-phone still works with our
 * existing in-house OTP flow. We use this component on the
 * /profile/edit "Verify phone (recommended)" banner CTA so users with
 * unverified phones can pick whichever flow is wired up.
 */
import { useEffect, useRef, useState } from "react";
import { GlassButton } from "@/components/visual/GlassButton";
import { firebaseConfigured, getFirebaseAuth } from "@/lib/firebase";

type Step = "enter-phone" | "enter-code" | "verified";

export function FirebasePhoneVerify({
  defaultPhone = "",
  onVerified,
}: {
  defaultPhone?: string;
  /** Called after the server stamps phoneVerifiedAt successfully. */
  onVerified?: (phone: string) => void;
}) {
  const [step, setStep] = useState<Step>("enter-phone");
  const [phone, setPhone] = useState(defaultPhone);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<null | "send" | "verify">(null);
  const [err, setErr] = useState<string | null>(null);
  const recaptchaContainerRef = useRef<HTMLDivElement>(null);
  // Hold the firebase ConfirmationResult so we can call confirm(code).
  const confirmationRef = useRef<{
    confirm: (code: string) => Promise<{ user: { getIdToken: () => Promise<string>; phoneNumber: string | null } }>;
  } | null>(null);

  useEffect(() => {
    return () => {
      // Best-effort cleanup of the reCAPTCHA container if the component
      // unmounts mid-flow (e.g. user navigates away).
      try {
        if (recaptchaContainerRef.current) {
          recaptchaContainerRef.current.innerHTML = "";
        }
      } catch {
        /* ignore */
      }
    };
  }, []);

  if (!firebaseConfigured) {
    return (
      <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-100">
        <strong className="font-semibold">Firebase phone verify not configured.</strong>
        <p className="mt-1">
          Ask the administrator to set <code className="text-amber-200">NEXT_PUBLIC_FIREBASE_API_KEY</code>,{" "}
          <code className="text-amber-200">NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN</code>, and{" "}
          <code className="text-amber-200">NEXT_PUBLIC_FIREBASE_PROJECT_ID</code> on the web app + place a
          service-account JSON in <code className="text-amber-200">FIREBASE_SERVICE_ACCOUNT_JSON</code> on
          the API. In the meantime, use the in-house OTP at{" "}
          <a className="underline" href="/verify-phone">
            /verify-phone
          </a>.
        </p>
      </div>
    );
  }

  async function sendCode() {
    setErr(null);
    setBusy("send");
    try {
      const { RecaptchaVerifier, signInWithPhoneNumber } = await import("firebase/auth");
      const auth = getFirebaseAuth();
      if (!auth) throw new Error("Firebase auth client unavailable.");
      // Recreate reCAPTCHA on every send so re-trying with a new
      // phone doesn't reuse a stale challenge.
      if (recaptchaContainerRef.current) {
        recaptchaContainerRef.current.innerHTML = '<div id="recaptcha-container" />';
      }
      const verifier = new RecaptchaVerifier(auth, "recaptcha-container", {
        size: "invisible",
      });
      const formatted = phone.startsWith("+") ? phone : `+${phone.replace(/[^0-9]/g, "")}`;
      const conf = await signInWithPhoneNumber(auth, formatted, verifier);
      confirmationRef.current = conf as any;
      setStep("enter-code");
    } catch (e: any) {
      setErr(e?.message ?? "Couldn't send the SMS — check the phone number.");
    } finally {
      setBusy(null);
    }
  }

  async function verifyCode() {
    setErr(null);
    setBusy("verify");
    try {
      if (!confirmationRef.current) throw new Error("No pending verification — request a code first.");
      const result = await confirmationRef.current.confirm(code);
      const idToken = await result.user.getIdToken();
      const res = await fetch("/api/auth/verify-phone-firebase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ idToken }),
      });
      const data = await res.json().catch(() => ({} as { message?: string; phone?: string }));
      if (!res.ok) {
        throw new Error(data?.message ?? `Server rejected the token (HTTP ${res.status}).`);
      }
      setStep("verified");
      onVerified?.(data.phone ?? phone);
    } catch (e: any) {
      setErr(e?.message ?? "That code didn't match. Try resending.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3">
      {step !== "verified" && (
        <div ref={recaptchaContainerRef}>
          <div id="recaptcha-container" />
        </div>
      )}
      {step === "enter-phone" && (
        <>
          <label className="block text-sm font-semibold text-white">
            Phone (with country code)
          </label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+66812345678"
            className="w-full rounded-lg border border-white/10 bg-surface-2 px-3 py-2 text-sm text-white placeholder:text-ink-dim focus:border-metu-yellow outline-none"
          />
          <GlassButton tone="gold" onClick={sendCode} disabled={!phone || busy !== null}>
            {busy === "send" ? "Sending…" : "Send SMS code"}
          </GlassButton>
        </>
      )}
      {step === "enter-code" && (
        <>
          <p className="text-sm text-ink-secondary">
            Enter the 6-digit code we just sent to <strong className="text-white">{phone}</strong>.
          </p>
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            placeholder="123456"
            className="w-full rounded-lg border border-white/10 bg-surface-2 px-3 py-2 text-center text-lg font-mono tracking-widest text-white placeholder:text-ink-dim focus:border-metu-yellow outline-none"
          />
          <div className="flex gap-2">
            <GlassButton tone="gold" onClick={verifyCode} disabled={code.length !== 6 || busy !== null}>
              {busy === "verify" ? "Verifying…" : "Verify code"}
            </GlassButton>
            <button
              type="button"
              onClick={() => {
                setStep("enter-phone");
                setCode("");
              }}
              className="text-xs text-ink-dim hover:text-white"
            >
              Change number
            </button>
          </div>
        </>
      )}
      {step === "verified" && (
        <p className="rounded-lg border border-mint/30 bg-mint/10 px-3 py-2 text-sm text-mint">
          ✓ Phone verified.
        </p>
      )}
      {err && (
        <p className="rounded-lg border border-coral/30 bg-coral/10 px-3 py-2 text-sm text-coral">
          {err}
        </p>
      )}
    </div>
  );
}
