"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Turnstile } from "@/components/Turnstile";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { PhoneInput, joinPhone, PHONE_COUNTRIES } from "@/components/forms/PhoneInput";
import { DateOfBirthPicker } from "@/components/forms/DateOfBirthPicker";

type Country = { countryId: number; name: string };

// Cloudflare Turnstile is opt-in via env. When the key isn't set we
// don't render the widget at all and the server-side verify is a no-op.
const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

// Open-redirect guard mirrors the login version.
function safeNextPath(next: string | null | undefined): string | null {
  if (!next) return null;
  if (!next.startsWith("/")) return null;
  if (next.startsWith("//") || next.startsWith("/\\")) return null;
  if (/[\r\n]/.test(next)) return null;
  return next;
}

export function RegisterForm({
  countries,
  googleEnabled = false,
  defaultPhoneCountry = "TH",
  next,
  emailHint,
}: {
  countries: Country[];
  googleEnabled?: boolean;
  /** Pre-select the phone country dial code; user can change it. */
  defaultPhoneCountry?: string;
  /** Threaded through verify-phone so post-onboarding lands on the
   *  caller's page (e.g. /gift/[id]?t=…). */
  next?: string;
  /** Hint text shown above the email field, e.g. when arriving from a
   *  gift link that wants the recipient to sign up with a specific
   *  address. The form doesn't lock the input — user can override. */
  emailHint?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const initialPhoneCountry =
    PHONE_COUNTRIES.find((c) => c.code === defaultPhoneCountry)?.code ?? "TH";
  const [phoneCountry, setPhoneCountry] = useState(initialPhoneCountry);
  const [phoneDigits, setPhoneDigits] = useState("");
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
      const phone = joinPhone(phoneCountry, phoneDigits);
      if (!phone) {
        setError("Please enter your phone number.");
        setBusy(false);
        return;
      }
      if (!form.dateOfBirth) {
        setError("Please pick your date of birth.");
        setBusy(false);
        return;
      }
      // Strip empty optional fields so the schema's `.optional()` is honoured.
      const payload: Record<string, unknown> = {
        username: form.username,
        email: form.email,
        password: form.password,
        firstName: form.firstName,
        lastName: form.lastName,
        phone,
        dateOfBirth: form.dateOfBirth,
      };
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
        setError(
          data?.message
            ?? (data?.field ? `That ${data.field} is taken` : "Registration failed"),
        );
        setBusy(false);
        return;
      }
      setBusy(false);
      // Register no longer auto-logs in. The BFF forwarder set a signed
      // `metu_pv` cookie so verify-phone can identify the account
      // without ?email= in the URL. Thread `next` through so a gift
      // recipient lands back on /gift/[id]?t=… after phone verify.
      const safeNext = safeNextPath(next);
      const target = safeNext ? `/verify-phone?next=${encodeURIComponent(safeNext)}` : "/verify-phone";
      router.push(target);
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
      {googleEnabled && (
        <>
          <GoogleSignInButton
            label="Sign up with Google"
            callbackURL="/"
            errorCallbackURL="/login?error=oauth-failed"
            onError={(msg) => setError(msg)}
          />
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
        {emailHint && (
          <p className="text-[11px] text-metu-yellow mb-1.5">
            Sign up with the address this gift was sent to: <span className="font-mono">{emailHint}</span>
          </p>
        )}
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

      <label className="block">
        <span className="block text-sm font-semibold text-white mb-1">Phone</span>
        <PhoneInput
          countryCode={phoneCountry}
          digits={phoneDigits}
          onCountryChange={setPhoneCountry}
          onDigitsChange={setPhoneDigits}
          required
        />
        <span className="mt-1 block text-[11px] text-ink-dim">
          Pick your country, then type your number — for Thailand that&apos;s
          the 9-digit international form, no leading 0. We&apos;ll text a
          one-time code so we know it&apos;s really you.
        </span>
      </label>

      {/* Date of birth — required for age-bucket analytics. Kept
          outside the optional details block so it can't be missed. */}
      <label className="block">
        <span className="block text-sm font-semibold text-white mb-1">Date of birth</span>
        <DateOfBirthPicker
          value={form.dateOfBirth}
          onChange={(v) => setForm({ ...form, dateOfBirth: v })}
        />
        <span className="mt-1 block text-[11px] text-ink-dim">
          We use this for age-bucket reporting only. Visible to admins,
          never to other shoppers.
        </span>
      </label>

      {/* Optional demographic fields — gender + country are still
          opt-in so the form stays under the fold for fast signups. */}
      <details className="rounded-xl border border-line/60 bg-space-900/40 px-4 py-3 group">
        <summary className="cursor-pointer text-sm font-semibold text-white list-none flex items-center justify-between">
          A bit about you <span className="text-[10px] text-ink-dim font-normal">(optional)</span>
        </summary>
        <div className="mt-4 space-y-4">
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
