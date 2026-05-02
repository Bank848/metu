"use client";
import { useState } from "react";
import { Trash2, ShieldCheck, Store, User, KeyRound, ShieldOff } from "lucide-react";
import { ActionRow, type ActionRowItem } from "./ActionRow";
import { ConfirmDialog } from "@/components/forms/ConfirmDialog";

type Role = "buyer" | "seller" | "admin";

/**
 * Phase 45 follow-up — `window.location.reload()` was sometimes
 * returning a cached page (the user reported "Remove user" on
 * /admin/users wrote an audit log row but the deleted user kept
 * showing in the table even after the reload). Bumping a `_t`
 * cache-bust query param + `location.replace()` forces every layer
 * (browser HTTP cache, Next router cache, Fly.io edge if any) to
 * treat it as a brand new URL and re-fetch from origin.
 */
function hardRefresh() {
  const url = new URL(window.location.href);
  url.searchParams.set("_t", Date.now().toString());
  window.location.replace(url.toString());
}

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
  // Phase 15.5 — drives the Force-reset action label (set vs clear)
  // and disables the menu item when toggling against the same value.
  requirePasswordReset = false,
  // Phase 48 — when true, the row swaps "Remove user" for "Unban".
  // Banned users are already soft-deleted, so the destructive
  // re-removal action is meaningless; "Unban" is the actual reversal.
  isBanned = false,
}: {
  userId: number;
  currentRole: Role;
  username: string;
  isSelf: boolean;
  requirePasswordReset?: boolean;
  isBanned?: boolean;
}) {
  const [busy, setBusy] = useState<"role" | "delete" | "force-reset" | "unban" | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Phase 12.2 — separate dialog state from the dropdown's built-in
  // confirm. We need a reason textarea inside the dialog body which
  // ActionRow's stock confirm cannot host (it's a string, not JSX).
  const [removing, setRemoving] = useState(false);
  const [reason, setReason] = useState("");

  async function unban() {
    setError(null);
    setBusy("unban");
    try {
      const res = await fetch(`/api/admin/users/${userId}/unban`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({} as { message?: string }));
        setError(data?.message ?? "Failed to lift the ban");
        setBusy(null);
        return;
      }
      hardRefresh();
    } catch {
      setError("Network error");
      setBusy(null);
    }
  }

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
      // Phase 45 follow-up — used to call BOTH router.refresh() AND
      // window.location.reload(); they raced and on a slow network
      // the reload sometimes fired before the server component had
      // re-rendered, leaving the badge stale on the post-reload paint.
      // A single hard reload is sufficient — `dynamic = "force-dynamic"`
      // on /admin/users + `cache: "no-store"` in apiAuth guarantee
      // the new page render reads fresh role data.
      hardRefresh();
    } catch {
      setError("Network error");
      setBusy(null);
    }
  }

  async function toggleForceReset() {
    setError(null);
    setBusy("force-reset");
    try {
      const res = await fetch(`/api/admin/users/${userId}/require-password-reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ value: !requirePasswordReset }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.message ?? "Failed to update force-reset flag");
        setBusy(null);
        return;
      }
      // Hard reload so the row's badge + dropdown labels reflect the
      // new flag value — router.refresh() alone left the menu showing
      // the old "Force password reset" label after the toggle.
      hardRefresh();
    } catch {
      setError("Network error");
    }
    setBusy(null);
  }

  async function banUserIps() {
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}/ban-ips`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ reason: `Sessions of @${username}` }),
      });
      const data = await res.json().catch(() => ({} as { message?: string; bannedCount?: number }));
      if (!res.ok) {
        setError(data?.message ?? "Couldn't ban IPs.");
        return;
      }
      hardRefresh();
    } catch {
      setError("Network error");
    }
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
      // Hard reload — the deleted row should disappear, but
      // router.refresh() alone sometimes left the dialog's
      // post-close repaint showing the old row for a beat.
      hardRefresh();
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
      // Phase 48 — confirm copy spells out the side effect: an empty
      // store is provisioned (or restored from soft-delete) so the
      // role flip actually unlocks /seller/* for the user.
      confirm:
        `Promote @${username} to seller? This will create an empty placeholder store for them (or restore their previous one if they had been demoted) so /seller/* unlocks immediately.`,
    },
    {
      label: "Make buyer",
      icon: User,
      onClick: () => changeRole("buyer"),
      disabled: disabled || currentRole === "buyer",
      // Phase 48 — soft-deletes the user's store at the same time as
      // demoting role, so the storefront stops showing on /browse and
      // their products can no longer be purchased. Re-promotion via
      // "Make seller" restores the same row.
      confirm:
        `Demote @${username} to buyer? Their store (if any) will be soft-deleted — hidden from /browse, products no longer purchasable. Reversible: promoting them back to seller restores the same store.`,
    },
    {
      // Phase 15.5 — admin force-password-reset toggle. Forces the
      // user to change their password before any other authed action
      // surfaces. Cleared on next successful change/set. Self-toggle
      // is server-side rejected; we just disable the row anyway.
      label: requirePasswordReset ? "Clear forced reset" : "Force password reset",
      icon: KeyRound,
      tone: requirePasswordReset ? "safe" : "primary",
      onClick: toggleForceReset,
      disabled,
    },
    {
      // Phase 48 — quick action: ban every IP this user has logged
      // in from. Useful when a single account spams from multiple
      // addresses. Banned IPs are listed on /admin/security and can
      // be lifted there.
      label: "Ban this user's IPs",
      icon: ShieldOff,
      tone: "destructive",
      onClick: banUserIps,
      disabled,
      confirm: `Pull every distinct IP from @${username}'s session history and add them to the IP ban list. This may also block other users on shared networks (school / office / VPN). Reason will be set to "Sessions of @${username}".`,
    },
    // Phase 48 — Banned users get an "Unban" item INSTEAD of
    // "Remove user". Re-removing a banned (already soft-deleted)
    // account is a no-op, so the actual reversal action is what
    // the operator wants.
    isBanned
      ? {
          label: "Unban user",
          icon: ShieldCheck,
          tone: "safe",
          onClick: unban,
          disabled,
          confirm: `Lift the ban on @${username}? They can sign in again immediately. The original ban reason is cleared.`,
        }
      : {
          // Phase 12.2 — relabelled "Delete user" → "Remove user" to match
          // the new dialog flow that asks for an optional ban reason.
          // Without a reason it's a soft-delete (deletedAt only); with a
          // reason it becomes a ban (deletedAt + bannedAt + bannedReason
          // populated, audit action = "user.ban").
          //
          // Phase 48 — without a reason this now hard-deletes fresh
          // accounts and anonymises accounts with order/review history.
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
