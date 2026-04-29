import { redirect } from "next/navigation";
import { Wallet, ArrowDownToLine, ArrowUpFromLine, Gift, RefreshCcw } from "lucide-react";
import { TopNav } from "@/components/TopNav";
import { Footer } from "@/components/Footer";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { coins } from "@/lib/format";
import { getMe } from "@/lib/session";
import { safeGetSettings } from "@/lib/settings";
import { apiFetch } from "@/lib/server/api";
import { TopupModal } from "./TopupModal";

export const dynamic = "force-dynamic";
export const metadata = { title: "Wallet — METU" };

interface WalletTx {
  id: number;
  type: "topup" | "spend" | "refund" | "grant";
  amount: number;
  balanceAfter: number;
  reference: string | null;
  meta: Record<string, unknown> | null;
  createdAt: string;
}

interface WalletData {
  balance: number;
  transactions: WalletTx[];
}

const TYPE_META: Record<WalletTx["type"], { label: string; icon: typeof ArrowDownToLine; tone: string }> = {
  topup:  { label: "Top-up",      icon: ArrowDownToLine, tone: "text-mint" },
  spend:  { label: "Purchase",    icon: ArrowUpFromLine, tone: "text-coral" },
  refund: { label: "Refund",      icon: RefreshCcw,      tone: "text-mint" },
  grant:  { label: "Admin grant", icon: Gift,            tone: "text-metu-yellow" },
};

export default async function WalletPage() {
  const [me, settings] = await Promise.all([getMe(), safeGetSettings()]);
  if (!me) redirect("/login?next=/wallet");

  const data = await apiFetch<WalletData>("/wallet/transactions?limit=50");

  return (
    <>
      <TopNav />
      <main id="main" className="mx-auto max-w-3xl px-6 py-10">
        <PageHeader
          title="Your wallet"
          subtitle={
            settings.walletEnabled
              ? "Coins are spent at checkout. Top up via PromptPay below."
              : "Wallet is currently in demo mode (admin disabled the balance check). You can browse the ledger and top up; coins won't be deducted at checkout."
          }
        />

        {/* Balance card — hand-tuned, NOT a generic StatCard */}
        <section className="mt-6 rounded-3xl border border-metu-yellow/30 bg-gradient-to-br from-metu-yellow/15 via-metu-yellow/5 to-transparent p-7 shadow-floating relative overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full opacity-40"
            style={{ background: "radial-gradient(circle, rgba(212,168,75,0.4), transparent 65%)" }}
          />
          <div className="relative flex items-end justify-between gap-6 flex-wrap">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-metu-yellow mb-2">
                <Wallet className="h-3.5 w-3.5" />
                Current balance
              </div>
              <div className="font-display text-5xl font-extrabold text-white tabular-nums">
                {coins(data.balance)}
              </div>
              <div className="text-xs text-ink-dim mt-1">
                1฿ = 10 coins · Min top-up 20฿ · Max 50,000฿ per request
              </div>
            </div>
            <TopupModal walletEnabled={settings.walletEnabled} />
          </div>
        </section>

        <section className="mt-8">
          <h2 className="font-display text-base font-bold text-white mb-3">
            Recent activity
          </h2>
          {data.transactions.length === 0 ? (
            <EmptyState
              title="No wallet activity yet"
              description="Top up coins to get started, or wait for an admin grant."
              icon={<Wallet className="h-8 w-8" />}
            />
          ) : (
            <ul className="rounded-2xl border border-line bg-space-900 divide-y divide-line/60 overflow-hidden">
              {data.transactions.map((t) => {
                const meta = TYPE_META[t.type];
                const Icon = meta.icon;
                const sign = t.amount > 0 ? "+" : "";
                return (
                  <li key={t.id} className="flex items-center gap-4 px-5 py-4">
                    <div className={`shrink-0 h-10 w-10 rounded-full bg-white/5 flex items-center justify-center ${meta.tone}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-white text-sm flex items-center gap-2">
                        {meta.label}
                        {t.reference && (
                          <span className="text-xs font-mono text-ink-dim">{t.reference}</span>
                        )}
                      </div>
                      <div className="text-xs text-ink-dim mt-0.5">
                        {new Date(t.createdAt).toLocaleString("th-TH")}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className={`font-display font-bold tabular-nums ${t.amount > 0 ? "text-mint" : "text-coral"}`}>
                        {sign}
                        {coins(Math.abs(t.amount)).replace(/Free/i, "0 coins")}
                      </div>
                      <div className="text-xs text-ink-dim mt-0.5 tabular-nums">
                        Bal {coins(t.balanceAfter)}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </main>
      <Footer />
    </>
  );
}
