"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";

// Phase 14.2 — Google sign-in via better-auth. Button only renders
// when NEXT_PUBLIC_GOOGLE_ENABLED=true so dev environments without
// Google OAuth credentials don't show a button that 404s on click.
const GOOGLE_ENABLED = process.env.NEXT_PUBLIC_GOOGLE_ENABLED === "true";

// Phase 14.3.5 — Google sign-in error reasons surfaced in the URL.
// better-auth redirects failed OAuth flows to errorCallbackURL with
// the failure code as a query param.
function errorMessage(code: string | null): string | null {
  if (!code) return null;
  switch (code) {
    case "email-exists":
    case "EmailAlreadyRegistered":
      return "An account already exists with that email. Sign in with your password below, then link Google from your profile settings.";
    default:
      return "Google sign-in didn't complete. Please try again or use email + password.";
  }
}

export function LoginForm({ next }: { next?: string }) {
  const searchParams = useSearchParams();
  const oauthErrorBanner = errorMessage(searchParams.get("error"));
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const nodes = document.querySelectorAll<HTMLButtonElement>(".metu-demo-chip");
    const handler = (ev: Event) => {
      const el = ev.currentTarget as HTMLButtonElement;
      setEmail(el.dataset.demoEmail ?? "");
      setPassword(el.dataset.demoPassword ?? "");
      formRef.current?.querySelector<HTMLInputElement>('input[name="email"]')?.focus();
    };
    nodes.forEach((n) => n.addEventListener("click", handler));
    return () => nodes.forEach((n) => n.removeEventListener("click", handler));
  }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    // Read directly from the form so chip-click → submit races never see
    // stale React state. Falls back to controlled state if refs are missing.
    const fd = new FormData(e.currentTarget);
    const submittedEmail = String(fd.get("email") ?? email).trim();
    const submittedPassword = String(fd.get("password") ?? password);
    if (!submittedEmail || !submittedPassword) {
      setError("Please fill in both fields");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: submittedEmail, password: submittedPassword }),
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error === "InvalidCredentials" ? "Invalid email or password" : "Login failed");
        setBusy(false);
        return;
      }
      setBusy(false);
      router.push(next ?? "/");
      // Force the destination's server components to re-read the freshly-set
      // auth cookie — without this, TopNav still renders the logged-out state
      // until the user manually refreshes.
      router.refresh();
    } catch {
      setError("Network error");
      setBusy(false);
    }
  }

  // Build the Google sign-in URL. better-auth's catch-all responds
  // to GET /api/auth/better/sign-in/google with a 302 to Google's
  // OAuth consent screen. After consent → callback → cookie set →
  // redirect to `callbackURL` (default /). On failure (e.g. our
  // databaseHooks email-collision throw) → `errorCallbackURL` with
  // the error code.
  const callbackURL = encodeURIComponent(next ?? "/");
  const errorCallbackURL = encodeURIComponent("/login?error=email-exists");
  const googleHref = `/api/auth/better/sign-in/google?callbackURL=${callbackURL}&errorCallbackURL=${errorCallbackURL}`;

  return (
    <form
      ref={formRef}
      onSubmit={onSubmit}
      className="rounded-2xl bg-surface-2 border border-white/8 p-6 max-w-md"
    >
      {/* Phase 14.3.5 — OAuth error banner. Renders when Google sign-in
          failed because the email is already registered locally; tells
          the user to log in with password and link Google from settings. */}
      {oauthErrorBanner && (
        <div className="mb-4 rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
          {oauthErrorBanner}
        </div>
      )}
      {GOOGLE_ENABLED && (
        <>
          {/* Google sign-in is a plain navigation, not a fetch — better-auth's
              flow needs a top-level redirect so the cookie set by the OAuth
              callback is sent on subsequent requests. */}
          <a
            href={googleHref}
            className="flex items-center justify-center gap-2 w-full rounded-xl border border-white/10 bg-white text-gray-900 px-4 py-2.5 mb-4 font-semibold hover:bg-gray-100 transition-colors"
          >
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
            Continue with Google
          </a>
          <div className="relative my-4 flex items-center">
            <div className="flex-grow border-t border-white/10" />
            <span className="mx-3 text-xs uppercase tracking-wider text-ink-dim">
              or sign in with email
            </span>
            <div className="flex-grow border-t border-white/10" />
          </div>
        </>
      )}
      <label className="block text-sm font-semibold text-white mb-1">Email</label>
      <input
        name="email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full rounded-xl border border-white/10 bg-surface-3 px-4 py-2.5 mb-4 text-white placeholder:text-ink-dim focus:border-metu-yellow outline-none"
        required
        autoComplete="email"
      />
      <label className="block text-sm font-semibold text-white mb-1">Password</label>
      <input
        name="password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="w-full rounded-xl border border-white/10 bg-surface-3 px-4 py-2.5 mb-2 text-white focus:border-metu-yellow outline-none"
        required
        autoComplete="current-password"
      />
      {error && <p className="text-sm text-red-400 my-2">{error}</p>}
      <Button type="submit" variant="primary" size="lg" className="w-full mt-3" disabled={busy}>
        {busy ? "Logging in…" : "Log in →"}
      </Button>
    </form>
  );
}
