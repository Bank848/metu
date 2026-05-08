"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, KeyRound, Loader2, Mail, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Turnstile } from "@/components/Turnstile";

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

// Login form. Posts to /api/auth/login -> BFF -> Express ->
// better-auth.signInEmail. Multi-step UI: credentials → TOTP →
// admin email-OTP (Phase 49, only for guarded accounts like the
// public admin demo).

// Open-redirect guard: only allow single-leading-slash relative paths.
function safeNextPath(next: string | null | undefined): string {
  if (typeof next !== "string" || next.length === 0) return "/";
  if (next[0] !== "/") return "/";
  if (next.length >= 2 && (next[1] === "/" || next[1] === "\\")) return "/";
  return next;
}

// Map URL ?error= codes from the Google OAuth flow.
function errorMessage(code: string | null): string | null {
  if (!code) return null;
  switch (code) {
    case "email-exists":
    case "EmailAlreadyRegistered":
      return "An account already exists with that email. Sign in with your password below, then link Google from your profile settings.";
    case "google-not-configured":
      return "Google sign-in is temporarily unavailable on this deployment. Use email + password below, or contact admin.";
    case "state_mismatch":
    case "state_security_mismatch":
      return "The Google sign-in took too long or your browser dropped a cookie. Please click \"Continue with Google\" again.";
    case "oauth-failed":
    default:
      return "Google sign-in didn't complete. Please try again or use email + password.";
  }
}

type Step = "credentials" | "totp" | "admin-otp";

export function LoginForm({
  next,
  /** When false, hide the Google button and the OR-divider. */
  googleEnabled = false,
}: {
  next?: string;
  googleEnabled?: boolean;
}) {
  const searchParams = useSearchParams();
  const oauthErrorBanner = errorMessage(searchParams.get("error"));
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [step, setStep] = useState<Step>("credentials");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // admin OTP step state.
  const [adminOtp, setAdminOtp] = useState("");
  const [confirmOwner, setConfirmOwner] = useState(false);
  const [trustDevice, setTrustDevice] = useState(false);
  const [recipientMasked, setRecipientMasked] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);
  // Turnstile token (only required on the credentials step).
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);

  const formRef = useRef<HTMLFormElement>(null);
  const totpInputRef = useRef<HTMLInputElement>(null);
  const adminOtpInputRef = useRef<HTMLInputElement>(null);

  // When we transition into the TOTP / admin-OTP step, autofocus the
  // matching input.
  useEffect(() => {
    if (step === "totp") totpInputRef.current?.focus();
    if (step === "admin-otp") adminOtpInputRef.current?.focus();
  }, [step]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    // Read directly from the form so chip-click → submit races never
    // see stale React state.
    const fd = new FormData(e.currentTarget);
    const submittedEmail = String(fd.get("email") ?? email).trim();
    const submittedPassword = String(fd.get("password") ?? password);
    if (!submittedEmail || !submittedPassword) {
      setError("Please fill in both fields");
      return;
    }
    if (step === "totp" && !/^\d{6}$/.test(totpCode)) {
      setError("Enter the 6-digit code from your authenticator app");
      return;
    }
    if (step === "admin-otp") {
      if (!/^\d{6}$/.test(adminOtp)) {
        setError("Enter the 6-digit code from the admin email");
        return;
      }
      if (!confirmOwner) {
        setError("Tick the confirmation box to prove you own this account");
        return;
      }
    }

    setBusy(true);
    try {
      const body: {
        email: string;
        password: string;
        totpCode?: string;
        adminOtp?: string;
        confirmOwner?: boolean;
        trustDevice?: boolean;
        captchaToken?: string;
      } = {
        email: submittedEmail,
        password: submittedPassword,
      };
      if (step === "credentials" && captchaToken) {
        body.captchaToken = captchaToken;
      }
      if (step === "totp") body.totpCode = totpCode;
      if (step === "admin-otp") {
        body.adminOtp = adminOtp;
        body.confirmOwner = confirmOwner;
        body.trustDevice = trustDevice;
      }

      const res = await fetch(`/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        credentials: "include",
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        // 401 NeedsVerify — the universal verify gate. Server has the
        // pre-auth state under data.preAuthToken; bounce to the
        // /login/verify page which posts back to /auth/login/verify.
        if (data?.error === "NeedsVerify" && typeof data?.preAuthToken === "string") {
          const params = new URLSearchParams({
            token: data.preAuthToken,
            channels: (data?.channels ?? [])
              .map((c: { id: string; hint?: string }) =>
                c.hint ? `${c.id}:${c.hint}` : c.id,
              )
              .join(","),
          });
          const safeNext = safeNextPath(next);
          if (safeNext !== "/") params.set("next", safeNext);
          router.push(`/login/verify?${params.toString()}`);
          return;
        }
        // 401 NeedsTotp -> flip to step 2 instead of treating as a hard error.
        if (data?.error === "NeedsTotp") {
          setStep("totp");
          setError(null);
          setBusy(false);
          return;
        }
        if (data?.error === "InvalidTotp") {
          setError("Code didn't match. Try a fresh one from your app.");
          setBusy(false);
          return;
        }
        // admin OTP gate. The server has already mailed
        // the code to the configured private recipient; flip the UI
        // to the OTP step and surface the masked recipient so the
        // user knows where to look.
        if (data?.error === "NeedsAdminOtp") {
          setRecipientMasked(
            typeof data?.recipientMasked === "string" ? data.recipientMasked : null,
          );
          // Local-dev escape hatch — server returns the plaintext
          // code in the response body when ADMIN_OTP_DEV_REVEAL=true,
          // so reviewers without inbox access can still log in.
          setDevCode(typeof data?.devCode === "string" ? data.devCode : null);
          setStep("admin-otp");
          setError(null);
          setBusy(false);
          return;
        }
        if (data?.error === "InvalidAdminOtp") {
          setError("Code didn't match. Double-check the email and try again.");
          setBusy(false);
          return;
        }
        if (data?.error === "AdminOtpExpired") {
          setError("That code expired. Click \"Resend\" below to get a fresh one.");
          setBusy(false);
          return;
        }
        if (data?.error === "AdminOtpAttemptsExceeded") {
          setError("Too many wrong attempts. Click \"Resend\" for a new code.");
          setBusy(false);
          return;
        }
        if (data?.error === "OwnershipNotConfirmed") {
          setError("Tick the confirmation box before submitting the code.");
          setBusy(false);
          return;
        }
        // bounce to the verify pages without exposing the
        // email in the URL. The session cookie + the failed-login
        // marker the API set on res lets each verify page read the
        // address from /auth/me on the next request.
        if (data?.error === "EmailNotVerified") {
          router.push("/verify-pending");
          router.refresh();
          return;
        }
        if (data?.error === "PhoneNotVerified") {
          router.push("/verify-phone");
          router.refresh();
          return;
        }
        setError(
          data?.error === "InvalidCredentials"
            ? "Invalid email or password"
            : "Login failed",
        );
        setBusy(false);
        return;
      }

      // Done — better-auth's session cookie is now set by the server.
      // Force RSC re-render so TopNav reflects logged-in state.
      router.push(safeNextPath(next));
      router.refresh();
    } catch {
      setError("Network error");
      setBusy(false);
    }
  }

  // better-auth exposes social sign-in via POST /sign-in/social with
  // a JSON body; follow the {url} response to Google.
  const callbackURL = safeNextPath(next);
  // used to pre-decide "email-exists" for every OAuth
  // failure, which masked unrelated errors (state_mismatch, network,
  // cancelled-by-user). Use a generic param and let the error-message
  // helper map known codes; everything else shows the generic copy.
  const errorCallbackURL = "/login?error=oauth-failed";
  async function onClickGoogle(e: React.MouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    setError(null);
    try {
      const res = await fetch(`/api/auth/better/sign-in/social`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: "google",
          callbackURL,
          errorCallbackURL,
        }),
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (data?.url) {
        window.location.href = data.url;
        return;
      }
      setError("Google sign-in didn't start. Try again or use email + password.");
    } catch {
      setError("Network error reaching Google sign-in.");
    }
  }

  const isCredentialsStep = step === "credentials";
  const submitLabel = busy
    ? isCredentialsStep
      ? "Signing in…"
      : "Verifying…"
    : isCredentialsStep
      ? "Sign in"
      : "Verify & continue";

  return (
    <form
      ref={formRef}
      onSubmit={onSubmit}
      className="rounded-2xl border border-white/10 bg-surface-2/95 backdrop-blur p-7 max-w-md shadow-floating"
    >
      {oauthErrorBanner && (
        <div
          role="alert"
          className="mb-5 rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100"
        >
          {oauthErrorBanner}
        </div>
      )}

      {/* Step indicator — only shown when we've crossed into 2FA, so
          the credentials-only path stays uncluttered. */}
      {step === "totp" && (
        <div className="mb-5 flex items-center gap-3 rounded-xl border border-metu-yellow/25 bg-metu-yellow/5 px-4 py-3 text-sm">
          <ShieldCheck className="h-4 w-4 text-metu-yellow shrink-0" />
          <div>
            <div className="font-semibold text-white">Two-factor required</div>
            <div className="text-ink-dim text-xs mt-0.5">
              Password accepted. Enter the 6-digit code from your authenticator app to finish signing in.
            </div>
          </div>
        </div>
      )}
      {step === "admin-otp" && (
        <div className="mb-5 flex items-center gap-3 rounded-xl border border-mint/30 bg-mint/5 px-4 py-3 text-sm">
          <Mail className="h-4 w-4 text-mint shrink-0" />
          <div>
            <div className="font-semibold text-white">Confirm it&rsquo;s really you</div>
            <div className="text-ink-dim text-xs mt-0.5">
              {recipientMasked
                ? `A 6-digit code was sent to ${recipientMasked}. Open the inbox and enter the code below.`
                : "A 6-digit code was sent to the admin email. Enter it below to finish signing in."}
            </div>
          </div>
        </div>
      )}

      {googleEnabled && step === "credentials" && (
        <>
          <button
            type="button"
            onClick={onClickGoogle}
            className="flex items-center justify-center gap-2 w-full rounded-xl border border-white/10 bg-white text-gray-900 px-4 py-2.5 mb-4 font-semibold hover:bg-gray-100 transition-colors"
          >
            <GoogleGlyph />
            Continue with Google
          </button>
          <div className="relative my-4 flex items-center">
            <div className="flex-grow border-t border-white/10" />
            <span className="mx-3 text-xs uppercase tracking-wider text-ink-dim">
              or sign in with email
            </span>
            <div className="flex-grow border-t border-white/10" />
          </div>
        </>
      )}

      <label className="block text-sm font-semibold text-white mb-1" htmlFor="login-email">
        Email
      </label>
      <input
        id="login-email"
        name="email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        readOnly={step !== "credentials"}
        className={`w-full rounded-xl border border-white/10 bg-surface-3 px-4 py-3 mb-4 text-white placeholder:text-ink-dim focus:border-metu-yellow focus:ring-2 focus:ring-metu-yellow/25 outline-none transition ${
          step !== "credentials" ? "opacity-60 cursor-not-allowed" : ""
        }`}
        required
        autoComplete="email"
      />
      <label className="block text-sm font-semibold text-white mb-1" htmlFor="login-password">
        Password
      </label>
      <input
        id="login-password"
        name="password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        readOnly={step !== "credentials"}
        className={`w-full rounded-xl border border-white/10 bg-surface-3 px-4 py-3 mb-2 text-white focus:border-metu-yellow focus:ring-2 focus:ring-metu-yellow/25 outline-none transition ${
          step !== "credentials" ? "opacity-60 cursor-not-allowed" : ""
        }`}
        required
        autoComplete="current-password"
      />

      {step === "totp" && (
        <div className="mt-4 mb-2 rounded-xl border border-metu-yellow/30 bg-metu-yellow/5 p-4">
          <div className="flex items-center gap-2 mb-2">
            <KeyRound className="h-4 w-4 text-metu-yellow" />
            <label className="block text-sm font-semibold text-white" htmlFor="login-totp">
              Authenticator code
            </label>
          </div>
          <input
            id="login-totp"
            ref={totpInputRef}
            name="totpCode"
            type="text"
            inputMode="numeric"
            pattern="\d{6}"
            maxLength={6}
            value={totpCode}
            onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="123456"
            className="w-full rounded-xl border border-white/10 bg-surface-3 px-4 py-3 text-white text-center tracking-[0.4em] font-mono text-xl focus:border-metu-yellow outline-none"
            autoComplete="one-time-code"
            required
          />
          <button
            type="button"
            onClick={() => {
              setStep("credentials");
              setTotpCode("");
              setError(null);
            }}
            className="mt-2 text-xs text-ink-dim hover:text-metu-yellow"
          >
            ← Use a different account
          </button>
        </div>
      )}

      {step === "admin-otp" && (
        <div className="mt-4 mb-2 rounded-xl border border-mint/30 bg-mint/5 p-4 space-y-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Mail className="h-4 w-4 text-mint" />
              <label className="block text-sm font-semibold text-white" htmlFor="login-admin-otp">
                Email verification code
              </label>
            </div>
            <input
              id="login-admin-otp"
              ref={adminOtpInputRef}
              name="adminOtp"
              type="text"
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              value={adminOtp}
              onChange={(e) => setAdminOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="123456"
              className="w-full rounded-xl border border-white/10 bg-surface-3 px-4 py-3 text-white text-center tracking-[0.4em] font-mono text-xl focus:border-mint outline-none"
              autoComplete="one-time-code"
              required
            />
            {devCode && (
              <p className="mt-2 text-[11px] text-amber-300">
                Dev mode: code is <span className="font-mono">{devCode}</span>
              </p>
            )}
          </div>

          <label className="flex items-start gap-2 cursor-pointer text-sm text-white">
            <input
              type="checkbox"
              checked={confirmOwner}
              onChange={(e) => setConfirmOwner(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-white/20 bg-surface-3 accent-mint"
              required
            />
            <span>
              I confirm I&rsquo;m the rightful owner of this account.
            </span>
          </label>

          <label className="flex items-start gap-2 cursor-pointer text-sm text-ink-secondary">
            <input
              type="checkbox"
              checked={trustDevice}
              onChange={(e) => setTrustDevice(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-white/20 bg-surface-3 accent-mint"
            />
            <span>
              Trust this device for 7 days. Skips this email check next time.
            </span>
          </label>

          <button
            type="button"
            onClick={() => {
              setStep("credentials");
              setAdminOtp("");
              setConfirmOwner(false);
              setTrustDevice(false);
              setRecipientMasked(null);
              setDevCode(null);
              setError(null);
            }}
            className="text-xs text-ink-dim hover:text-mint"
          >
            ← Use a different account
          </button>
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-red-400 my-2">
          {error}
        </p>
      )}

      {step === "credentials" && TURNSTILE_SITE_KEY && (
        <div className="mt-3">
          <Turnstile sitekey={TURNSTILE_SITE_KEY} onVerify={setCaptchaToken} />
        </div>
      )}

      <Button
        type="submit"
        variant="primary"
        size="lg"
        className="w-full mt-3"
        disabled={
          busy ||
          (step === "credentials" && !!TURNSTILE_SITE_KEY && !captchaToken)
        }
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {submitLabel}
        {!busy && <ArrowRight className="h-4 w-4" />}
      </Button>
    </form>
  );
}

function GoogleGlyph() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}
