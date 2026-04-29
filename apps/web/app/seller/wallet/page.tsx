import Link from "next/link";
import { ArrowRight, Wallet as WalletIcon, Clock, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { GlassButton } from "@/components/visual/GlassButton";
import { coins } from "@/lib/format";
import { apiFetch } from "@/lib/server/api";
import { safeGetSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

interface WithdrawalRow {
  withdrawalId: number;
  storeId: number;
  storeName: string;
  amountCoins: number;
  feeCoins: number;
  netCoins: number;
  netBaht: string;
  status: "pending" | "paid" | "rejected";
  requestedAt: string;
  reviewedAt: string | null;
  rejectionReason: string | null;
}

interface StoreTxRow {
  storeTxId: number;
  type: "earn" | "withdraw" | "withdraw_reverse" | "refund_clawback" | "adjustment";
  amount: number;
  balanceAfter: number;
  reference: string | null;
  createdAt: string;
}

interface WalletData {
  storeId: number;
  storeName: string;
  coinBalance: number;
  recent: StoreTxRow[];
  pendingWithdrawals: WithdrawalRow[];
}

interface WithdrawalsListResponse {
  withdrawals: WithdrawalRow[];
}

const TYPE_LABEL: Record<StoreTxRow["type"], { label: string; tone: string }> = {
  earn:             { label: "Sale earned",           tone: "text-mint" },
  withdraw:         { label: "Withdraw requested",    tone: "text-amber-300" },
  withdraw_reverse: { label: "Withdraw refunded",     tone: "text-mint" },
  refund_clawback:  { label: "Refund clawback",       tone: "text-coral" },
  adjustment:       { label: "Admin adjustment",      tone: "text-ink-dim" },
};

/**
 * Phase 20.2 — `/seller/wallet`. Surfaces:
 *   - Big balance card + "Request withdrawal" CTA
 *   - Pending requests banner (if any) so the seller knows their
 *     coins are escrowed
 *   - Recent activity feed (50 rows from store_transaction)
 *   - History of all the seller's past withdrawals
 *
 * Auth + store gates handled at the seller layout level.
 */
export default async function SellerWalletPage() {
  const [wallet, history, settings] = await Promise.all([
    apiFetch<WalletData>("/seller/wallet"),
    apiFetch<WithdrawalsListResponse>("/seller/withdrawals"),
    safeGetSettings(),
  ]);

  const walletEnabled = settings.walletEnabled;
  const withdrawalFeePercent = settings.withdrawalFeePercent;

  return (
    <>
      <PageHeader
        title="Wallet"
        subtitle={`${wallet.storeName} — earnings + payouts`}
      />

      {!walletEnabled && (
        <div className="mb-6 rounded-xl border border-amber-400/30 bg-amber-400/10 p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-amber-400 mt-0.5 shrink-0" />
          <div className="text-sm">
            <div className="font-semibold text-amber-100 mb-0.5">
              Wallet is currently disabled
            </div>
            <div className="text-amber-100/80">
              Demo-mode checkout doesn't move coins, so this balance won't grow until an
              admin flips Wallet enabled in <Link href="/admin/settings" className="underline">/admin/settings</Link>.
              Existing balance is preserved — pending requests still process normally.
            </div>
          </div>
        </div>
      )}

      {/* Hero — balance + request CTA */}
      <section className="grid md:grid-cols-[2fr_1fr] gap-5 mb-8">
        <div className="rounded-2xl border border-line bg-gradient-to-br from-space-900 to-space-950 p-6">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-ink-dim">
            <WalletIcon className="h-3.5 w-3.5 text-metu-yellow" />
            Available balance
          </div>
          <div className="mt-2 font-display text-4xl font-bold text-metu-yellow">
            {coins(wallet.coinBalance)}
          </div>
          <div className="text-sm text-ink-secondary mt-1">
            ≈ ฿{(wallet.coinBalance / 10).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          {wallet.pendingWithdrawals.length > 0 && (
            <div className="mt-4 text-xs text-ink-dim">
              <span className="text-amber-300 font-semibold">
                {wallet.pendingWithdrawals.length} pending request
                {wallet.pendingWithdrawals.length === 1 ? "" : "s"}
              </span>{" "}
              · coins already escrowed and not part of this balance
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-line bg-space-850 p-6 flex flex-col justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-ink-dim">
              Withdrawal fee
            </div>
            <div className="font-display text-2xl font-bold text-white mt-1">
              {withdrawalFeePercent}%
            </div>
            <div className="text-xs text-ink-dim mt-1">
              Snapshotted at request time — admin changes don't shift open requests.
            </div>
          </div>
          {/* GlassButton's href branch renders as Link without
              honouring the disabled HTML attribute, so split: when
              the balance is below the 100-coin minimum, render a
              non-interactive span; otherwise the regular CTA. */}
          {wallet.coinBalance < 100 ? (
            <div
              className="mt-4 inline-flex items-center justify-center gap-2 rounded-pill px-5 py-2.5 text-sm font-semibold border border-white/10 bg-white/5 text-ink-dim cursor-not-allowed"
              title="Minimum withdrawal is 100 coins (≈ ฿10)."
            >
              Request withdrawal
              <ArrowRight className="h-4 w-4" />
            </div>
          ) : (
            <GlassButton tone="gold" href="/seller/wallet/request" className="mt-4">
              Request withdrawal
              <ArrowRight className="h-4 w-4" />
            </GlassButton>
          )}
        </div>
      </section>

      {/* Pending requests — surfaced near the top so the seller can
          see what's escrowed without scrolling through history. */}
      {wallet.pendingWithdrawals.length > 0 && (
        <section className="mb-8">
          <h2 className="font-display text-base font-bold text-white mb-3 flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-300" />
            Pending withdrawals
          </h2>
          <ul className="space-y-2">
            {wallet.pendingWithdrawals.map((w) => (
              <PendingRow key={w.withdrawalId} w={w} />
            ))}
          </ul>
        </section>
      )}

      {/* Withdrawal history (full) */}
      <section className="mb-8">
        <h2 className="font-display text-base font-bold text-white mb-3">
          Withdrawal history
        </h2>
        {history.withdrawals.length === 0 ? (
          <div className="rounded-2xl border border-line bg-space-850 p-6 text-sm text-ink-dim">
            No withdrawal requests yet.
          </div>
        ) : (
          <ul className="space-y-2">
            {history.withdrawals.map((w) => (
              <HistoryRow key={w.withdrawalId} w={w} />
            ))}
          </ul>
        )}
      </section>

      {/* Recent activity (store_transaction ledger) */}
      <section>
        <h2 className="font-display text-base font-bold text-white mb-3">
          Recent activity
        </h2>
        {wallet.recent.length === 0 ? (
          <EmptyState
            title="No coin movement yet"
            description="Earn coins from sales to see them here. Check that wallet is enabled in admin settings."
            icon={<WalletIcon className="h-8 w-8" />}
          />
        ) : (
          <table className="w-full text-sm rounded-2xl border border-line overflow-hidden">
            <thead className="bg-space-900 text-[10px] uppercase tracking-wider text-ink-dim">
              <tr>
                <th className="px-4 py-2 text-left">When</th>
                <th className="px-4 py-2 text-left">Type</th>
                <th className="px-4 py-2 text-right">Amount</th>
                <th className="px-4 py-2 text-right">Balance after</th>
              </tr>
            </thead>
            <tbody>
              {wallet.recent.map((r) => (
                <tr key={r.storeTxId} className="border-t border-line/30 bg-space-850 hover:bg-space-900/50">
                  <td className="px-4 py-2 text-ink-secondary text-[12px] font-mono">
                    {new Date(r.createdAt).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" })}
                  </td>
                  <td className={`px-4 py-2 ${TYPE_LABEL[r.type].tone}`}>
                    {TYPE_LABEL[r.type].label}
                  </td>
                  <td className={`px-4 py-2 text-right font-mono ${r.amount >= 0 ? "text-mint" : "text-coral"}`}>
                    {r.amount >= 0 ? "+" : ""}{r.amount.toLocaleString()}
                  </td>
                  <td className="px-4 py-2 text-right font-mono text-white">
                    {r.balanceAfter.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}

function PendingRow({ w }: { w: WithdrawalRow }) {
  return (
    <li className="rounded-xl border border-amber-400/30 bg-amber-400/5 p-4 flex items-center justify-between gap-4">
      <div className="min-w-0">
        <div className="font-display font-bold text-white">
          {coins(w.amountCoins)}{" "}
          <span className="text-xs font-normal text-ink-dim">
            (fee {coins(w.feeCoins)} → net ฿{w.netBaht})
          </span>
        </div>
        <div className="text-xs text-ink-dim mt-0.5">
          Requested {new Date(w.requestedAt).toLocaleString("th-TH")}
        </div>
      </div>
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/15 border border-amber-400/30 px-3 py-1 text-xs font-semibold text-amber-200">
        <Clock className="h-3 w-3" />
        Pending review
      </span>
    </li>
  );
}

function HistoryRow({ w }: { w: WithdrawalRow }) {
  const statusBadge = {
    pending:  { icon: Clock, cls: "bg-amber-400/15 text-amber-200 border-amber-400/30", label: "Pending" },
    paid:     { icon: CheckCircle2, cls: "bg-mint/15 text-mint border-mint/30",         label: "Paid" },
    rejected: { icon: XCircle, cls: "bg-coral/15 text-coral border-coral/30",           label: "Rejected" },
  }[w.status];
  const Icon = statusBadge.icon;
  return (
    <li className="rounded-xl border border-line bg-space-850 p-4 flex items-center justify-between gap-4">
      <div className="min-w-0">
        <div className="font-display font-bold text-white">
          {coins(w.amountCoins)} → ฿{w.netBaht}
        </div>
        <div className="text-xs text-ink-dim mt-0.5">
          {new Date(w.requestedAt).toLocaleString("th-TH")}
          {w.reviewedAt && (
            <>
              {" · "}
              {w.status === "paid" ? "paid" : "rejected"}{" "}
              {new Date(w.reviewedAt).toLocaleString("th-TH")}
            </>
          )}
        </div>
        {w.rejectionReason && (
          <div className="text-xs text-coral mt-1">
            Reason: {w.rejectionReason}
          </div>
        )}
      </div>
      <span className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold ${statusBadge.cls}`}>
        <Icon className="h-3 w-3" />
        {statusBadge.label}
      </span>
    </li>
  );
}
