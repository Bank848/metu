"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export function RetryPaymentLink({ orderId, label }: { orderId: number; label?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function go() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/orders/${orderId}/retry`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.clientSecret) {
        setErr(data?.message ?? "Couldn't restart payment.");
        setBusy(false);
        return;
      }
      router.push(`/checkout/${orderId}?cs=${encodeURIComponent(data.clientSecret)}`);
    } catch {
      setErr("Network error.");
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-1">
      <button
        type="button"
        onClick={go}
        disabled={busy}
        className="text-metu-yellow hover:underline disabled:opacity-60 inline-flex items-center gap-1"
      >
        {busy && <Loader2 className="h-3 w-3 animate-spin" />}
        {label ?? "try again"}
      </button>
      {err && <span className="text-coral text-xs">· {err}</span>}
    </span>
  );
}
