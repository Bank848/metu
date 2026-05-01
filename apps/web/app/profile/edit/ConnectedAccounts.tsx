"use client";

/**
 * Phase 18 — Connected social accounts panel on /profile/edit.
 *
 * Three render states:
 *   1. googleEnabled=false               → "not configured" placeholder
 *   2. Google linked                     → linked-since date + Unlink button
 *   3. Not linked, googleEnabled=true    → Link button (anchor to better-auth's
 *                                          /api/auth/better/sign-in/google with
 *                                          a callbackURL back to /profile/edit)
 *
 * Linking flow is handled entirely by better-auth — the same /sign-in/google
 * endpoint that handles fresh sign-ins also links into the active session
 * when a session cookie is present on the request. No new server endpoint
 * needed for "link" — only "unlink".
 *
 * Unlink lockout guard: when `hasPassword=false`, the Unlink button is
 * disabled with an explanatory tooltip. The server also enforces this
 * (PasswordNotSet 400) — the client-side disable is just for UX.
 */
import { useEffect, useState } from "react";
import { Link2, Link2Off, AlertCircle } from "lucide-react";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";

type ConnectedAccount = {
  provider: string;
  accountRef: string;
  linkedAt: string;
};

type Props = {
  hasPassword: boolean;
};

export function ConnectedAccounts({ hasPassword }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [googleEnabled, setGoogleEnabled] = useState(false);
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [working, setWorking] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/connected-accounts");
      if (!res.ok) throw new Error("Failed to load connected accounts");
      const data = await res.json();
      setGoogleEnabled(Boolean(data.googleEnabled));
      setAccounts(data.accounts ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleUnlink() {
    if (!confirm("Unlink your Google account? You can re-link it any time.")) return;
    setWorking(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/connected-accounts/google", {
        method: "DELETE",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || body.error || "Unlink failed");
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unlink failed");
    } finally {
      setWorking(false);
    }
  }

  const google = accounts.find((a) => a.provider === "google");

  return (
    <section className="mt-8 rounded-2xl bg-space-850 border border-line p-6">
      <h2 className="font-display text-base font-bold text-white mb-1">
        Connected accounts
      </h2>
      <p className="text-sm text-ink-dim mb-4">
        Link a Google account for one-tap sign-in. You can still sign in
        with your password either way.
      </p>

      {error && (
        <div className="mb-3 rounded-lg border border-red-500/40 bg-red-500/10 p-3 flex items-start gap-2 text-sm text-red-200">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="text-sm text-ink-dim">Loading…</div>
      ) : !googleEnabled ? (
        <div className="rounded-lg border border-line bg-space-900 p-4 text-sm text-ink-dim">
          Google sign-in is not configured for this server. Ask the
          administrator to set <code className="text-metu-yellow">GOOGLE_CLIENT_ID</code>{" "}
          to enable it (see <code className="text-metu-yellow">docs/google-oauth-setup.md</code>).
        </div>
      ) : google ? (
        <div className="rounded-lg border border-line bg-space-900 p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-9 w-9 shrink-0 rounded-full bg-white/95 flex items-center justify-center">
              <GoogleGlyph />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-white">Google</div>
              <div className="text-xs text-ink-dim truncate">
                Linked {new Date(google.linkedAt).toLocaleDateString()}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={handleUnlink}
            disabled={working || !hasPassword}
            title={
              !hasPassword
                ? "Set a password first — unlinking now would lock you out."
                : "Disconnect Google from this account"
            }
            className="inline-flex items-center gap-1.5 rounded-full border border-line bg-space-850 px-3 py-1.5 text-xs font-semibold text-white hover:border-red-500/50 hover:text-red-300 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Link2Off className="h-3.5 w-3.5" />
            Unlink
          </button>
        </div>
      ) : (
        <GoogleSignInButton
          label="Link Google account"
          callbackURL="/profile/edit"
          errorCallbackURL="/profile/edit?error=oauth-failed"
          onError={(msg) => setError(msg)}
        />
      )}
    </section>
  );
}

function GoogleGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A10.997 10.997 0 0 0 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.07H2.18A10.997 10.997 0 0 0 1 12c0 1.78.43 3.46 1.18 4.94l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.83C6.71 7.31 9.14 5.38 12 5.38z"
      />
    </svg>
  );
}
