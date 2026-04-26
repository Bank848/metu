import Image from "next/image";
import { Users, Store, Package, ShoppingBag, Banknote, Clock } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { Badge } from "@/components/ui/Badge";
import { RevenueChart } from "@/components/admin/RevenueChart";
import { TransactionActions } from "@/components/admin/TransactionActions";
import { apiAuth } from "@/lib/session";
import { money } from "@/lib/format";
import { isDataUrl } from "@/lib/utils";

type Stats = {
  users: number; stores: number; products: number; reviews: number; orders: number;
  gmv: number; pendingOrders: number;
  recentTransactions: Array<{
    transactionId: number;
    transactionType: string;
    totalAmount: string | number;
    date: string;
    user: { username: string; firstName: string; lastName: string; profileImage: string | null };
  }>;
  daily: Array<{ day: string; revenue: number; orderCount: number }>;
};

export const dynamic = "force-dynamic";

export default async function AdminOverview() {
  const stats = await apiAuth<Stats>("/admin/stats");
  if (!stats) return <p>Failed to load</p>;

  return (
    <>
      {/* Wave-3: editorial hero card mirrors the seller dashboard — gives
          the admin overview a magazine-style anchor instead of a bare
          PageHeader floating above the stats grid. */}
      <div className="surface-editorial rounded-3xl px-6 py-6 md:px-8 md:py-8 mb-6">
        <PageHeader
          title="Marketplace overview"
          subtitle="A bird's-eye view of activity across the platform."
        />
      </div>

      {/* Wave-3: GMV is the lead stat — `highlight` variant pulls it out
          of the row. Other stats stay default. */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard variant="highlight" icon={Banknote} label="GMV (paid)" value={money(stats.gmv)} />
        <StatCard icon={Users} label="Users" value={stats.users} />
        <StatCard icon={Store} label="Stores" value={stats.stores} />
        <StatCard icon={Package} label="Products" value={stats.products} />
        <StatCard icon={ShoppingBag} label="Orders" value={stats.orders} />
        <StatCard icon={Clock} label="Pending orders" value={stats.pendingOrders} />
      </div>

      <div className="mb-6">
        <RevenueChart data={stats.daily} />
      </div>

      <section className="rounded-2xl border border-line bg-space-850">
        <div className="px-6 py-4 border-b border-line flex items-center justify-between">
          <h2 className="font-display font-bold text-white">Recent transactions</h2>
          <span className="text-xs text-ink-dim font-mono">{stats.recentTransactions.length} most recent</span>
        </div>
        <ul className="divide-y divide-line max-h-[640px] overflow-y-auto">
          {stats.recentTransactions.map((tx) => (
            <li key={tx.transactionId} className="px-6 py-4 flex items-center gap-4">
              <div className="relative h-9 w-9 rounded-full bg-brand-yellow overflow-hidden shrink-0">
                {tx.user.profileImage && <Image src={tx.user.profileImage} alt="" fill sizes="36px" className="object-cover" unoptimized={isDataUrl(tx.user.profileImage)} />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-white">
                  {tx.user.firstName} {tx.user.lastName}
                  <span className="text-ink-dim font-normal"> · @{tx.user.username}</span>
                </div>
                <div className="text-xs font-mono text-ink-dim">
                  TX #{tx.transactionId} · {new Date(tx.date).toLocaleString()}
                </div>
              </div>
              <Badge variant={tx.transactionType === "refund" ? "purple" : tx.transactionType === "payout" ? "info" : "success"}>
                {tx.transactionType}
              </Badge>
              <div className="font-display font-bold text-brand-yellow">{money(Number(tx.totalAmount))}</div>
              <TransactionActions
                transactionId={tx.transactionId}
                type={tx.transactionType}
                buyerName={`${tx.user.firstName} ${tx.user.lastName}`}
              />
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
