import Link from "next/link";
import { Wallet, ExternalLink, AlertCircle } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { apiFetch, ApiError } from "@/lib/server/api";
import { fmtDate } from "@/lib/format";
import { RequestPayoutButton } from "./RequestPayoutButton";

function payoutTone(status: string): "success" | "warning" | "danger" | "mist" {
  const s = status.toLowerCase();
  if (s === "paid" || s === "succeeded" || s === "completed") return "success";
  if (s === "pending" || s === "in_transit") return "warning";
  if (s === "failed" || s === "canceled" || s === "cancelled") return "danger";
  return "mist";
}

export const dynamic = "force-dynamic";

interface BalanceEntry { amount: number; currency: string; }
interface Payout { id: string; amount: number; currency: string; status: string; arrivalDate: number; created: number; }
interface Charge { id: string; amount: number; currency: string; status: string; created: number; }
interface Requirements {
  disabledReason: string | null;
  currentlyDue: string[];
  eventuallyDue: string[];
  pastDue: string[];
  cardPaymentsActive: boolean;
  transfersActive: boolean;
}
interface Wallet {
  configured: boolean;
  onboarded?: boolean;
  message?: string;
  payoutsEnabled?: boolean;
  chargesEnabled?: boolean;
  requirements?: Requirements | null;
  balance?: { available: BalanceEntry[]; pending: BalanceEntry[] };
  payouts?: Payout[];
  charges?: Charge[];
}

/**
 * Stripe-backed seller wallet. Reads every figure live via
 * /api/seller/wallet — Stripe is the system of record, nothing is
 * materialised in our DB.
 */
export default async function SellerWalletPage() {
  const wallet = await fetchWallet();

  // Layout's <main> handles padding; wrap in <section> to avoid double-pad.
  return (
    <section className="max-w-4xl">
      <PageHeader
        title="Wallet"
        subtitle="Live balance and payout history pulled directly from Stripe — METU stores no balance data."
      />

      {!wallet.configured ? (
        <NotConfigured />
      ) : !wallet.onboarded ? (
        <NotOnboarded />
      ) : (
        <ConnectedView wallet={wallet} />
      )}
    </section>
  );
}

async function fetchWallet(): Promise<Wallet> {
  // Use apiFetch so the session cookie reaches the API.
  try {
    return await apiFetch<Wallet>("/seller/wallet");
  } catch (err) {
    if (err instanceof ApiError && err.status === 503) {
      return { configured: false };
    }
    return { configured: false };
  }
}

function NotConfigured() {
  return (
    <section className="mt-6 rounded-2xl border border-amber-400/30 bg-amber-400/5 p-6">
      <div className="flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-amber-400 mt-0.5 shrink-0" />
        <div>
          <h2 className="font-semibold text-amber-100">Stripe not configured</h2>
          <p className="text-sm text-amber-100/80 mt-1">
            The deployment is missing <code>STRIPE_SECRET_KEY</code>. Set it via flyctl secrets to enable the seller wallet.
          </p>
        </div>
      </div>
    </section>
  );
}

function NotOnboarded() {
  return (
    <section className="mt-6 rounded-2xl border border-line bg-space-900 p-6">
      <h2 className="font-semibold text-white mb-2 flex items-center gap-2">
        <Wallet className="h-4 w-4 text-mint" />
        Connect a Stripe account
      </h2>
      <p className="text-sm text-ink-secondary mb-4">
        Once Stripe approves your account, payments from buyers settle into your balance and Stripe schedules weekly payouts to your bank automatically. Refunds are clawed back from the same balance.
      </p>
      <Link href="/seller/onboarding">
        <Button variant="primary">
          <ExternalLink className="h-4 w-4" />
          Set up Stripe
        </Button>
      </Link>
    </section>
  );
}

function RestrictionsBanner({ requirements }: { requirements: Requirements }) {
  const headline =
    requirements.disabledReason === "requirements.past_due"
      ? "Stripe needs more info before you can accept payments."
      : requirements.disabledReason === "requirements.pending_verification"
      ? "Stripe is still verifying your account — payments are paused."
      : !requirements.cardPaymentsActive
      ? "Card payments aren't active on your Stripe account yet."
      : "Your Stripe account currently can't accept charges.";

  const fields = [...new Set([...requirements.pastDue, ...requirements.currentlyDue])];

  return (
    <section className="rounded-2xl border border-coral/30 bg-coral/5 p-5">
      <div className="flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-coral mt-0.5 shrink-0" />
        <div className="flex-1 space-y-2">
          <h3 className="font-semibold text-coral">{headline}</h3>
          {fields.length > 0 && (
            <div>
              <p className="text-sm text-ink-secondary">
                Stripe needs the following before card payments turn back on:
              </p>
              <ul className="mt-2 space-y-1 text-sm text-ink-secondary">
                {fields.slice(0, 8).map((f) => (
                  <li key={f} className="font-mono text-xs">• {f}</li>
                ))}
                {fields.length > 8 && (
                  <li className="text-xs text-ink-dim">…and {fields.length - 8} more</li>
                )}
              </ul>
            </div>
          )}
          <p className="text-sm text-ink-secondary">
            Open the Stripe dashboard to finish onboarding. Once done, this banner will go away
            within a minute (we listen for the <code>account.updated</code> webhook).
          </p>
          <div>
            <Link href="/seller/onboarding">
              <Button variant="primary" size="sm">
                <ExternalLink className="h-3.5 w-3.5" />
                Continue Stripe onboarding
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function ConnectedView({ wallet }: { wallet: Wallet }) {
  const totalAvailable = (wallet.balance?.available ?? []).reduce((s, b) => s + b.amount, 0);
  const totalPending = (wallet.balance?.pending ?? []).reduce((s, b) => s + b.amount, 0);
  const formatSatang = (n: number, c = "thb") => {
    const baht = n / 100;
    return baht.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " " + c.toUpperCase();
  };

  return (
    <div className="mt-6 grid gap-6">
      {/* Stripe restrictions banner — explicit list of what Stripe wants. */}
      {wallet.chargesEnabled === false && wallet.requirements && (
        <RestrictionsBanner requirements={wallet.requirements} />
      )}

      {/* Balance cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-mint/30 bg-gradient-to-br from-mint/8 to-mint/3 p-6">
          <div className="text-xs uppercase tracking-wider text-mint">Available</div>
          <div className="font-display text-3xl font-bold text-white mt-1 tabular-nums">
            ฿{formatSatang(totalAvailable)}
          </div>
          <p className="text-xs text-ink-dim mt-2">Funds that can be paid out next.</p>
          <RequestPayoutButton availableSatang={totalAvailable} />
        </div>
        <div className="rounded-2xl border border-line bg-gradient-to-br from-space-900 to-space-950 p-6">
          <div className="text-xs uppercase tracking-wider text-ink-secondary">Pending</div>
          <div className="font-display text-3xl font-bold text-white mt-1 tabular-nums">
            ฿{formatSatang(totalPending)}
          </div>
          <p className="text-xs text-ink-dim mt-2">Recently received — clears in ~7 days.</p>
        </div>
      </div>

      {/* Recent payouts */}
      <section className="rounded-2xl border border-line bg-space-900 p-6">
        <h3 className="font-semibold text-white mb-3">Recent payouts</h3>
        {(wallet.payouts ?? []).length === 0 ? (
          <p className="text-sm text-ink-dim">
            No payouts yet — funds will appear here once Stripe completes your first one.
          </p>
        ) : (
          <div className="-mx-2 overflow-x-auto px-2">
            <table className="w-full min-w-[360px] text-sm">
              <thead className="text-left text-xs uppercase tracking-wider text-ink-dim">
                <tr><th className="py-1 font-medium">Date</th><th className="py-1 font-medium">Amount</th><th className="py-1 font-medium">Status</th></tr>
              </thead>
              <tbody>
                {wallet.payouts!.map((p) => (
                  <tr key={p.id} className="border-t border-white/5">
                    <td className="py-1.5 whitespace-nowrap">{fmtDate(p.created)}</td>
                    <td className="py-1.5 font-mono tabular-nums whitespace-nowrap">{formatSatang(p.amount, p.currency)}</td>
                    <td className="py-1.5 whitespace-nowrap">
                      <Badge variant={payoutTone(p.status)} className="uppercase text-[10px]">{p.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Recent charges */}
      <section className="rounded-2xl border border-line bg-space-900 p-6">
        <h3 className="font-semibold text-white mb-3">Recent charges</h3>
        {(wallet.charges ?? []).length === 0 ? (
          <p className="text-sm text-ink-dim">
            No charges yet — your sales will show up here once buyers start checking out.
          </p>
        ) : (
          <div className="-mx-2 overflow-x-auto px-2">
            <table className="w-full min-w-[360px] text-sm">
              <thead className="text-left text-xs uppercase tracking-wider text-ink-dim">
                <tr><th className="py-1 font-medium">Date</th><th className="py-1 font-medium">Amount</th><th className="py-1 font-medium">Status</th></tr>
              </thead>
              <tbody>
                {wallet.charges!.map((c) => (
                  <tr key={c.id} className="border-t border-white/5">
                    <td className="py-1.5 whitespace-nowrap">{fmtDate(c.created)}</td>
                    <td className="py-1.5 font-mono tabular-nums whitespace-nowrap">{formatSatang(c.amount, c.currency)}</td>
                    <td className="py-1.5 whitespace-nowrap">
                      <Badge variant={payoutTone(c.status)} className="uppercase text-[10px]">{c.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
