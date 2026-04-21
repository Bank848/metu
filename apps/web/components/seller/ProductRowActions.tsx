"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { Pencil, Trash2 } from "lucide-react";

/**
 * Row-level actions for /seller/products. Delete cascades through the
 * API (products with sales return 409 HasSales and surface a friendly
 * toast in-place). Edit just links to /seller/products/[id]/edit.
 */
export function ProductRowActions({
  productId,
  productName,
}: {
  productId: number;
  productName: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    if (!window.confirm(`Delete "${productName}"? This removes all its variants, images, and reviews.`)) return;
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/seller/products/${productId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.message ?? "Delete failed");
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
    <div className="flex items-center gap-1.5 justify-end">
      <Link
        href={`/seller/products/${productId}/edit`}
        className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 hover:border-metu-yellow/40 hover:text-metu-yellow px-2.5 py-1 text-[11px] font-semibold text-ink-secondary transition"
      >
        <Pencil className="h-3 w-3" />
        Edit
      </Link>
      <button
        type="button"
        onClick={remove}
        disabled={busy}
        title="Delete product"
        className="rounded-full p-1.5 text-ink-dim hover:text-metu-red hover:bg-white/5 disabled:opacity-30"
        aria-label={`Delete ${productName}`}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
      {error && <span className="text-[10px] text-red-400 max-w-[160px] truncate" title={error}>{error}</span>}
    </div>
  );
}
