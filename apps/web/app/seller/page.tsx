import Image from "next/image";
import { DollarSign, ShoppingBag, Star, Timer, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { Badge } from "@/components/ui/Badge";
import { apiAuth } from "@/lib/session";
import { EmptyState } from "@/components/EmptyState";
import { money } from "@/lib/format";

type Stats = {
  store: { storeId: number; name: string; description: string; coverImage: string | null; stats: { rating: number; ctr: number; responseTime: number } | null };
  productCount: number;
  kpi: { paidCount: number; totalRevenue: number; fulfilledCount: number; pendingCount: number };
  dailyOrders: Array<{ day: string; count: number }>;
  topProducts: Array<{ productId: number; name: string; revenue: number; units: number }>;
  recentReviews: Array<{
    reviewId: number; rating: number; comment: string; createdAt: string;
    user: { firstName: string; lastName: string; profileImage: string | null };
    product: { name: string; productId: number };
  }>;
};

export const dynamic = "force-dynamic";

export default async function SellerOverview() {
  const stats = await apiAuth<Stats>("/seller/stats");
  if (!stats) {
    return <EmptyState title="No store data" description="Your seller data will appear here." />;
  }

  return (
    <>
      <PageHeader title={stats.store.name} subtitle={stats.store.description} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard icon={DollarSign} label="Total revenue" value={money(stats.kpi.totalRevenue)} accent="yellow" />
        <StatCard icon={ShoppingBag} label="Paid orders" value={stats.kpi.paidCount} />
        <StatCard icon={Star} label="Rating" value={((stats.store.stats?.rating ?? 0) / 10).toFixed(1) + "★"} />
        <StatCard icon={Timer} label="Response time" value={`${Math.round((stats.store.stats?.responseTime ?? 0) / 60)}h`} />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <section className="lg:col-span-2 rounded-2xl border border-line bg-space-850 p-6">
          <h2 className="font-display font-bold text-white flex items-center gap-2 mb-4">
            <TrendingUp className="h-4 w-4" />
            Orders (last 30 days)
          </h2>
          <SimpleLineChart data={stats.dailyOrders} />
        </section>

        <section className="rounded-2xl border border-line bg-space-850 p-6">
          <h2 className="font-display font-bold text-white mb-4">Top products</h2>
          {stats.topProducts.length === 0 ? (
            <p className="text-sm text-ink-dim">No sales yet.</p>
          ) : (
            <ul className="space-y-3">
              {stats.topProducts.slice(0, 5).map((p, i) => (
                <li key={p.productId} className="flex items-center gap-3">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-yellow/20 text-brand-yellow font-display font-bold text-sm">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-white truncate">{p.name}</div>
                    <div className="text-xs text-ink-dim">{money(p.revenue)} · {p.units} units</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="lg:col-span-3 rounded-2xl border border-line bg-space-850 p-6">
          <h2 className="font-display font-bold text-white mb-4">Recent reviews</h2>
          {stats.recentReviews.length === 0 ? (
            <p className="text-sm text-ink-dim">No reviews yet.</p>
          ) : (
            <ul className="space-y-3">
              {stats.recentReviews.map((r) => (
                <li key={r.reviewId} className="flex items-start gap-3 pb-3 border-b border-line last:border-none">
                  <div className="relative h-9 w-9 rounded-full bg-brand-yellow overflow-hidden shrink-0">
                    {r.user.profileImage && <Image src={r.user.profileImage} alt="" fill sizes="36px" className="object-cover" unoptimized />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-white">
                      {r.user.firstName} {r.user.lastName[0]}. <span className="text-ink-dim font-normal">· {r.product.name}</span>
                    </div>
                    <div className="flex items-center gap-0.5 mt-0.5 mb-1">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} className={`h-3 w-3 ${i < r.rating ? "fill-brand-yellow stroke-brand-yellow" : "fill-space-700 stroke-space-700"}`} />
                      ))}
                    </div>
                    <p className="text-sm text-ink-secondary">{r.comment}</p>
                  </div>
                  <Badge variant="mist" className="text-[10px]">
                    {new Date(r.createdAt).toLocaleDateString()}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}

function SimpleLineChart({ data }: { data: Array<{ day: string; count: number }> }) {
  if (data.length === 0) {
    return <div className="h-32 flex items-center justify-center text-sm text-ink-dim">No orders in the last 30 days.</div>;
  }
  const max = Math.max(...data.map((d) => d.count), 1);
  const points = data.map((d, i) => {
    const x = (i / Math.max(1, data.length - 1)) * 100;
    const y = 100 - (d.count / max) * 90;
    return `${x},${y}`;
  });
  return (
    <div className="relative h-40">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full">
        <polyline
          fill="none"
          stroke="#FBBF24"
          strokeWidth="1.5"
          points={points.join(" ")}
          vectorEffect="non-scaling-stroke"
        />
        <polyline
          fill="rgba(251, 191, 36, 0.15)"
          stroke="none"
          points={`0,100 ${points.join(" ")} 100,100`}
        />
      </svg>
      <div className="absolute bottom-0 left-0 right-0 text-[10px] text-ink-dim font-mono flex justify-between">
        <span>{data[0]?.day.toString().slice(0, 10)}</span>
        <span>{data[data.length - 1]?.day.toString().slice(0, 10)}</span>
      </div>
    </div>
  );
}
