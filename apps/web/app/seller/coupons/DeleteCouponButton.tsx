"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2 } from "lucide-react";
import { ConfirmDialog } from "@/components/forms/ConfirmDialog";

export function DeleteCouponButton({ couponId, code }: { couponId: number; code: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onConfirm() {
    setOpen(false);
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/seller/coupons/${couponId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErr(data?.message ?? data?.error ?? "Delete failed");
        setBusy(false);
        return;
      }
      router.refresh();
    } catch {
      setErr("Network error");
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={busy}
        aria-label={`Delete coupon ${code}`}
        className="inline-flex items-center gap-1 rounded-full border border-coral/30 bg-coral/5 hover:bg-coral/15 hover:border-coral/60 px-2.5 py-1 text-[11px] font-semibold text-coral transition disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
        Delete
      </button>
      {err && <p className="mt-1 text-[10px] text-coral">{err}</p>}
      <ConfirmDialog
        open={open}
        tone="destructive"
        title={`Delete coupon "${code}"?`}
        body="This is permanent. Coupons that have already been redeemed cannot be deleted — pause them via the edit screen instead."
        confirmLabel="Delete"
        onConfirm={onConfirm}
        onCancel={() => setOpen(false)}
      />
    </>
  );
}
