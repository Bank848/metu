"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";

type Country = { countryId: number; name: string };

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

      {error && <p className="text-sm text-red-400">{error}</p>}
      <Button type="submit" variant="primary" size="lg" className="w-full" disabled={busy}>
        {busy ? "Creating account…" : "Create account →"}
      </Button>
    </form>
  );
}
