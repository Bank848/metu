"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Trash2, ShieldCheck, Store, User } from "lucide-react";
import { ActionRow, type ActionRowItem } from "./ActionRow";

type Role = "buyer" | "seller" | "admin";

/**
 * Phase 10 / Step 3b — repackaged as an `<ActionRow>` dropdown.
 *
 * The bespoke role-select + trash-button cluster is replaced with a
 * three-dots menu that exposes:
 *   - "Make admin" / "Make seller" / "Make buyer"  (current role disabled)
 *   - "Delete user"                                (destructive / coral)
 *
 * The role-change and delete API calls are IDENTICAL to the previous
 * implementation — only the trigger UI changed. Self-row protection is
 * still respected (every action is `disabled` when `isSelf`).
 *
 * Errors used to render inline next to the buttons; now they surface as
 * a small badge above the dropdown so the dropdown trigger stays the
 * same width across rows.
 */
export function UserRowActions({
  userId,
  currentRole,
  username,
  isSelf,
}: {
  userId: number;
  currentRole: Role;
  username: string;
  isSelf: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<"role" | "delete" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function changeRole(role: Role) {
    if (role === currentRole) return;
    setError(null);
    setBusy("role");
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ role }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.message ?? "Failed to update role");
        setBusy(null);
        return;
      }
      router.refresh();
    } catch {
      setError("Network error");
    }
    setBusy(null);
  }

  async function remove() {
    setError(null);
    setBusy("delete");
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.message ?? "Failed to delete user");
        setBusy(null);
        return;
      }
      router.refresh();
    } catch {
      setError("Network error");
    }
    setBusy(null);
  }

  const disabled = isSelf || busy !== null;

  const actions: ActionRowItem[] = [
    {
      label: "Make admin",
      icon: ShieldCheck,
      tone: "primary",
      onClick: () => changeRole("admin"),
      disabled: disabled || currentRole === "admin",
    },
    {
      label: "Make seller",
      icon: Store,
      tone: "safe",
      onClick: () => changeRole("seller"),
      disabled: disabled || currentRole === "seller",
    },
    {
      label: "Make buyer",
      icon: User,
      onClick: () => changeRole("buyer"),
      disabled: disabled || currentRole === "buyer",
    },
    {
      label: "Delete user",
      icon: Trash2,
      tone: "destructive",
      onClick: remove,
      confirm: `Delete @${username}? This wipes their account, store, reviews, and orders.`,
      disabled,
    },
  ];

  return (
    <div className="inline-flex flex-col items-end gap-1">
      <ActionRow
        actions={actions}
        ariaLabel={isSelf ? "Self row — actions disabled" : `Actions for ${username}`}
      />
      {error && (
        <span className="text-[10px] text-coral max-w-[160px] truncate" title={error}>
          {error}
        </span>
      )}
    </div>
  );
}
