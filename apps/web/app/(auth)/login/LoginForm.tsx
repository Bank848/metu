"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";

// Phase 16.3 — frontend rebuild for the better-auth Mode A backend.
//
// Same external surface (POST /api/auth/login → BFF → Express →
// better-auth.signInEmail), refreshed UI:
//   • single-card layout instead of stacked sections
//   • visible 2-step indicator when TOTP kicks in
//   • clearer state for each loading/error case
//   • DOM-listener for demo chips replaced with a window event
//     channel so the page can prefill via dispatchEvent rather than
//     scraping `data-*` attrs

// Phase 17.x — Google button visibility is gated by the live
// `googleEnabled` flag from /api/settings, computed server-side from
// the presence of GOOGLE_CLIENT_ID on the API. Earlier code had a
// `const GOOGLE_ENABLED = true` that always rendered the button,
// which caused a hard 404 / PROVIDER_NOT_FOUND on deployments
// without the OAuth credentials configured.

// Phase 14.3.5 — Google sign-in error reasons surfaced in the URL.
function errorMessage(code: string | null): string | null {
  if (!code) return null;
  switch (code) {
    case "email-exists":
    case "EmailAlreadyRegistered":
      return "An account already exists with that email. Sign in with your password below, then link Google from your profile settings.";
    case "google-not-configured":
      return "Google sign-in is temporarily unavailable on this deployment. Use email + password below, or contact admin.";
    default:
      return "Google sign-in didn't complete. Please try again or use email + password.";
  }
}

type Step = "credentials" | "totp";

export function LoginForm({
  next,
  /** Phase 17.x — when false, the "Continue with Google" button is
   *  hidden entirely and the OR-divider is dropped. The page server
   *  component reads /api/settings.googleEnabled and threads it
   *  through here. */
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

  const formRef = useRef<HTMLFormElement>(null);
  const totpInputRef = useRef<HTMLInputElement>(null);

  // Demo chip → form prefill via a window event. The page mounts
  // <DemoChip> buttons that dispatch `metu:prefill-login` with
  // {email, password} in the detail; we listen and apply.
  useEffect(() => {
    function onPrefill(ev: Event) {
      const detail = (ev as CustomEvent<{ email: string; password: string }>).detail;
      if (!detail) return;
      setEmail(detail.email);
      setPassword(detail.password);
      setStep("credentials");
      setTotpCode("");
      setError(null);
      formRef.current?.querySelector<HTMLInputElement>('input[name="email"]')?.focus();
    }
    window.addEventListener("metu:prefill-login", onPrefill);
    return () => window.removeEventListener("metu:prefill-login", onPrefill);
  }, []);

  // When we transition into the TOTP step, autofocus its input.
  useEffect(() => {
    if (step === "totp") totpInputRef.current?.focus();
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

    setBusy(true);
    try {
      const body: { email: string; password: string; totpCode?: string } = {
        email: submittedEmail,
        password: submittedPassword,
      };
      if (step === "totp") body.totpCode = totpCode;

      const res = await fetch(`/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        credentials: "include",
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        // Phase 16.2 — TOTP 2-step prompt. Server surfaces a clean
        // 401 NeedsTotp after a successful password check; flip the
        // form into step 2 instead of treating it as a hard error.
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
        setError(
          data?.error === "InvalidCredentials"
            ? "Invalid email or password"
            : "Login failed",
        );
        setBusy(false);
        return;
      }

      // Done — Mode A: better-auth's session cookie is now set by the
      // server's /auth/login → signInEmail bridge. Force the
      // destination's RSC re-render so TopNav reflects logged-in state.
      router.push(next ?? "/");
      router.refresh();
    } catch {
      setError("Network error");
      setBusy(false);
    }
  }

  // Phase 30 — better-auth v1.6.9 ditched the GET catch-all and only
  // exposes social sign-in via POST /sign-in/social with a JSON body.
  // We do the fetch manually and follow the {url} response back to
  // Google. Keeping this as a client-side handler (not <a href>) means
  // the BFF cookie jar is preserved across the redirect.
  const callbackURL = next ?? "/";
  const errorCallbackURL = "/login?error=email-exists";
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
        readOnly={step === "totp"}
        className={`w-full rounded-xl border border-white/10 bg-surface-3 px-4 py-2.5 mb-4 text-white placeholder:text-ink-dim focus:border-metu-yellow outline-none transition ${
          step === "totp" ? "opacity-60 cursor-not-allowed" : ""
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
        readOnly={step === "totp"}
        className={`w-full rounded-xl border border-white/10 bg-surface-3 px-4 py-2.5 mb-2 text-white focus:border-metu-yellow outline-none transition ${
          step === "totp" ? "opacity-60 cursor-not-allowed" : ""
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

      {error && (
        <p role="alert" className="text-sm text-red-400 my-2">
          {error}
        </p>
      )}

      <Button type="submit" variant="primary" size="lg" className="w-full mt-3" disabled={busy}>
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
