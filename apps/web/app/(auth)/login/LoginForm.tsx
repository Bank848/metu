"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";

export function LoginForm({ next }: { next?: string }) {
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

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error === "InvalidCredentials" ? "Invalid email or password" : "Login failed");
        setBusy(false);
        return;
      }
      // Drop the spinner immediately — Next.js router.push triggers the navigation,
      // which itself revalidates the new route. router.refresh() afterwards is a
      // no-op cost on the same destination.
      setBusy(false);
      router.push(next ?? "/");
    } catch {
      setError("Network error");
      setBusy(false);
    }
  }

  return (
    <form
      ref={formRef}
      onSubmit={onSubmit}
      className="rounded-2xl bg-space-850 border border-line p-6 max-w-md"
    >
      <label className="block text-sm font-semibold text-white mb-1">Email</label>
      <input
        name="email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full rounded-xl border border-line bg-space-900 px-4 py-2.5 mb-4 text-white placeholder:text-ink-dim focus:border-brand-yellow outline-none"
        required
        autoComplete="email"
      />
      <label className="block text-sm font-semibold text-white mb-1">Password</label>
      <input
        name="password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="w-full rounded-xl border border-line bg-space-900 px-4 py-2.5 mb-2 text-white focus:border-brand-yellow outline-none"
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
