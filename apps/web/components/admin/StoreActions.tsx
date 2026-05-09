"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Trash2, PauseCircle, PlayCircle, Edit3 } from "lucide-react";
import { ActionRow, type ActionRowItem } from "./ActionRow";

/**
 * same cache-busting reload helper as
 * UserRowActions (kept inline to avoid a one-function shared
 * util module). Mirrors comment there.
 */
function hardRefresh() {
  const url = new URL(window.location.href);
  url.searchParams.set("_t", Date.now().toString());
  window.location.replace(url.toString());
}

/**
 * <ActionRow> dropdown for admin store rows. Suspend/Unsuspend hides
 * the store from public surfaces but keeps the row + products intact
 * (reversible). Delete is permanent.
 */
export function StoreActions({
  storeId,
  name,
  // drives the suspend/unsuspend label + tone. When the
  // store is currently suspended (suspendedAt != null) the action
  // becomes "Resume" + safe-tone; otherwise it's "Suspend" + warning.
  suspended = false,
}: {
  storeId: number;
  name: string;
  suspended?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<"suspend" | "delete" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setError(null);
    setBusy("delete");
    try {
      const res = await fetch(`/api/admin/stores/${storeId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.message ?? "Failed to delete store");
        return;
      }
      hardRefresh();
    } catch {
      setError("Network error");
    } finally {
      setBusy(null);
    }
  }

  async function toggleSuspended() {
    setError(null);
    setBusy("suspend");
    try {
      const res = await fetch(`/api/admin/stores/${storeId}/suspend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ value: !suspended }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.message ?? "Failed to update suspended state");
        return;
      }
      hardRefresh();
    } catch {
      setError("Network error");
    } finally {
      setBusy(null);
    }
  }

  const actions: ActionRowItem[] = [
    {
      // New: drill into the admin store detail page (which exposes
      // store info edit + per-product edit). Edit is the primary
      // operational action so it sits at the top of the dropdown.
      label: "Edit store + products",
      icon: Edit3,
      tone: "primary",
      onClick: () => router.push(`/admin/stores/${storeId}`),
      disabled: busy !== null,
    },
    {
      label: suspended ? "Resume store" : "Suspend store",
      icon: suspended ? PlayCircle : PauseCircle,
      tone: suspended ? "safe" : "primary",
      onClick: toggleSuspended,
      confirm: suspended
        ? `Resume "${name}"? It'll appear on /browse + storefront immediately.`
        : `Suspend "${name}"? It disappears from /browse + storefront immediately. Reversible — vs Delete which is permanent.`,
      disabled: busy !== null,
    },
    {
      label: "Delete store",
      icon: Trash2,
      tone: "destructive",
      onClick: remove,
      confirm: `Delete store "${name}"? Cascades to all of its products, coupons, and reviews.`,
      disabled: busy !== null,
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
