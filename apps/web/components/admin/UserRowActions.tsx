"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Trash2, ShieldCheck, Store, User } from "lucide-react";
import { ActionRow, type ActionRowItem } from "./ActionRow";
import { ConfirmDialog } from "@/components/forms/ConfirmDialog";

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
  // Phase 12.2 — separate dialog state from the dropdown's built-in
  // confirm. We need a reason textarea inside the dialog body which
  // ActionRow's stock confirm cannot host (it's a string, not JSX).
  const [removing, setRemoving] = useState(false);
  const [reason, setReason] = useState("");

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
      const trimmed = reason.trim();
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "DELETE",
        headers: trimmed ? { "Content-Type": "application/json" } : undefined,
        credentials: "include",
        // Body only when a reason is set — keeps the no-reason path
        // backward-compatible with any tooling that sends an empty
        // DELETE.
        body: trimmed ? JSON.stringify({ reason: trimmed }) : undefined,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.message ?? "Failed to remove user");
        setBusy(null);
        return;
      }
      // Reset dialog state after a successful submit so the next open
      // doesn't pre-fill with the previous reason.
      setReason("");
      setRemoving(false);
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
      // Phase 12.2 — relabelled "Delete user" → "Remove user" to match
      // the new dialog flow that asks for an optional ban reason.
      // Without a reason it's a soft-delete (deletedAt only); with a
      // reason it becomes a ban (deletedAt + bannedAt + bannedReason
      // populated, audit action = "user.ban").
      label: "Remove user",
      icon: Trash2,
      tone: "destructive",
      onClick: () => {
        // Open our own dialog instead of ActionRow's stock confirm so
        // we can host a textarea for the reason. ActionRow's `confirm`
        // is a string-only prop and would not let us collect input.
        setReason("");
        setError(null);
        setRemoving(true);
      },
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
      <ConfirmDialog
        open={removing}
        title={`Remove @${username}`}
        body={
          <div className="space-y-3">
            <p>
              Soft-deletes the account, hiding it from public surfaces.
              Order history, reviews, and Q&amp;A stay intact.
            </p>
            <label className="block text-xs font-semibold uppercase tracking-wider text-ink-dim">
              Reason{" "}
              <span className="font-normal normal-case text-ink-mute">
                (optional — populates ban metadata + audit log)
              </span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value.slice(0, 120))}
              placeholder="e.g. racial slur in display name"
              rows={3}
              maxLength={120}
              className="w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm text-white placeholder:text-ink-mute focus:border-mint focus:outline-none focus:ring-1 focus:ring-mint resize-none"
            />
            <div className="text-right text-[10px] text-ink-mute">
              {reason.length}/120
            </div>
          </div>
        }
        confirmLabel={busy === "delete" ? "Removing…" : reason.trim() ? "Ban user" : "Remove user"}
        tone="destructive"
        onConfirm={remove}
        onCancel={() => {
          if (busy === "delete") return;
          setRemoving(false);
          setReason("");
        }}
      />
    </div>
  );
}
