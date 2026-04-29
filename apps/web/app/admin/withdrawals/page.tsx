import Link from "next/link";
import { Banknote, Clock, CheckCircle2, XCircle } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { coins } from "@/lib/format";
import { apiFetch } from "@/lib/server/api";

export const dynamic = "force-dynamic";

interface WithdrawalRow {
  withdrawalId: number;
  storeId: number;
  storeName: string;
  amountCoins: number;
  feeCoins: number;
  netCoins: number;
  netBaht: string;
  bankName: string;
  status: "pending" | "paid" | "rejected";
  requestedAt: string;
  reviewedAt: string | null;
  rejectionReason: string | null;
}

const STATUS_BADGE: Record<WithdrawalRow["status"], { icon: typeof Clock; cls: string; label: string }> = {
  pending:  { icon: Clock,         cls: "bg-amber-400/15 text-amber-200 border-amber-400/30", label: "Pending" },
  paid:     { icon: CheckCircle2,  cls: "bg-mint/15 text-mint border-mint/30",                 label: "Paid" },
  rejected: { icon: XCircle,       cls: "bg-coral/15 text-coral border-coral/30",              label: "Rejected" },
};

/**
 * Phase 20.2 — admin withdrawal queue.
 *
 * Default view is `?status=pending` (oldest-first FIFO so admin
 * works through the queue in order). The "View all" tab flips to
 * full history sorted newest-first for audit lookups.
 */
export default async function AdminWithdrawalsPage({
  searchParams,
}: {
  searchParams?: { status?: string };
}) {
  const status = searchParams?.status === "all" ? "all" : "pending";
  const data = await apiFetch<{ withdrawals: WithdrawalRow[] }>(
    `/admin/withdrawals?status=${status}`,
  );

  return (
    <main id="main" className="px-8 py-8 max-w-5xl">
      <PageHeader
        title="Withdrawal review"
        subtitle="Sellers cash out their accumulated coin earnings here. Coins are deducted at request time; approval just records the bank-transfer slip."
      />

      {/* Tab nav — pending vs all-history */}
      <div className="mt-4 mb-6 flex items-center gap-1 border-b border-line">
        <Link
          href="/admin/withdrawals?status=pending"
          className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition ${
            status === "pending"
              ? "border-metu-yellow text-metu-yellow"
              : "border-transparent text-ink-dim hover:text-white"
          }`}
        >
          Pending queue
        </Link>
        <Link
          href="/admin/withdrawals?status=all"
          className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition ${
            status === "all"
              ? "border-metu-yellow text-metu-yellow"
              : "border-transparent text-ink-dim hover:text-white"
          }`}
        >
          All history
        </Link>
      </div>

      {data.withdrawals.length === 0 ? (
        <EmptyState
          title={status === "pending" ? "Inbox zero — no pending withdrawals" : "No withdrawals yet"}
          description={
            status === "pending"
              ? "Every request has been resolved. Check All history for the audit trail."
              : "Sellers haven't submitted any payout requests yet."
          }
          icon={<Banknote className="h-8 w-8" />}
        />
      ) : (
        <ul className="space-y-3">
          {data.withdrawals.map((w) => {
            const badge = STATUS_BADGE[w.status];
            const Icon = badge.icon;
            return (
              <li key={w.withdrawalId}>
                <Link
                  href={`/admin/withdrawals/${w.withdrawalId}`}
                  className="block rounded-2xl border border-line bg-space-900 p-5 hover:border-metu-yellow/50 transition"
                >
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="min-w-0">
                      <div className="font-display text-lg font-bold text-white">
                        {w.storeName}{" "}
                        <span className="text-sm font-normal text-ink-dim">
                          · #{w.withdrawalId}
                        </span>
                      </div>
                      <div className="text-sm text-ink-secondary">
                        {coins(w.amountCoins)} → ฿{w.netBaht}
                        {w.feeCoins > 0 && (
                          <span className="text-ink-dim">
                            {" "}(fee {coins(w.feeCoins)})
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-ink-dim mt-0.5">
                        Bank: {w.bankName} · Requested{" "}
                        {new Date(w.requestedAt).toLocaleString("th-TH")}
                      </div>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold ${badge.cls}`}
                    >
                      <Icon className="h-3 w-3" />
                      {badge.label}
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
