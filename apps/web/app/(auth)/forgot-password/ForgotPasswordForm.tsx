"use client";
import { useState } from "react";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/Button";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setDone(null);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      // Always treat as success — the API responds the same whether the
      // email exists or not, so users can't enumerate accounts.
      setDone(data.message ?? "If that email is registered, a reset link is on the way.");
    } catch {
      setDone("Network error — try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="rounded-2xl bg-space-850 border border-line p-6 space-y-4">
      <label className="block">
        <span className="block text-sm font-semibold text-white mb-1">Email</span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          className="w-full rounded-xl border border-line bg-space-900 px-4 py-2.5 text-white placeholder:text-ink-dim focus:border-brand-yellow outline-none"
        />
      </label>
      {done && (
        <p className="text-sm text-green-400 inline-flex items-center gap-1.5">
          <Mail className="h-4 w-4" />
          {done}
        </p>
      )}
      <Button type="submit" variant="primary" size="lg" className="w-full" disabled={busy}>
        {busy ? "Sending…" : "Send reset link →"}
      </Button>
    </form>
  );
}
