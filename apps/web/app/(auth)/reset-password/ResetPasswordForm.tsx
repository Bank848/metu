"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (pw !== confirm) {
      setError("Passwords don't match");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword: pw }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.message ?? "Couldn't reset password — link may be expired.");
        setBusy(false);
        return;
      }
      // Done — bounce them to login with a hint.
      router.push("/login?reset=1");
    } catch {
      setError("Network error");
      setBusy(false);
    }
  }

  const inputCls =
    "w-full rounded-xl border border-line bg-space-900 px-4 py-2.5 text-white focus:border-brand-yellow outline-none";

  return (
    <form onSubmit={submit} className="rounded-2xl bg-space-850 border border-line p-6 space-y-4">
      <label className="block">
        <span className="block text-sm font-semibold text-white mb-1">New password</span>
        <input
          type="password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          required
          minLength={6}
          autoComplete="new-password"
          className={inputCls}
        />
      </label>
      <label className="block">
        <span className="block text-sm font-semibold text-white mb-1">Confirm new password</span>
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          minLength={6}
          autoComplete="new-password"
          className={inputCls}
        />
      </label>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <Button type="submit" variant="primary" size="lg" className="w-full" disabled={busy}>
        {busy ? "Saving…" : "Set new password →"}
      </Button>
    </form>
  );
}
