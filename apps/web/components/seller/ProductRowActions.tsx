"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { Pencil, Trash2, Copy, Pause, Play } from "lucide-react";
import { ConfirmDialog } from "@/components/forms/ConfirmDialog";

/**
 * Row-level actions for /seller/products: pause/unpause toggle, edit
 * link, duplicate, delete. Delete cascades through the API (products
 * with sales return 409 HasSales and surface a friendly toast). Pause
 * is the soft alternative — keeps order history intact, just hides
 * the product from the public catalogue.
 */
export function ProductRowActions({
  productId,
  productName,
  isActive,
}: {
  productId: number;
  productName: string;
  isActive: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<null | "pause" | "duplicate" | "delete">(null);
  const [error, setError] = useState<string | null>(null);
  // Phase 11 / F19 — open the in-page confirm modal before delete.
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function togglePause() {
    setError(null);
    setBusy("pause");
    try {
      const res = await fetch(`/api/seller/products/${productId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ isActive: !isActive }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.message ?? "Update failed");
        setBusy(null);
        return;
      }
      router.refresh();
    } catch {
      setError("Network error");
    }
    setBusy(null);
  }

  async function duplicate() {
    setError(null);
    setBusy("duplicate");
    try {
      const res = await fetch(`/api/seller/products/${productId}/duplicate`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.message ?? "Duplicate failed");
        setBusy(null);
        return;
      }
      const data = await res.json();
      // Drop the user straight into the new copy's edit form.
      router.push(`/seller/products/${data.productId}/edit`);
    } catch {
      setError("Network error");
    }
    setBusy(null);
  }

  async function remove() {
    setConfirmDelete(false);
    setError(null);
    setBusy("delete");
    try {
      const res = await fetch(`/api/seller/products/${productId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.message ?? "Delete failed");
        setBusy(null);
        return;
      }
      router.refresh();
    } catch {
      setError("Network error");
    }
    setBusy(null);
  }

  return (
    <div className="flex items-center gap-1.5 justify-end">
      <button
        type="button"
        onClick={togglePause}
        disabled={busy !== null}
        title={isActive ? "Hide from public catalogue" : "Make visible to buyers"}
        className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 hover:border-metu-yellow/40 hover:text-metu-yellow px-2.5 py-1 text-[11px] font-semibold text-ink-secondary transition disabled:opacity-50"
      >
        {isActive ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
        {busy === "pause" ? "…" : isActive ? "Pause" : "Unpause"}
      </button>
      <button
        type="button"
        onClick={duplicate}
        disabled={busy !== null}
        title="Create a paused copy of this product"
        className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 hover:border-metu-yellow/40 hover:text-metu-yellow px-2.5 py-1 text-[11px] font-semibold text-ink-secondary transition disabled:opacity-50"
      >
        <Copy className="h-3 w-3" />
        {busy === "duplicate" ? "…" : "Duplicate"}
      </button>
      <Link
        href={`/seller/products/${productId}/edit`}
        className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 hover:border-metu-yellow/40 hover:text-metu-yellow px-2.5 py-1 text-[11px] font-semibold text-ink-secondary transition"
      >
        <Pencil className="h-3 w-3" />
        Edit
      </Link>
      <button
        type="button"
        onClick={() => setConfirmDelete(true)}
        disabled={busy !== null}
        title="Delete product"
        className="rounded-full p-1.5 text-ink-dim hover:text-metu-red hover:bg-white/5 disabled:opacity-30"
        aria-label={`Delete ${productName}`}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
      {error && (
        <span className="text-[10px] text-red-400 max-w-[160px] truncate" title={error}>
          {error}
        </span>
      )}
      <ConfirmDialog
        open={confirmDelete}
        title={`Delete "${productName}"?`}
        body='This removes all its variants, images, and reviews. If the product has sales history use "Pause" instead.'
        confirmLabel="Delete product"
        tone="destructive"
        onConfirm={remove}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
