"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Pause, Play } from "lucide-react";

/**
 * Admin-side product activate/pause toggle from /admin/stores/[storeId].
 * Hits the scoped admin endpoint (PATCH /admin/stores/:id/products/:pid
 * with body { isActive }) so the audit log records `admin.product.update`
 * with the new state. Optimistic by `router.refresh()` after the server
 * confirms.
 */
export function AdminProductToggleActiveButton({
  storeId,
  productId,
  productName,
  isActive,
}: {
  storeId: number;
  productId: number;
  productName: string;
  isActive: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(
        `/api/admin/stores/${storeId}/products/${productId}`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isActive: !isActive }),
        },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.message ?? `Toggle failed (${res.status})`);
        setBusy(false);
        return;
      }
      router.refresh();
    } catch {
      setError("Network error");
    }
    setBusy(false);
  }

  const Icon = isActive ? Pause : Play;
  const label = isActive ? "Pause" : "Activate";

  return (
    <span className="inline-flex items-center gap-1.5">
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        title={`${label} ${productName}`}
        aria-label={`${label} ${productName}`}
        className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold text-ink-secondary hover:text-metu-yellow hover:bg-white/5 disabled:opacity-40 transition"
      >
        <Icon className="h-3 w-3" />
        {busy ? "…" : label}
      </button>
      {error && (
        <span className="text-[10px] text-red-400 max-w-[140px] truncate" title={error}>
          {error}
        </span>
      )}
    </span>
  );
}
