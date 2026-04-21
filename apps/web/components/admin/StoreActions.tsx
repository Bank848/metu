"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Trash2 } from "lucide-react";

export function StoreActions({ storeId, name }: { storeId: number; name: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    if (!window.confirm(`Delete store "${name}"? Cascades to all of its products, coupons, and reviews.`)) return;
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/stores/${storeId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.message ?? "Failed to delete store");
        setBusy(false);
        return;
      }
      router.refresh();
    } catch {
      setError("Network error");
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={remove}
        disabled={busy}
        className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 hover:border-metu-red/40 hover:text-metu-red px-3 py-1 text-xs font-semibold text-ink-secondary transition disabled:opacity-50"
      >
        <Trash2 className="h-3 w-3" />
        {busy ? "Deleting…" : "Delete store"}
      </button>
      {error && <span className="text-[10px] text-red-400 max-w-[200px] truncate" title={error}>{error}</span>}
    </div>
  );
}
