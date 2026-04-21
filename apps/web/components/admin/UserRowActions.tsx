"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Trash2 } from "lucide-react";

type Role = "buyer" | "seller" | "admin";

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
    if (!window.confirm(`Delete @${username}? This wipes their account, store, reviews, and orders.`)) return;
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

  return (
    <div className="flex items-center gap-2 justify-end">
      <select
        value={currentRole}
        onChange={(e) => changeRole(e.target.value as Role)}
        disabled={busy !== null || isSelf}
        title={isSelf ? "Can't change your own role" : "Change role"}
        className="rounded-full border border-line bg-space-900 px-2 py-1 text-xs text-white disabled:opacity-50"
      >
        <option value="buyer">buyer</option>
        <option value="seller">seller</option>
        <option value="admin">admin</option>
      </select>
      <button
        type="button"
        onClick={remove}
        disabled={busy !== null || isSelf}
        title={isSelf ? "Can't delete yourself" : "Delete user"}
        className="rounded-full p-1.5 text-ink-dim hover:text-metu-red hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
      {error && <span className="text-[10px] text-red-400 ml-2 max-w-[160px] truncate" title={error}>{error}</span>}
    </div>
  );
}
