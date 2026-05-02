import { Shield } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { apiAuth } from "@/lib/session";
import { BannedIpsTable } from "./BannedIpsTable";

export const dynamic = "force-dynamic";

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

type ListResp = { items: BannedIp[] };

/**
 * Phase 48 — Network-layer ban admin surface. Lists every row in
 * `banned_ip` + lets the operator add or lift bans. The middleware
 * (apps/server/src/middleware/ip-ban.ts) reads this table on every
 * request and 403s blocked IPs before they reach auth.
 */
export default async function AdminSecurityPage() {
  const data =
    (await apiAuth<ListResp>("/admin/banned-ips")) ?? { items: [] };

  return (
    <>
      <PageHeader
        title="Security"
        subtitle="Network-layer abuse blocks. IPs banned here are rejected with 403 IpBanned at the API edge."
      />
      <p className="mb-4 text-sm text-ink-dim flex items-center gap-2">
        <Shield className="h-4 w-4 text-metu-yellow" />
        Bans apply to all requests from the listed IP — registration,
        login, and any authed endpoint. Bans are cached in-process for
        60 seconds, so removals take up to a minute to fully clear
        across both API machines.
      </p>
      <BannedIpsTable initial={data.items} />
    </>
  );
}
