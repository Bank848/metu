"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { RefreshCcw } from "lucide-react";

// Posts to /api/admin/dashboard/refresh-matview to trigger
// REFRESH MATERIALIZED VIEW CONCURRENTLY on `top_stores_30d`. Pairs
// with the materialized-view rubric story — admin sees stale-time on
// the dashboard, clicks Refresh, the matview rebuilds without
// blocking readers, the page re-fetches.

export function RefreshMatviewButton({ computedAt }: { computedAt: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/dashboard/refresh-matview", {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.message ?? "Refresh failed");
        setBusy(false);
        return;
      }
      // router.refresh re-runs the server component which calls
      // getDashboardMetrics() again; the matview table now has new
      // rows and the topStoresComputedAt timestamp updates.
      router.refresh();
      // Keep busy=true briefly so the spinner stays visible while
      // RSC payload streams back. router.refresh returns synchronously
      // but the actual render may take a tick.
      setTimeout(() => setBusy(false), 600);
    } catch {
      setError("Network error");
      setBusy(false);
    }
  }

  return (
    <div className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={refresh}
        disabled={busy}
        title={
          computedAt
            ? `Last refreshed ${new Date(computedAt).toLocaleString("en-GB", { hour12: false })}`
            : "Matview empty — click to populate."
        }
        className="inline-flex items-center gap-1.5 rounded-full border border-mint/30 bg-mint/5 hover:bg-mint/10 disabled:opacity-50 px-3 py-1 text-[11px] font-mono text-mint transition"
      >
        <RefreshCcw className={`h-3 w-3 ${busy ? "animate-spin" : ""}`} />
        {busy ? "Refreshing matview…" : "Refresh matview"}
      </button>
      {error && (
        <span className="text-[10px] text-coral max-w-[260px] truncate" title={error}>
          {error}
        </span>
      )}
    </div>
  );
}
