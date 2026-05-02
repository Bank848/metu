"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, AlertTriangle } from "lucide-react";

/**
 * Phase 48 — GDPR self-delete card on /profile/edit.
 *
 * Two-step flow: the user clicks "Delete my account" to expand the
 * confirmation form, then types their username to enable the
 * destructive button. Submits DELETE /api/auth/me; the server
 * handles the hybrid hard-delete vs anonymise branch internally.
 *
 * On success: redirect to /login (the cookie is cleared API-side).
 */
export function DeleteAccountSection({ username }: { username: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const matches = confirmation.trim() === username;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!matches || busy) return;
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/auth/me", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ confirmation: confirmation.trim() }),
      });
      const data = await res.json().catch(() => ({} as { message?: string }));
      if (!res.ok) {
        setError(data?.message ?? `Couldn't delete the account (HTTP ${res.status}).`);
        setBusy(false);
        return;
      }
      // Cookie cleared server-side; nothing left to do but bounce out.
      router.push("/login?reason=account-deleted");
      // Hard nav as a fallback in case router.push is intercepted.
      setTimeout(() => {
        if (typeof window !== "undefined") {
          window.location.href = "/login?reason=account-deleted";
        }
      }, 250);
    } catch {
      setError("Network error. Try again in a moment.");
      setBusy(false);
    }
  }

  return (
    <section className="mt-8 rounded-2xl border border-red-500/30 bg-red-500/5 p-6">
      <h2 className="font-display text-base font-bold text-red-200 mb-1 flex items-center gap-2">
        <AlertTriangle className="h-4 w-4" />
        Delete account
      </h2>
      <p className="text-sm text-red-100/80 mb-4">
        Removes your account from METU. Sessions, password, and personal
        info (name, email, phone, profile image) are erased immediately.
        If you have order history, your orders / reviews stay attached
        to a placeholder &quot;Deleted User&quot; row so seller analytics
        and audit trails aren&apos;t broken — but no one can identify
        you from them.
      </p>

      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 rounded-full border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-200 hover:bg-red-500/20 transition"
        >
          <Trash2 className="h-4 w-4" />
          Delete my account…
        </button>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wider text-red-200/80">
              Type your username (<code className="text-red-200">{username}</code>) to confirm
            </span>
            <input
              type="text"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              className="mt-1 w-full rounded-lg border border-red-500/30 bg-space-900 px-3 py-2 text-sm text-white focus:border-red-400 outline-none"
              placeholder={username}
            />
          </label>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={!matches || busy}
              className="inline-flex items-center gap-2 rounded-full bg-red-500 text-space-950 px-4 py-2 text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-red-400 transition"
            >
              <Trash2 className="h-4 w-4" />
              {busy ? "Deleting…" : "Permanently delete my account"}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setConfirmation("");
                setError(null);
              }}
              disabled={busy}
              className="rounded-full border border-line bg-space-900 px-4 py-2 text-sm font-semibold text-ink-secondary hover:text-white transition"
            >
              Cancel
            </button>
          </div>
          {error && (
            <p className="text-xs text-red-300" role="alert">{error}</p>
          )}
        </form>
      )}
    </section>
  );
}
