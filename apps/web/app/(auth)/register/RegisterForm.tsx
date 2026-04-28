"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Turnstile } from "@/components/Turnstile";

type Country = { countryId: number; name: string };

// Cloudflare Turnstile is opt-in via env. When the key isn't set we
// don't render the widget at all and the server-side verify is a no-op.
const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

// Phase 14.2 — Google sign-up via better-auth. First-time Google
// users get a fresh User row + a linked Account row. Existing-email
// collision handling is wired in Phase 14.3.5
// (databaseHooks.user.create.before).
// Phase 15.5 follow-up — gate dropped (was NEXT_PUBLIC_GOOGLE_ENABLED).
// Same reason as LoginForm: env required a rebuild to flip and was
// hiding the button on the live demo. Always renders now.
const GOOGLE_ENABLED = true;

const TODAY = new Date();
// Don't allow signups with a future or impossibly-recent birthday — gate the
// max date to "must be at least 13 years old" so the picker enforces it.
const MAX_DOB = new Date(TODAY.getFullYear() - 13, TODAY.getMonth(), TODAY.getDate())
  .toISOString()
  .slice(0, 10);

export function RegisterForm({ countries }: { countries: Country[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
    firstName: "",
    lastName: "",
    dateOfBirth: "",
    gender: "" as "" | "male" | "female" | "other",
    countryId: "" as "" | string, // string in form state, number in payload
  });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    // Don't even hit the API if the CAPTCHA isn't solved yet — saves a
    // failed POST + the rate-limit slot it would consume.
    if (TURNSTILE_SITE_KEY && !captchaToken) {
      setError("Please complete the CAPTCHA below.");
      return;
    }
    setBusy(true);
    try {
      // Strip empty optional fields so the schema's `.optional()` is honoured.
      const payload: Record<string, unknown> = {
        username: form.username,
        email: form.email,
        password: form.password,
        firstName: form.firstName,
        lastName: form.lastName,
      };
      if (form.dateOfBirth) payload.dateOfBirth = form.dateOfBirth;
      if (form.gender) payload.gender = form.gender;
      if (form.countryId) payload.countryId = Number(form.countryId);
      if (captchaToken) payload.captchaToken = captchaToken;

      const res = await fetch(`/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.field ? `That ${data.field} is taken` : "Registration failed");
        setBusy(false);
        return;
      }
      setBusy(false);
      router.push("/");
      router.refresh();
    } catch {
      setError("Network error");
      setBusy(false);
    }
  }

  const inputCls =
    "w-full rounded-xl border border-line bg-space-900 px-4 py-2.5 text-white placeholder:text-ink-dim focus:border-brand-yellow outline-none";

  return (
    <form onSubmit={onSubmit} className="rounded-2xl bg-space-850 border border-line p-6 space-y-4">
      {GOOGLE_ENABLED && (
        <>
          <a
            href="/api/auth/better/sign-in/google?callbackURL=/"
            className="flex items-center justify-center gap-2 w-full rounded-xl border border-white/10 bg-white text-gray-900 px-4 py-2.5 font-semibold hover:bg-gray-100 transition-colors"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Sign up with Google
          </a>
          <div className="relative my-2 flex items-center">
            <div className="flex-grow border-t border-line" />
            <span className="mx-3 text-xs uppercase tracking-wider text-ink-dim">
              or sign up with email
            </span>
            <div className="flex-grow border-t border-line" />
          </div>
        </>
      )}
      <div className="grid grid-cols-2 gap-4">
        <label className="block">
          <span className="block text-sm font-semibold text-white mb-1">First name</span>
          <input
            className={inputCls}
            value={form.firstName}
            onChange={(e) => setForm({ ...form, firstName: e.target.value })}
            required
            maxLength={40}
            autoComplete="given-name"
          />
        </label>
        <label className="block">
          <span className="block text-sm font-semibold text-white mb-1">Last name</span>
          <input
            className={inputCls}
            value={form.lastName}
            onChange={(e) => setForm({ ...form, lastName: e.target.value })}
            required
            maxLength={40}
            autoComplete="family-name"
          />
        </label>
      </div>

      <label className="block">
        <span className="block text-sm font-semibold text-white mb-1">Username</span>
        <input
          className={inputCls}
          value={form.username}
          onChange={(e) => setForm({ ...form, username: e.target.value })}
          required
          minLength={3}
          maxLength={20}
          autoComplete="username"
        />
      </label>

      <label className="block">
        <span className="block text-sm font-semibold text-white mb-1">Email</span>
        <input
          type="email"
          className={inputCls}
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          required
          autoComplete="email"
        />
      </label>

      <label className="block">
        <span className="block text-sm font-semibold text-white mb-1">Password</span>
        <input
          type="password"
          className={inputCls}
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          required
          minLength={6}
          autoComplete="new-password"
        />
      </label>

      {/* Optional demographic fields — kept in their own section so the
          required block above stays compact and obvious. */}
      <details className="rounded-xl border border-line/60 bg-space-900/40 px-4 py-3 group" open>
        <summary className="cursor-pointer text-sm font-semibold text-white list-none flex items-center justify-between">
          A bit about you <span className="text-[10px] text-ink-dim font-normal">(optional)</span>
        </summary>
        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="block text-xs font-semibold uppercase tracking-wider text-ink-dim mb-1">Date of birth</span>
              <input
                type="date"
                className={inputCls}
                value={form.dateOfBirth}
                onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })}
                max={MAX_DOB}
                autoComplete="bday"
              />
            </label>
            <label className="block">
              <span className="block text-xs font-semibold uppercase tracking-wider text-ink-dim mb-1">Gender</span>
              <select
                className={inputCls}
                value={form.gender}
                onChange={(e) => setForm({ ...form, gender: e.target.value as typeof form.gender })}
              >
                <option value="">Prefer not to say</option>
                <option value="female">Female</option>
                <option value="male">Male</option>
                <option value="other">Other</option>
              </select>
            </label>
          </div>
          <label className="block">
            <span className="block text-xs font-semibold uppercase tracking-wider text-ink-dim mb-1">Country</span>
            <select
              className={inputCls}
              value={form.countryId}
              onChange={(e) => setForm({ ...form, countryId: e.target.value })}
            >
              <option value="">Choose a country</option>
              {countries.map((c) => (
                <option key={c.countryId} value={c.countryId}>{c.name}</option>
              ))}
            </select>
          </label>
        </div>
      </details>

      {TURNSTILE_SITE_KEY && (
        <Turnstile
          sitekey={TURNSTILE_SITE_KEY}
          onVerify={setCaptchaToken}
          onExpire={() => setCaptchaToken(null)}
        />
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}
      <Button type="submit" variant="primary" size="lg" className="w-full" disabled={busy}>
        {busy ? "Creating account…" : "Create account →"}
      </Button>
    </form>
  );
}
