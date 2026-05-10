"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/forms/ConfirmDialog";

/**
 * Admin-side product delete from /admin/stores/[storeId]. Hits the
 * scoped admin endpoint (DELETE /admin/stores/:id/products/:pid) so
 * the audit log records `admin.product.delete` instead of the seller
 * action. Server returns 409 HasSales when the product has order
 * history — surfaced inline next to the icon.
 */
export function AdminProductDeleteButton({
  storeId,
  productId,
  productName,
}: {
  storeId: number;
  productId: number;
  productName: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  async function remove() {
    setOpen(false);
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(
        `/api/admin/stores/${storeId}/products/${productId}`,
        { method: "DELETE", credentials: "include" },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.message ?? `Delete failed (${res.status})`);
        setBusy(false);
        return;
      }
      router.refresh();
    } catch {
      setError("Network error");
    }
    setBusy(false);
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={busy}
        title="Delete product (admin)"
        aria-label={`Delete ${productName}`}
        className="rounded-full p-1.5 text-ink-dim hover:text-metu-red hover:bg-white/5 disabled:opacity-30 transition"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
      {error && (
        <span
          className="text-[10px] text-red-400 max-w-[140px] truncate"
          title={error}
        >
          {error}
        </span>
      )}
      <ConfirmDialog
        open={open}
        title={`Delete "${productName}"?`}
        body="This removes the product, all variants, images, and reviews. If the product has order history the server returns 409 HasSales and the action is refused — pause the product instead."
        confirmLabel="Delete product"
        tone="destructive"
        onConfirm={remove}
        onCancel={() => setOpen(false)}
      />
    </span>
  );
}
