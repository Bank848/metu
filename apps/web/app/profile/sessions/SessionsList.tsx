"use client";
import { useState } from "react";
import { Loader2, Monitor, Smartphone, AlertCircle, Trash2, Power } from "lucide-react";

interface SessionRow {
  id: number;
  createdAt: string;
  expiresAt: string;
  ipAddress: string | null;
  userAgent: string | null;
}

/**
 * Phase 23.1 — Sessions list with revoke actions.
 *
 * Two write paths:
 *   • Per-row Revoke button (disabled on the current session — the
 *     user shouldn't sign themselves out by accident from this UI).
 *   • Top-level "Sign out everywhere else" button — fires
 *     DELETE /api/auth/sessions/all-others which preserves the
 *     current session.
 *
 * Optimistic update: on success we slice the row out of state so the
 * UI doesn't blink-and-refresh. Errors restore + show a toast.
 */
export function SessionsList({
  initialSessions,
  currentSessionId,
}: {
  initialSessions: SessionRow[];
  currentSessionId: number | null;
}) {
  const [sessions, setSessions] = useState(initialSessions);
  const [busy, setBusy] = useState<"row" | "all" | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function revokeOne(id: number) {
    if (id === currentSessionId) return; // belt-and-braces — button is also disabled
    setBusy("row");
    setBusyId(id);
    setError(null);
    const prev = sessions;
    setSessions((s) => s.filter((row) => row.id !== id)); // optimistic
    try {
      const res = await fetch(`/api/auth/sessions/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || body.error || "Revoke failed");
      }
    } catch (e) {
      setSessions(prev); // rollback
      setError(e instanceof Error ? e.message : "Revoke failed");
    } finally {
      setBusy(null);
      setBusyId(null);
    }
  }

  async function revokeAllOthers() {
    if (!confirm("Sign out from every other device? This browser stays signed in.")) return;
    setBusy("all");
    setError(null);
    const prev = sessions;
    setSessions((s) => s.filter((row) => row.id === currentSessionId)); // optimistic
    try {
      const res = await fetch("/api/auth/sessions/all-others", { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || body.error || "Revoke failed");
      }
    } catch (e) {
      setSessions(prev);
      setError(e instanceof Error ? e.message : "Revoke failed");
    } finally {
      setBusy(null);
    }
  }

  const otherCount = sessions.filter((s) => s.id !== currentSessionId).length;

  return (
    <>
      {error && (
        <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 p-3 flex items-start gap-2 text-sm text-red-200">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {sessions.length > 0 && otherCount > 0 && (
        <div className="mb-4 flex items-center justify-end">
          <button
            type="button"
            onClick={revokeAllOthers}
            disabled={busy === "all"}
            className="inline-flex items-center gap-2 rounded-full border border-coral/30 bg-coral/10 px-4 py-2 text-sm font-semibold text-coral hover:bg-coral/20 transition disabled:opacity-50"
          >
            {busy === "all" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Power className="h-4 w-4" />}
            Sign out everywhere else ({otherCount})
          </button>
        </div>
      )}

      {sessions.length === 0 ? (
        <div className="rounded-2xl border border-line bg-space-850 p-6 text-sm text-ink-dim text-center">
          No active sessions. Sign in again to populate this list.
        </div>
      ) : (
        <ul className="space-y-2">
          {sessions.map((s) => {
            const isCurrent = s.id === currentSessionId;
            const ua = parseUserAgent(s.userAgent);
            return (
              <li
                key={s.id}
                className={`rounded-2xl border p-4 flex items-center justify-between gap-4 ${
                  isCurrent ? "border-mint/30 bg-mint/5" : "border-line bg-space-850"
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-9 w-9 shrink-0 rounded-full bg-space-900 border border-line flex items-center justify-center text-ink-secondary">
                    {ua.kind === "mobile" ? <Smartphone className="h-4 w-4" /> : <Monitor className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0">
                    <div className="font-display font-bold text-white">
                      {ua.label}
                      {isCurrent && (
                        <span className="ml-2 inline-flex items-center rounded-full bg-mint/15 border border-mint/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-mint">
                          Current
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-ink-dim mt-0.5">
                      {s.ipAddress ?? "unknown IP"} · started{" "}
                      {new Date(s.createdAt).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" })}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => revokeOne(s.id)}
                  disabled={isCurrent || busy !== null}
                  title={isCurrent ? "Use Sign Out instead — revoking the current session would lock this tab." : "Sign this device out"}
                  className="inline-flex items-center gap-1.5 rounded-full border border-line bg-space-900 px-3 py-1.5 text-xs font-semibold text-white hover:border-red-500/50 hover:text-red-300 transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {busy === "row" && busyId === s.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                  Revoke
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

/**
 * Pure-regex UA parser. Covers the 95% case (Chrome/Firefox/Safari/Edge
 * on Windows/Mac/iOS/Android/Linux) without a dep. For unknown UAs we
 * fall back to "Unknown browser" so the row still renders.
 */
function parseUserAgent(ua: string | null): { label: string; kind: "desktop" | "mobile" } {
  if (!ua) return { label: "Unknown browser", kind: "desktop" };

  const isMobile = /\b(Mobile|Android|iPhone|iPad|iPod)\b/.test(ua);

  let browser = "Unknown browser";
  if (/\bEdg\//.test(ua))                browser = "Edge";
  else if (/\bChrome\//.test(ua))        browser = "Chrome";
  else if (/\bFirefox\//.test(ua))       browser = "Firefox";
  else if (/\bSafari\//.test(ua))        browser = "Safari";
  else if (/\bcurl\b|Postman|vitest/i.test(ua)) browser = "API client";

  let os = "";
  if (/\bWindows\b/.test(ua))            os = "Windows";
  else if (/\bMac OS X\b|\bMacintosh\b/.test(ua)) os = "macOS";
  else if (/\bAndroid\b/.test(ua))       os = "Android";
  else if (/\biPhone\b|\biPad\b/.test(ua)) os = "iOS";
  else if (/\bLinux\b/.test(ua))         os = "Linux";

  return {
    label: os ? `${browser} on ${os}` : browser,
    kind: isMobile ? "mobile" : "desktop",
  };
}
