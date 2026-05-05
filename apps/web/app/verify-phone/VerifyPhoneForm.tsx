"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, KeyRound, Loader2, RefreshCw } from "lucide-react";
import { firebaseConfigured, getFirebaseAuth } from "@/lib/firebase";

// Two paths share this component:
//   1. Firebase SMS (when the project has the NEXT_PUBLIC_FIREBASE_*
//      env vars set at build time) — real SMS via invisible reCAPTCHA,
//      then post the ID token to the server.
//   2. In-house OTP fallback — code printed to API logs in
//      DEMO_REVEAL_TOKENS mode and surfaced in a yellow banner on the
//      page. Never sends a real SMS.

// Rate-limit knobs for the Firebase resend button. Phone-auth abuse is
// real (every text Firebase sends costs us / hits the daily quota) so
// we throttle on the client AND let Firebase's own quota be the second
// line of defence.
const COOLDOWN_MS = 5 * 60 * 1000;       // wait 5 min between sends
const HOURLY_CAP = 5;                     // max sends per rolling hour
const HOURLY_WINDOW_MS = 60 * 60 * 1000;  // rolling hour
const COOLDOWN_AFTER_CAP_MS = 60 * 60 * 1000; // 1 hour cool-down once cap hit

const RATE_KEY = "metu:phone-verify-attempts";

type Attempt = { at: number };

function loadAttempts(): Attempt[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RATE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Attempt[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveAttempts(list: Attempt[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(RATE_KEY, JSON.stringify(list));
  } catch {
    /* quota / private mode — fall back to in-memory */
  }
}

/**
 * Coerce a Thai-style phone (e.g. "0973368429" or "097 336 8429") into
 * E.164 format that Firebase accepts (+66...). Already-E.164 inputs are
 * returned unchanged. Best-effort for non-Thai numbers — strips spaces
 * and prepends "+" if missing.
 */
function toE164Thai(input: string): string {
  const trimmed = input.trim();
  if (trimmed.startsWith("+")) {
    return "+" + trimmed.slice(1).replace(/[^\d]/g, "");
  }
  const digits = trimmed.replace(/[^\d]/g, "");
  if (digits.startsWith("66")) return "+" + digits;
  if (digits.startsWith("0")) return "+66" + digits.slice(1);
  return "+" + digits;
}

export function VerifyPhoneForm({ email, defaultPhone }: { email: string; defaultPhone?: string }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);
  const [resending, setResending] = useState(false);
  const [resentMsg, setResentMsg] = useState<string | null>(null);

  // Firebase-only state.
  const e164 = defaultPhone ? toE164Thai(defaultPhone) : "";
  const [fbStep, setFbStep] = useState<"send" | "sending" | "verify">("send");
  const [cooldownUntil, setCooldownUntil] = useState<number>(0);
  const [now, setNow] = useState<number>(() => Date.now());
  const recaptchaRef = useRef<HTMLDivElement>(null);
  const confirmationRef = useRef<{
    confirm: (code: string) => Promise<{ user: { getIdToken: () => Promise<string> } }>;
  } | null>(null);
  const sentOnceRef = useRef(false);

  // Tick every second so the cooldown countdown re-renders. Cheap.
  useEffect(() => {
    if (!cooldownUntil) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [cooldownUntil]);

  // Cleanup the recaptcha container on unmount.
  useEffect(() => {
    return () => {
      try {
        if (recaptchaRef.current) recaptchaRef.current.innerHTML = "";
      } catch {
        /* ignore */
      }
    };
  }, []);

  /**
   * Returns the timestamp the next send is allowed at, or 0 if it's OK
   * to send right now. Trims expired attempts as a side-effect.
   */
  function checkRateLimit(): { allowedAt: number; reason: string | null } {
    const all = loadAttempts();
    const cutoff = Date.now() - HOURLY_WINDOW_MS;
    const recent = all.filter((a) => a.at >= cutoff);
    if (recent.length !== all.length) saveAttempts(recent);

    if (recent.length >= HOURLY_CAP) {
      const oldestInWindow = Math.min(...recent.map((a) => a.at));
      const allowedAt = oldestInWindow + COOLDOWN_AFTER_CAP_MS;
      return {
        allowedAt,
        reason: `You've requested ${HOURLY_CAP} codes in the last hour. Try again later.`,
      };
    }
    if (recent.length > 0) {
      const last = recent[recent.length - 1].at;
      const allowedAt = last + COOLDOWN_MS;
      if (Date.now() < allowedAt) {
        return {
          allowedAt,
          reason: "Wait a few minutes before requesting another code.",
        };
      }
    }
    return { allowedAt: 0, reason: null };
  }

  const firebaseSend = useCallback(async () => {
    if (!firebaseConfigured || !e164) return;
    // Client-side cooldown UX so the user sees a countdown without
    // round-tripping the server. Server's `request-firebase-sms` is
    // authoritative; this just hides the button when we KNOW the
    // request will be rejected.
    const gate = checkRateLimit();
    if (gate.allowedAt > 0) {
      setCooldownUntil(gate.allowedAt);
      setError(gate.reason);
      setFbStep("verify"); // we may already have a confirmationRef from a prior send
      return;
    }
    setError(null);
    setBusy(true);
    setFbStep("sending");
    try {
      // Server gate: must pass before we let Firebase ship an SMS. The
      // server tracks per-user / per-phone cooldowns in audit_log so
      // clearing localStorage or opening incognito does NOT reset the
      // limit. Firebase Phone Auth bills per send, so this gate is what
      // actually keeps the bill bounded.
      const gateRes = await fetch("/api/auth/request-firebase-sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email }),
      });
      if (!gateRes.ok) {
        const data = await gateRes.json().catch(() => ({} as { message?: string }));
        const msg = data?.message ?? "Too many SMS requests right now. Try again in a few minutes.";
        // Surface the cooldown so the button greys out — best-effort
        // 5-min default, server's Retry-After header overrides if present.
        const retryAfter = Number(gateRes.headers.get("retry-after"));
        const cooldown = Number.isFinite(retryAfter) && retryAfter > 0
          ? retryAfter * 1000
          : COOLDOWN_MS;
        setCooldownUntil(Date.now() + cooldown);
        setError(msg);
        setFbStep("send");
        return;
      }
      const { RecaptchaVerifier, signInWithPhoneNumber } = await import("firebase/auth");
      const auth = getFirebaseAuth();
      if (!auth) throw new Error("Firebase auth client unavailable.");
      if (recaptchaRef.current) {
        recaptchaRef.current.innerHTML = '<div id="recaptcha-container" />';
      }
      const verifier = new RecaptchaVerifier(auth, "recaptcha-container", { size: "invisible" });
      const conf = await signInWithPhoneNumber(auth, e164, verifier);
      confirmationRef.current = conf as never;
      // Record the attempt + arm the cooldown clock.
      const attempts = loadAttempts();
      attempts.push({ at: Date.now() });
      saveAttempts(attempts);
      setCooldownUntil(Date.now() + COOLDOWN_MS);
      setFbStep("verify");
      setResentMsg("Code sent. Check your phone.");
    } catch (e) {
      const err = e as { message?: string; code?: string };
      const msg = err?.message ?? "Couldn't send the SMS. Try again in a bit.";
      const code = err?.code;
      // eslint-disable-next-line no-console
      console.error("[firebase-phone] send failed:", code, msg);
      // Translate the most common Firebase phone-auth error codes into
      // actionable copy. Anything we don't recognise falls back to the
      // raw Firebase message so the user can screenshot it for support.
      const friendly = (() => {
        switch (code) {
          case "auth/billing-not-enabled":
            return "Phone auth needs a Blaze (pay-as-you-go) plan in Firebase. Free Spark tier no longer supports SMS.";
          case "auth/invalid-phone-number":
            return "Phone number format isn't valid. Use +66XXXXXXXXX or a Thai mobile.";
          case "auth/captcha-check-failed":
            return "reCAPTCHA blocked this request. Refresh and try again.";
          case "auth/quota-exceeded":
            return "We've hit Firebase's daily SMS quota. Try again tomorrow or contact support.";
          case "auth/operation-not-allowed":
            return "Phone sign-in isn't enabled on the Firebase project. Enable it in Authentication → Sign-in method.";
          case "auth/too-many-requests":
            return "Too many requests. Wait a few minutes before retrying.";
          default:
            return msg.replace(/^Firebase:\s*/, "");
        }
      })();
      setError(code ? `${friendly} [${code}]` : friendly);
      setFbStep("send");
    } finally {
      setBusy(false);
    }
  }, [e164, email]);
  // Note: removed auto-fire on mount. Sending an SMS the moment a buyer
  // lands on /verify-phone meant a refresh / accidental re-visit burned
  // a Firebase SMS each time. Now the user explicitly clicks "Send SMS"
  // (or "Resend code" on the verify step). Server-side rate limit at
  // /api/auth/request-firebase-sms is the second line of defence.
  void sentOnceRef;

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
    } catch (e) {
      const err = e as { message?: string; code?: string };
      const msg = err?.message ?? "That code didn't match. Try again or resend.";
      // eslint-disable-next-line no-console
      console.error("[firebase-phone] verify failed:", err?.code, msg);
      setError(msg.replace(/^Firebase:\s*/, ""));
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
    const cooldownLeft = Math.max(0, cooldownUntil - now);
    const cooldownActive = cooldownLeft > 0;
    const cooldownLabel = (() => {
      if (!cooldownActive) return null;
      const totalSec = Math.ceil(cooldownLeft / 1000);
      const m = Math.floor(totalSec / 60);
      const s = totalSec % 60;
      return m > 0 ? `${m}m ${s.toString().padStart(2, "0")}s` : `${s}s`;
    })();
    return (
      <div className="space-y-4">
        {/* The reCAPTCHA verifier needs an element with id
            "recaptcha-container" in the DOM; we keep it invisible
            (size: "invisible" above) but it still has to render. */}
        <div ref={recaptchaRef}>
          <div id="recaptcha-container" />
        </div>

        {fbStep === "sending" && (
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 flex items-start gap-3">
            <Loader2 className="h-5 w-5 text-metu-yellow animate-spin mt-0.5 shrink-0" />
            <div className="text-sm">
              <div className="font-semibold text-white mb-0.5">Sending SMS…</div>
              <div className="text-ink-secondary">
                We&apos;re texting a 6-digit code to{" "}
                <span className="font-mono text-white">{e164 || defaultPhone}</span>.
              </div>
            </div>
          </div>
        )}

        {fbStep === "send" && (
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-ink-secondary">
            We&apos;ll text the code to{" "}
            <span className="font-mono text-white">{e164 || defaultPhone}</span>. Hit{" "}
            <strong className="text-white">Send SMS code</strong> below if it doesn&apos;t go out
            on its own.
          </div>
        )}

        {fbStep === "verify" && (
          <form onSubmit={firebaseVerify} className="space-y-4">
            <p className="text-sm text-ink-secondary">
              Enter the 6-digit code we sent to{" "}
              <strong className="text-white font-mono">{e164 || defaultPhone}</strong>.
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
              autoFocus
            />
            {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
            {resentMsg && !error && <p className="text-sm text-mint">{resentMsg}</p>}
            <button
              type="submit"
              disabled={busy || code.length !== 6}
              className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-metu-yellow px-5 py-3 text-sm font-bold text-surface-1 hover:bg-metu-yellow/90 transition disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
              {busy ? "Verifying…" : "Verify phone"}
            </button>
          </form>
        )}

        {/* Resend lives outside the verify form so it's always reachable
            (including from the "send" + "sending" states). The button is
            disabled while a previous send is in flight or while the
            cooldown timer hasn't ticked down. */}
        {fbStep !== "sending" && (
          <button
            type="button"
            onClick={firebaseSend}
            disabled={busy || cooldownActive}
            className="w-full inline-flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/5 px-5 py-2.5 text-xs font-semibold text-ink-secondary hover:bg-white/10 transition disabled:opacity-50"
            title={cooldownActive ? `Wait ${cooldownLabel}` : undefined}
          >
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            {cooldownActive ? `Resend in ${cooldownLabel}` : "Resend code"}
          </button>
        )}

        {fbStep === "send" && (
          <button
            type="button"
            onClick={firebaseSend}
            disabled={busy || cooldownActive}
            className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-metu-yellow px-5 py-3 text-sm font-bold text-surface-1 hover:bg-metu-yellow/90 transition disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {cooldownActive ? `Wait ${cooldownLabel}` : busy ? "Sending…" : "Send SMS code"}
          </button>
        )}

        {error && fbStep !== "verify" && (
          <p role="alert" className="text-sm text-red-400">
            {error}
          </p>
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
