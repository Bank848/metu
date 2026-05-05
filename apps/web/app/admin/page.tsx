import Image from "next/image";
import Link from "next/link";
import { Users, Store, Package, ShoppingBag, Banknote, Clock, Ticket, Star, MessageSquare, TrendingUp, Tag as TagIcon } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { Badge } from "@/components/ui/Badge";
import { RevenueChart } from "@/components/admin/RevenueChart";
import { TransactionActions } from "@/components/admin/TransactionActions";
import { apiAuth } from "@/lib/session";
import { coins, thbToCoins, coinsCompact, fmtDateTime } from "@/lib/format";
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

type Dashboard = {
  growth: { totalUsers: number; buyers: number; sellers: number; admins: number; active7d: number } | null;
  topStores: Array<{ storeId: number; name: string; revenue: number; orders: number; rating: number }>;
  topProducts: Array<{ productId: number; name: string; revenue: number; units: number }>;
  ageGroups: Array<{ bucket: string; buyers: number }>;
  categories: Array<{ categoryId: number; name: string; productCount: number; revenue: number }>;
  tags: Array<{ tagId: number; tagName: string; productCount: number }>;
  couponImpact: { totalCoupons: number; activeCoupons: number; totalRedemptions: number; totalDiscount: number; nearExpiry: number } | null;
  reviewMonitor: { avgRating: number; totalReviews: number; reviews7d: number; lowRated: number } | null;
};

export const dynamic = "force-dynamic";

export default async function AdminOverview() {
  const [stats, dashboard] = await Promise.all([
    apiAuth<Stats>("/admin/stats"),
    apiAuth<Dashboard>("/admin/dashboard"),
  ]);
  if (!stats || !dashboard) return <p>Failed to load</p>;

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
        {/* Phase 11.2 — GMV is the lead admin KPI; same compact-format
            treatment as /seller's Total revenue. Hover surfaces the
            exact baht figure. */}
        <StatCard
          variant="highlight"
          icon={Banknote}
          label="GMV (paid)"
          value={coinsCompact(thbToCoins(stats.gmv))}
          valueTooltip={coins(thbToCoins(stats.gmv))}
        />
        <StatCard icon={Users} label="Users" value={stats.users} />
        <StatCard icon={Store} label="Stores" value={stats.stores} />
        <StatCard icon={Package} label="Products" value={stats.products} />
        <StatCard icon={ShoppingBag} label="Orders" value={stats.orders} />
        <StatCard icon={Clock} label="Pending orders" value={stats.pendingOrders} />
      </div>

      <div className="mb-6">
        <RevenueChart data={stats.daily} />
      </div>

      {/* User Growth + Coupon Impact + Review Monitor */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {dashboard.growth && (
          <div className="rounded-2xl border border-line bg-space-900 p-5">
            <h3 className="font-display font-bold text-white mb-3 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-mint" />
              User growth
            </h3>
            <ul className="space-y-1.5 text-sm">
              <li className="flex justify-between"><span className="text-ink-secondary">Buyers</span><span className="font-mono text-white">{dashboard.growth.buyers.toLocaleString()}</span></li>
              <li className="flex justify-between"><span className="text-ink-secondary">Sellers</span><span className="font-mono text-white">{dashboard.growth.sellers.toLocaleString()}</span></li>
              <li className="flex justify-between"><span className="text-ink-secondary">Admins</span><span className="font-mono text-white">{dashboard.growth.admins.toLocaleString()}</span></li>
              <li className="flex justify-between border-t border-line pt-1.5"><span className="text-ink-dim text-xs">Active in last 7 days</span><span className="font-mono text-mint">{dashboard.growth.active7d.toLocaleString()}</span></li>
            </ul>
          </div>
        )}
        {dashboard.couponImpact && (
          <div className="rounded-2xl border border-line bg-space-900 p-5">
            <h3 className="font-display font-bold text-white mb-3 flex items-center gap-2">
              <Ticket className="h-4 w-4 text-metu-yellow" />
              Coupon impact
            </h3>
            <ul className="space-y-1.5 text-sm">
              <li className="flex justify-between"><span className="text-ink-secondary">Total coupons</span><span className="font-mono text-white">{dashboard.couponImpact.totalCoupons}</span></li>
              <li className="flex justify-between"><span className="text-ink-secondary">Active</span><span className="font-mono text-mint">{dashboard.couponImpact.activeCoupons}</span></li>
              <li className="flex justify-between"><span className="text-ink-secondary">Redemptions</span><span className="font-mono text-white">{dashboard.couponImpact.totalRedemptions}</span></li>
              <li className="flex justify-between"><span className="text-ink-secondary">Total discount</span><span className="font-mono text-metu-yellow">{coins(thbToCoins(dashboard.couponImpact.totalDiscount))}</span></li>
              <li className="flex justify-between border-t border-line pt-1.5"><span className="text-ink-dim text-xs">Near expiry (≤7d)</span><span className="font-mono text-coral">{dashboard.couponImpact.nearExpiry}</span></li>
            </ul>
          </div>
        )}
        {dashboard.reviewMonitor && (
          <div className="rounded-2xl border border-line bg-space-900 p-5">
            <h3 className="font-display font-bold text-white mb-3 flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-info" />
              Review monitor
            </h3>
            <ul className="space-y-1.5 text-sm">
              <li className="flex justify-between"><span className="text-ink-secondary">Avg rating</span><span className="font-mono text-metu-yellow">{dashboard.reviewMonitor.avgRating.toFixed(2)}★</span></li>
              <li className="flex justify-between"><span className="text-ink-secondary">Total reviews</span><span className="font-mono text-white">{dashboard.reviewMonitor.totalReviews.toLocaleString()}</span></li>
              <li className="flex justify-between"><span className="text-ink-secondary">Last 7 days</span><span className="font-mono text-mint">{dashboard.reviewMonitor.reviews7d}</span></li>
              <li className="flex justify-between border-t border-line pt-1.5"><span className="text-ink-dim text-xs">Low-rated (≤2★)</span><span className="font-mono text-coral">{dashboard.reviewMonitor.lowRated}</span></li>
            </ul>
          </div>
        )}
      </div>

      {/* Top stores + Top products */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="rounded-2xl border border-line bg-space-900 p-5">
          <h3 className="font-display font-bold text-white mb-3 flex items-center gap-2">
            <Store className="h-4 w-4 text-metu-yellow" />
            Top stores by revenue
          </h3>
          <ol className="space-y-2 text-sm">
            {dashboard.topStores.length === 0 && <li className="text-ink-dim">No store revenue yet.</li>}
            {dashboard.topStores.map((s, i) => (
              <li key={s.storeId} className="flex items-center justify-between border-b border-line/50 pb-1.5 last:border-0">
                <span className="flex items-center gap-2">
                  <span className="text-ink-dim text-xs font-mono w-5">{i + 1}.</span>
                  <Link href={`/store/${s.storeId}`} className="text-white hover:text-metu-yellow truncate max-w-[180px]">{s.name}</Link>
                  {s.rating > 0 && <span className="text-xs text-metu-yellow font-mono">{(s.rating / 10).toFixed(1)}★</span>}
                </span>
                <span className="font-mono text-mint">{coins(thbToCoins(s.revenue))}</span>
              </li>
            ))}
          </ol>
        </div>
        <div className="rounded-2xl border border-line bg-space-900 p-5">
          <h3 className="font-display font-bold text-white mb-3 flex items-center gap-2">
            <Package className="h-4 w-4 text-mint" />
            Top products by revenue
          </h3>
          <ol className="space-y-2 text-sm">
            {dashboard.topProducts.length === 0 && <li className="text-ink-dim">No product sales yet.</li>}
            {dashboard.topProducts.map((p, i) => (
              <li key={p.productId} className="flex items-center justify-between border-b border-line/50 pb-1.5 last:border-0">
                <span className="flex items-center gap-2">
                  <span className="text-ink-dim text-xs font-mono w-5">{i + 1}.</span>
                  <Link href={`/product/${p.productId}`} className="text-white hover:text-metu-yellow truncate max-w-[200px]">{p.name}</Link>
                  <span className="text-xs text-ink-dim">×{p.units}</span>
                </span>
                <span className="font-mono text-mint">{coins(thbToCoins(p.revenue))}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>

      {/* Categories + Tags + Age groups */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="rounded-2xl border border-line bg-space-900 p-5">
          <h3 className="font-display font-bold text-white mb-3">Category analytics</h3>
          <ul className="space-y-1.5 text-sm">
            {dashboard.categories.slice(0, 8).map((c) => (
              <li key={c.categoryId} className="flex items-center justify-between">
                <span className="text-ink-secondary truncate max-w-[140px]">{c.name}</span>
                <span className="font-mono text-xs text-ink-dim">
                  {c.productCount}p · {coins(thbToCoins(c.revenue))}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl border border-line bg-space-900 p-5">
          <h3 className="font-display font-bold text-white mb-3 flex items-center gap-2">
            <TagIcon className="h-4 w-4 text-info" />
            Top tags
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {dashboard.tags.slice(0, 12).map((t) => (
              <Badge key={t.tagId} variant="mist" className="text-xs">
                {t.tagName} · {t.productCount}
              </Badge>
            ))}
            {dashboard.tags.length === 0 && <span className="text-xs text-ink-dim">No tags yet.</span>}
          </div>
        </div>
        <div className="rounded-2xl border border-line bg-space-900 p-5">
          <h3 className="font-display font-bold text-white mb-3">Age groups</h3>
          <ul className="space-y-1.5 text-sm">
            {dashboard.ageGroups.length === 0 && <li className="text-ink-dim text-xs">No buyers with DOB on file.</li>}
            {dashboard.ageGroups.map((a) => (
              <li key={a.bucket} className="flex items-center justify-between">
                <span className="text-ink-secondary">{a.bucket}</span>
                <span className="font-mono text-white">{a.buyers}</span>
              </li>
            ))}
          </ul>
        </div>
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
                  TX #{tx.transactionId} · {fmtDateTime(tx.date)}
                </div>
              </div>
              <Badge variant={tx.transactionType === "refund" ? "purple" : tx.transactionType === "payout" ? "info" : "success"}>
                {tx.transactionType}
              </Badge>
              <div className="font-display font-bold text-brand-yellow">{coins(thbToCoins(Number(tx.totalAmount)))}</div>
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
