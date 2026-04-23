"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Trash2 } from "lucide-react";
import { ActionRow, type ActionRowItem } from "./ActionRow";

/**
 * Phase 10 / Step 3b — repackaged as an `<ActionRow>` dropdown.
 *
 * The DELETE call signature is identical to the previous version. Only
 * the trigger UI changed (inline pill button → three-dots menu) so the
 * /admin/stores table looks like /admin/users + /admin/audit.
 */
export function StoreActions({ storeId, name }: { storeId: number; name: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
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

  const actions: ActionRowItem[] = [
    {
      label: "Delete store",
      icon: Trash2,
      tone: "destructive",
      onClick: remove,
      confirm: `Delete store "${name}"? Cascades to all of its products, coupons, and reviews.`,
      disabled: busy,
    },
  ];

  return (
    <div className="inline-flex flex-col items-end gap-1">
      <ActionRow actions={actions} ariaLabel={`Actions for ${name}`} />
      {error && (
        <span className="text-[10px] text-coral max-w-[200px] truncate" title={error}>
          {error}
        </span>
      )}
    </div>
  );
}
