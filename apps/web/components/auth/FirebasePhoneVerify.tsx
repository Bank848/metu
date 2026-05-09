"use client";
/**
 * Drop-in phone verification using Firebase Phone Auth.
 * Flow: phone input → invisible reCAPTCHA → signInWithPhoneNumber →
 * SMS code → confirm → POST Firebase ID token to verifyUrl so the
 * server can stamp `phoneVerifiedAt`. When `firebaseConfigured` is
 * false the component renders a notice pointing to the in-house OTP.
 */
import { useEffect, useRef, useState } from "react";
import { GlassButton } from "@/components/visual/GlassButton";
import { firebaseConfigured, getFirebaseAuth } from "@/lib/firebase";

type Step = "enter-phone" | "enter-code" | "verified";

export function FirebasePhoneVerify({
  defaultPhone = "",
  phoneLabel,
  onVerified,
  verifyUrl = "/api/auth/verify-phone-firebase",
  extraBody = {},
  autoSend = false,
  hideEnterPhone = false,
}: {
  defaultPhone?: string;
  /** What to show users in the "code sent to ___" copy. Defaults to
   *  defaultPhone (the raw E.164). Pass a masked tail like
   *  "+66 *** *** 1234" on flows where the raw number shouldn't reach
   *  the UI. Firebase still receives the full defaultPhone for the
   *  signInWithPhoneNumber call. */
  phoneLabel?: string;
  /** Called after the server stamps phoneVerifiedAt successfully. */
  onVerified?: (phone: string) => void;
  /** Override for non-register flows (e.g. login two-step verify). */
  verifyUrl?: string;
  /** Extra fields merged into the POST body sent to verifyUrl. */
  extraBody?: Record<string, unknown>;
  /** Auto-fire sendCode() once defaultPhone is non-empty (login flow). */
  autoSend?: boolean;
  /** Hide the editable phone input — show "Sending to ••••XXXX" copy. */
  hideEnterPhone?: boolean;
}) {
  const [step, setStep] = useState<Step>("enter-phone");
  const [phone, setPhone] = useState(defaultPhone);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<null | "send" | "verify">(null);
  const [err, setErr] = useState<string | null>(null);
  // 5-minute resend cooldown countdown (Firebase Phone Auth itself
  // throttles around 60s; we keep a longer window so the user can't
  // burn through the daily SMS quota by mashing resend).
  const RESEND_COOLDOWN_MS = 5 * 60_000;
  const [lastSentAt, setLastSentAt] = useState<number>(0);
  const [cooldownLeft, setCooldownLeft] = useState<number>(0);
  useEffect(() => {
    const tick = () => {
      const left = Math.max(0, RESEND_COOLDOWN_MS - (Date.now() - lastSentAt));
      setCooldownLeft(Math.ceil(left / 1000));
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [lastSentAt]);
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

  // Login flow gives us the verified phone up-front — auto-fire send
  // once the phone arrives so the user doesn't have to click anything.
  const autoSentRef = useRef(false);
  useEffect(() => {
    if (!autoSend || autoSentRef.current) return;
    if (!firebaseConfigured || !defaultPhone) return;
    if (phone !== defaultPhone) {
      setPhone(defaultPhone);
    }
    autoSentRef.current = true;
    void sendCode();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSend, defaultPhone]);

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
    if (Date.now() - lastSentAt < RESEND_COOLDOWN_MS) {
      const remainingS = Math.ceil(
        (RESEND_COOLDOWN_MS - (Date.now() - lastSentAt)) / 1000,
      );
      setErr(`Please wait ${Math.ceil(remainingS / 60)} more minute${Math.ceil(remainingS / 60) === 1 ? "" : "s"} before requesting another code.`);
      return;
    }
    setErr(null);
    setBusy("send");
    // Show the code-input UI immediately so the user can pre-type
    // when their SMS arrives — Firebase still has to round-trip
    // reCAPTCHA + dispatch which takes a couple of seconds.
    setStep("enter-code");
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
      setLastSentAt(Date.now());
    } catch (e: any) {
      // Map known Firebase error codes to actionable copy. Anything we
      // don't recognise falls back to e.message.
      const code: string | undefined = e?.code;
      let friendly: string;
      if (code === "auth/api-key-not-valid" || code === "auth/api-key-not-valid.-please-pass-a-valid-api-key.") {
        friendly = "SMS verification is not configured on this deployment (Firebase API key is invalid). Pick the Email channel above to receive a code instead.";
      } else if (code === "auth/invalid-phone-number") {
        friendly = "Phone number format looks wrong. Expecting an E.164 value like +66812345678.";
      } else if (code === "auth/too-many-requests") {
        friendly = "Firebase is rate-limiting this device. Wait a few minutes, then try again.";
      } else if (code === "auth/quota-exceeded") {
        friendly = "Daily SMS quota for this Firebase project is used up. Try the Email channel instead.";
      } else if (code === "auth/captcha-check-failed") {
        friendly = "reCAPTCHA didn't validate. Refresh the page and try again.";
      } else {
        friendly = e?.message ?? "Couldn't send the SMS — try again.";
      }
      setErr(friendly);
      // Drop back so user can retry / change number on register flow.
      setStep("enter-phone");
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
      const body = { idToken, ...extraBody };
      const res = await fetch(verifyUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
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
      {step === "enter-phone" && !hideEnterPhone && (
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
      {step === "enter-phone" && hideEnterPhone && (
        <div className="space-y-3">
          <p className="text-sm text-ink-secondary">
            {busy === "send"
              ? `Sending an SMS code to ${phoneLabel || phone || "your phone…"}`
              : phone
                ? `Tap below to send an SMS code to ${phoneLabel || phone}.`
                : "Preparing SMS verification…"}
          </p>
          {!autoSend && phone && (
            <GlassButton tone="gold" onClick={sendCode} disabled={busy !== null}>
              {busy === "send" ? "Sending…" : "Send SMS code"}
            </GlassButton>
          )}
        </div>
      )}
      {step === "enter-code" && (
        <>
          <p className="text-sm text-ink-secondary">
            {busy === "send"
              ? <>Sending a 6-digit code to <strong className="text-white">{phoneLabel || phone}</strong>…</>
              : <>Enter the 6-digit code we just sent to <strong className="text-white">{phoneLabel || phone}</strong>.</>}
          </p>
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            placeholder="123456"
            autoFocus
            className="w-full rounded-lg border border-white/10 bg-surface-2 px-3 py-2 text-center text-lg font-mono tracking-widest text-white placeholder:text-ink-dim focus:border-metu-yellow outline-none"
          />
          <div className="flex flex-wrap items-center gap-2">
            <GlassButton tone="gold" onClick={verifyCode} disabled={code.length !== 6 || busy !== null || !confirmationRef.current}>
              {busy === "verify" ? "Verifying…" : "Verify code"}
            </GlassButton>
            <button
              type="button"
              onClick={sendCode}
              disabled={busy !== null || cooldownLeft > 0}
              className="text-xs text-metu-yellow hover:underline disabled:text-ink-dim disabled:no-underline"
            >
              {cooldownLeft > 0
                ? `Resend in ${Math.ceil(cooldownLeft / 60)}m ${cooldownLeft % 60}s`
                : "Resend code"}
            </button>
            {!hideEnterPhone && (
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
            )}
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
