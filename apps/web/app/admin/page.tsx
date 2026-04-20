import Image from "next/image";
import { Users, Store, Package, ShoppingBag, DollarSign, Clock } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { Badge } from "@/components/ui/Badge";
import { apiAuth } from "@/lib/session";
import { money } from "@/lib/format";

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
};

export const dynamic = "force-dynamic";

export default async function AdminOverview() {
  const stats = await apiAuth<Stats>("/admin/stats");
  if (!stats) return <p>Failed to load</p>;

  return (
    <>
      <PageHeader
        title="Marketplace overview"
        subtitle="A bird's-eye view of activity across the platform."
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard icon={DollarSign} label="GMV (paid)" value={money(stats.gmv)} accent="yellow" />
        <StatCard icon={Users} label="Users" value={stats.users} />
        <StatCard icon={Store} label="Stores" value={stats.stores} />
        <StatCard icon={Package} label="Products" value={stats.products} />
        <StatCard icon={ShoppingBag} label="Orders" value={stats.orders} />
        <StatCard icon={Clock} label="Pending orders" value={stats.pendingOrders} />
      </div>

      <section className="rounded-2xl border border-line bg-space-850">
        <div className="px-6 py-4 border-b border-line">
          <h2 className="font-display font-bold text-white">Recent transactions</h2>
        </div>
        <ul className="divide-y divide-line">
          {stats.recentTransactions.map((tx) => (
            <li key={tx.transactionId} className="px-6 py-4 flex items-center gap-4">
              <div className="relative h-9 w-9 rounded-full bg-brand-yellow overflow-hidden shrink-0">
                {tx.user.profileImage && <Image src={tx.user.profileImage} alt="" fill sizes="36px" className="object-cover" unoptimized />}
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
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
