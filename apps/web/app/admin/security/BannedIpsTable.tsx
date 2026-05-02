"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Plus } from "lucide-react";
import { Badge } from "@/components/ui/Badge";

type BannedIp = {
  bannedIpId: number;
  ipAddress: string;
  reason: string | null;
  bannedAt: string;
  expiresAt: string | null;
  bannedBy: {
    userId: number;
    username: string;
    firstName: string;
    lastName: string;
  };
};

/**
 * Phase 48 — banned-IPs admin table. Inline form at the top to add a
 * new ban; row-level Trash button to lift one. After every mutation
 * we hard-refresh so the server-rendered list re-fetches and the
 * middleware's in-memory cache picks up the change on the next
 * request hitting any API instance.
 */
export function BannedIpsTable({ initial }: { initial: BannedIp[] }) {
  const router = useRouter();
  const [ipAddress, setIpAddress] = useState("");
  const [reason, setReason] = useState("");
  const [expiresIn, setExpiresIn] = useState<"forever" | "1h" | "24h" | "7d">("forever");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function expiresAtIso(): string | null {
    if (expiresIn === "forever") return null;
    const ms =
      expiresIn === "1h" ? 60 * 60 * 1000 :
      expiresIn === "24h" ? 24 * 60 * 60 * 1000 :
      7 * 24 * 60 * 60 * 1000;
    return new Date(Date.now() + ms).toISOString();
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!ipAddress.trim() || busy) return;
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/admin/banned-ips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ipAddress: ipAddress.trim(),
          reason: reason.trim() || null,
          expiresAt: expiresAtIso(),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({} as { message?: string }));
        setError(data?.message ?? "Couldn't add the ban.");
        setBusy(false);
        return;
      }
      setIpAddress("");
      setReason("");
      setExpiresIn("forever");
      router.refresh();
    } catch {
      setError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(bannedIpId: number, ipAddress: string) {
    if (!confirm(`Lift the ban on ${ipAddress}? Requests from this IP will be allowed within ~60s.`)) {
      return;
    }
    try {
      const res = await fetch(`/api/admin/banned-ips/${bannedIpId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({} as { message?: string }));
        setError(data?.message ?? "Couldn't lift the ban.");
        return;
      }
      router.refresh();
    } catch {
      setError("Network error.");
    }
  }

  return (
    <div className="space-y-6">
      {/* Add new ban */}
      <form onSubmit={add} className="rounded-2xl surface-flat p-5 space-y-3 shadow-flat">
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <Plus className="h-4 w-4 text-metu-yellow" />
          Ban a new IP
        </div>
        <div className="grid md:grid-cols-[1fr_2fr_1fr_auto] gap-3">
          <input
            type="text"
            value={ipAddress}
            onChange={(e) => setIpAddress(e.target.value)}
            placeholder="IPv4 or IPv6"
            required
            className="rounded-lg border border-line bg-space-900 px-3 py-2 text-sm text-white placeholder:text-ink-dim focus:border-metu-yellow outline-none"
          />
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason (optional, e.g. mass account creation)"
            className="rounded-lg border border-line bg-space-900 px-3 py-2 text-sm text-white placeholder:text-ink-dim focus:border-metu-yellow outline-none"
          />
          <select
            value={expiresIn}
            onChange={(e) => setExpiresIn(e.target.value as typeof expiresIn)}
            className="rounded-lg border border-line bg-space-900 px-3 py-2 text-sm text-white"
          >
            <option value="forever">Forever</option>
            <option value="1h">Expires in 1h</option>
            <option value="24h">Expires in 24h</option>
            <option value="7d">Expires in 7d</option>
          </select>
          <button
            type="submit"
            disabled={busy || !ipAddress.trim()}
            className="rounded-lg bg-metu-yellow text-space-black px-4 py-2 text-sm font-bold disabled:opacity-40"
          >
            {busy ? "Banning…" : "Ban IP"}
          </button>
        </div>
        {error && <p className="text-xs text-coral" role="alert">{error}</p>}
      </form>

      {/* List */}
      {initial.length === 0 ? (
        <p className="text-center text-sm text-ink-dim py-12">
          No IPs are currently banned.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-line">
          <table className="w-full text-sm">
            <thead className="bg-space-900 text-xs uppercase tracking-wider text-ink-dim">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">IP</th>
                <th className="px-4 py-3 text-left font-semibold">Reason</th>
                <th className="px-4 py-3 text-left font-semibold">Banned by</th>
                <th className="px-4 py-3 text-left font-semibold">Banned at</th>
                <th className="px-4 py-3 text-left font-semibold">Expires</th>
                <th className="px-4 py-3 text-right font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {initial.map((b) => {
                const expired = b.expiresAt && new Date(b.expiresAt) < new Date();
                return (
                  <tr key={b.bannedIpId} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-3 font-mono text-white">{b.ipAddress}</td>
                    <td className="px-4 py-3 text-ink-secondary max-w-md truncate">
                      {b.reason ?? <span className="text-ink-dim">—</span>}
                    </td>
                    <td className="px-4 py-3 text-ink-secondary">@{b.bannedBy.username}</td>
                    <td className="px-4 py-3 text-xs text-ink-dim">
                      {new Date(b.bannedAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {b.expiresAt ? (
                        expired ? (
                          <Badge variant="mist">expired</Badge>
                        ) : (
                          <span className="text-ink-secondary">{new Date(b.expiresAt).toLocaleString()}</span>
                        )
                      ) : (
                        <Badge variant="coral">forever</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => remove(b.bannedIpId, b.ipAddress)}
                        className="inline-flex items-center gap-1 rounded-md border border-coral/40 bg-coral/10 px-2 py-1 text-xs font-semibold text-coral hover:bg-coral/20"
                      >
                        <Trash2 className="h-3 w-3" />
                        Unban
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
