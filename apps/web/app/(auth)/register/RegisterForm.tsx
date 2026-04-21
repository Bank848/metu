"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";

export function RegisterForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
    firstName: "",
    lastName: "",
  });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
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
    } catch {
      setError("Network error");
      setBusy(false);
    }
  }

  function field<K extends keyof typeof form>(k: K, label: string, opts: Partial<React.InputHTMLAttributes<HTMLInputElement>> = {}) {
    return (
      <label className="block">
        <span className="block text-sm font-semibold text-white mb-1">{label}</span>
        <input
          className="w-full rounded-xl border border-line bg-space-900 px-4 py-2.5 text-white placeholder:text-ink-dim focus:border-brand-yellow outline-none"
          value={form[k]}
          onChange={(e) => setForm({ ...form, [k]: e.target.value })}
          required
          {...opts}
        />
      </label>
    );
  }

  return (
    <form onSubmit={onSubmit} className="rounded-2xl bg-space-850 border border-line p-6 space-y-4">
      <div className="grid grid-cols-2 gap-4">
        {field("firstName", "First name")}
        {field("lastName", "Last name")}
      </div>
      {field("username", "Username", { minLength: 3, maxLength: 20 })}
      {field("email", "Email", { type: "email" })}
      {field("password", "Password", { type: "password", minLength: 6 })}
      {error && <p className="text-sm text-red-400">{error}</p>}
      <Button type="submit" variant="primary" size="lg" className="w-full" disabled={busy}>
        {busy ? "Creating account…" : "Create account →"}
      </Button>
    </form>
  );
}
