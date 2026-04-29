import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Building2, User as UserIcon, Hash } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { coins } from "@/lib/format";
import { apiFetch } from "@/lib/server/api";
import { WithdrawalReviewActions } from "./WithdrawalReviewActions";

export const dynamic = "force-dynamic";

interface Withdrawal {
  withdrawalId: number;
  storeId: number;
  storeName: string;
  amountCoins: number;
  feeCoins: number;
  netCoins: number;
  netBaht: string;
  bankName: string;
  bankAccountNo: string;
  bankAccountName: string;
  status: "pending" | "paid" | "rejected";
  requestedAt: string;
  reviewedBy: number | null;
  reviewedAt: string | null;
  paidProofImage: string | null;
  rejectionReason: string | null;
}

export default async function AdminWithdrawalDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const id = Number(params.id);
  if (!Number.isFinite(id)) notFound();

  const { withdrawal: w } = await apiFetch<{ withdrawal: Withdrawal }>(
    `/admin/withdrawals/${id}`,
  );

  return (
    <main id="main" className="px-8 py-8 max-w-3xl">
      <Link
        href="/admin/withdrawals"
        className="inline-flex items-center gap-1.5 text-sm text-ink-dim hover:text-metu-yellow mb-3"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to queue
      </Link>
      <PageHeader
        title={`Withdrawal #${w.withdrawalId}`}
        subtitle={`${w.storeName} · ${new Date(w.requestedAt).toLocaleString("th-TH")}`}
      />

      <div className="grid gap-6 mt-6">
        {/* Amount summary */}
        <section className="rounded-2xl border border-line bg-space-900 p-6">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-dim mb-2">
            Payout breakdown
          </h2>
          <dl className="grid grid-cols-2 gap-y-2 text-sm">
            <dt className="text-ink-dim">Coins requested</dt>
            <dd className="text-right font-mono text-white">{w.amountCoins.toLocaleString()}</dd>
            <dt className="text-ink-dim">Fee deducted</dt>
            <dd className="text-right font-mono text-coral">−{w.feeCoins.toLocaleString()}</dd>
            <dt className="text-ink-dim border-t border-line pt-2 mt-1">Net coins</dt>
            <dd className="text-right font-mono text-mint border-t border-line pt-2 mt-1">{w.netCoins.toLocaleString()}</dd>
            <dt className="text-ink-dim">Transfer amount</dt>
            <dd className="text-right font-display font-bold text-metu-yellow text-lg">฿{w.netBaht}</dd>
          </dl>
        </section>

        {/* Bank info — printable so admin can read off the screen
            into their banking app. */}
        <section className="rounded-2xl border border-line bg-space-900 p-6">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-dim mb-3">
            Transfer destination
          </h2>
          <ul className="space-y-2 text-sm">
            <li className="flex items-start gap-3">
              <Building2 className="h-4 w-4 text-metu-yellow mt-0.5 shrink-0" />
              <div>
                <div className="text-ink-dim text-xs">Bank</div>
                <div className="text-white font-medium">{w.bankName}</div>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <Hash className="h-4 w-4 text-metu-yellow mt-0.5 shrink-0" />
              <div>
                <div className="text-ink-dim text-xs">Account number</div>
                <div className="text-white font-mono tracking-wide">{w.bankAccountNo}</div>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <UserIcon className="h-4 w-4 text-metu-yellow mt-0.5 shrink-0" />
              <div>
                <div className="text-ink-dim text-xs">Account holder</div>
                <div className="text-white font-medium">{w.bankAccountName}</div>
              </div>
            </li>
          </ul>
        </section>

        {/* Already-reviewed status */}
        {w.status === "paid" && (
          <section className="rounded-2xl border border-mint/30 bg-mint/5 p-6">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <div className="font-display font-bold text-mint">Approved + paid</div>
                <div className="text-xs text-ink-dim">
                  {w.reviewedAt && `Reviewed ${new Date(w.reviewedAt).toLocaleString("th-TH")}`}
                </div>
              </div>
              <Link
                href={`/admin/users/${w.reviewedBy}`}
                className="text-xs text-metu-yellow hover:underline"
              >
                Reviewer #{w.reviewedBy}
              </Link>
            </div>
            {w.paidProofImage && (
              <div className="mt-4">
                <div className="text-xs font-semibold uppercase tracking-wider text-ink-dim mb-2">
                  Bank-transfer slip
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={w.paidProofImage}
                  alt="Bank transfer slip"
                  className="max-w-md rounded-xl border border-line object-contain bg-black/40"
                />
              </div>
            )}
          </section>
        )}

        {w.status === "rejected" && (
          <section className="rounded-2xl border border-coral/30 bg-coral/5 p-6">
            <div className="font-display font-bold text-coral mb-1">Rejected</div>
            <div className="text-xs text-ink-dim">
              {w.reviewedAt && `Reviewed ${new Date(w.reviewedAt).toLocaleString("th-TH")}`}
            </div>
            {w.rejectionReason && (
              <div className="mt-2 text-sm text-coral/90">
                Reason: {w.rejectionReason}
              </div>
            )}
            <div className="mt-2 text-xs text-ink-dim">
              Coins ({coins(w.amountCoins)}) returned to the store's balance.
            </div>
          </section>
        )}

        {/* Action panel — only renders for pending requests. */}
        {w.status === "pending" && (
          <WithdrawalReviewActions withdrawalId={w.withdrawalId} />
        )}
      </div>
    </main>
  );
}
