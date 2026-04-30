"use client";
import { useState } from "react";
import { ExternalLink, Loader2, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

interface Status {
  configured: boolean;
  stripeAccountId?: string | null;
  payoutsEnabled?: boolean;
  chargesEnabled?: boolean;
}

export function OnboardingActions({ status }: { status: Status }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!status.configured) return null;

  async function startOnboarding() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/seller/stripe/onboard", {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.message ?? data?.error ?? "Could not start onboarding");
        return;
      }
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url; // Stripe-hosted onboarding
      }
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  async function refreshStatus() {
    setBusy(true);
    try {
      await fetch("/api/seller/stripe/status", { credentials: "include" });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-line bg-space-900 p-6">
      <div className="flex items-center gap-3">
        <Button type="button" variant="primary" disabled={busy} onClick={startOnboarding}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
          {status.stripeAccountId ? "Continue onboarding" : "Start onboarding"}
        </Button>
        {status.stripeAccountId && (
          <Button type="button" variant="ghost" disabled={busy} onClick={refreshStatus}>
            <RefreshCw className="h-4 w-4" />
            Refresh status
          </Button>
        )}
      </div>
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-400">
          {error}
        </p>
      )}
    </section>
  );
}
