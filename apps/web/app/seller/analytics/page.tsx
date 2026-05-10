import Link from "next/link";
import { redirect } from "next/navigation";
import { unstable_cache } from "next/cache";
import { TrendingUp, ShoppingBag, Users, Package as PackageIcon } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { RevenueChart } from "@/components/admin/RevenueChart";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/EmptyState";
import { GlassButton } from "@/components/visual/GlassButton";
import { getMe } from "@/lib/session";
import { prisma } from "@/lib/server/prisma";
import { coins, thbToCoins, coinsCompact } from "@/lib/format";

export const dynamic = "force-dynamic";

// 5 raw queries scoped to one storeId. Cache 5 min — analytics data
// shifts on order paid events but sellers don't refresh constantly.
const getSellerAnalytics = unstable_cache(
  async (storeId: number) => {
    const [daily, statusBreakdown, perProduct, topBuyers, totals] = await Promise.all([
      prisma.$queryRaw<Array<{ day: string; revenue: string; order_count: bigint }>>`
        SELECT
          TO_CHAR(d::date, 'YYYY-MM-DD') AS day,
          COALESCE(SUM(oi.price_per_unit * oi.quantity), 0)::text AS revenue,
          COUNT(DISTINCT o.order_id) AS order_count
        FROM generate_series(
               (NOW() AT TIME ZONE 'Asia/Bangkok')::date - INTERVAL '29 days',
               (NOW() AT TIME ZONE 'Asia/Bangkok')::date,
               INTERVAL '1 day'
             ) d
        LEFT JOIN orders     o  ON (o.created_at AT TIME ZONE 'Asia/Bangkok')::date = d::date
                                AND o.status IN ('paid','fulfilled')
        LEFT JOIN order_item oi ON oi.order_id = o.order_id
        LEFT JOIN product_item pi ON pi.product_item_id = oi.product_item_id
        LEFT JOIN product p ON p.product_id = pi.product_id
        WHERE oi.order_item_id IS NULL OR p.store_id = ${storeId}
        GROUP BY d
        ORDER BY d ASC
      `,
      prisma.$queryRaw<Array<{ status: string; count: bigint }>>`
        SELECT o.status::text AS status, COUNT(DISTINCT o.order_id) AS count
        FROM orders o
        JOIN order_item oi ON oi.order_id = o.order_id
        JOIN product_item pi ON pi.product_item_id = oi.product_item_id
        JOIN product p ON p.product_id = pi.product_id
        WHERE p.store_id = ${storeId}
        GROUP BY o.status
        ORDER BY count DESC
      `,
      prisma.$queryRaw<Array<{
        product_id: number;
        name: string;
        units: bigint;
        revenue: string;
      }>>`
        SELECT
          p.product_id,
          p.name,
          COALESCE(SUM(oi.quantity) FILTER (WHERE o.order_id IS NOT NULL), 0) AS units,
          COALESCE(SUM(oi.price_per_unit * oi.quantity) FILTER (WHERE o.order_id IS NOT NULL), 0)::text AS revenue
        FROM product p
        LEFT JOIN product_item pi ON pi.product_id = p.product_id
        LEFT JOIN order_item oi ON oi.product_item_id = pi.product_item_id
        LEFT JOIN orders o ON o.order_id = oi.order_id AND o.status IN ('paid','fulfilled')
        WHERE p.store_id = ${storeId}
        GROUP BY p.product_id, p.name
        ORDER BY units DESC, revenue DESC
        LIMIT 10
      `,
      prisma.$queryRaw<Array<{
        user_id: number;
        username: string;
        first_name: string;
        last_name: string;
        orders: bigint;
        spent: string;
      }>>`
        SELECT
          u.user_id, u.username, u.first_name, u.last_name,
          COUNT(DISTINCT o.order_id) AS orders,
          COALESCE(SUM(oi.price_per_unit * oi.quantity), 0)::text AS spent
        FROM users u
        JOIN orders o ON o.user_id = u.user_id AND o.status IN ('paid','fulfilled')
        JOIN order_item oi ON oi.order_id = o.order_id
        JOIN product_item pi ON pi.product_item_id = oi.product_item_id
        JOIN product p ON p.product_id = pi.product_id
        WHERE p.store_id = ${storeId}
        GROUP BY u.user_id, u.username, u.first_name, u.last_name
        ORDER BY spent DESC
        LIMIT 5
      `,
      prisma.$queryRaw<Array<{ orders: bigint; units: bigint; revenue: string; buyers: bigint }>>`
        SELECT
          COUNT(DISTINCT o.order_id) AS orders,
          COALESCE(SUM(oi.quantity), 0) AS units,
          COALESCE(SUM(oi.price_per_unit * oi.quantity), 0)::text AS revenue,
          COUNT(DISTINCT o.user_id) AS buyers
        FROM orders o
        JOIN order_item oi ON oi.order_id = o.order_id
        JOIN product_item pi ON pi.product_item_id = oi.product_item_id
        JOIN product p ON p.product_id = pi.product_id
        WHERE p.store_id = ${storeId} AND o.status IN ('paid','fulfilled')
      `,
    ]);
    // Pre-shape what's serializable to JSON-safe types so the cache
    // entry doesn't store bigints (JSON.stringify chokes on them).
    return {
      daily: daily.map((d) => ({
        day: d.day,
        revenue: Number(d.revenue),
        orderCount: Number(d.order_count),
      })),
      statusBreakdown: statusBreakdown.map((s) => ({
        status: s.status,
        count: Number(s.count),
      })),
      perProduct: perProduct.map((p) => ({
        product_id: p.product_id,
        name: p.name,
        units: Number(p.units),
        revenue: Number(p.revenue),
      })),
      topBuyers: topBuyers.map((b) => ({
        user_id: b.user_id,
        username: b.username,
        first_name: b.first_name,
        last_name: b.last_name,
        orders: Number(b.orders),
        spent: Number(b.spent),
      })),
      totals: totals[0]
        ? {
            orders: Number(totals[0].orders),
            units: Number(totals[0].units),
            revenue: Number(totals[0].revenue),
            buyers: Number(totals[0].buyers),
          }
        : { orders: 0, units: 0, revenue: 0, buyers: 0 },
    };
  },
  ["seller-analytics"],
  { revalidate: 300, tags: ["seller-analytics"] },
);

const STATUS_VARIANT: Record<
  "pending" | "paid" | "fulfilled" | "cancelled" | "refunded",
  "warning" | "success" | "info" | "danger" | "purple"
> = {
  pending: "warning",
  paid: "success",
  fulfilled: "info",
  cancelled: "danger",
  refunded: "purple",
};

const STATUS_BAR_COLOR: Record<keyof typeof STATUS_VARIANT, string> = {
  pending: "bg-amber-500",
  paid: "bg-mint",
  fulfilled: "bg-mint/70",
  cancelled: "bg-metu-red",
  refunded: "bg-purple-500",
};

export default async function SellerAnalyticsPage() {
  const me = await getMe();
  if (!me) redirect("/login?next=/seller/analytics");
  if (!me.user?.store) redirect("/become-seller");
  const storeId = me.user.store.storeId;

  const { daily: dailyShaped, statusBreakdown, perProduct, topBuyers, totals } =
    await getSellerAnalytics(storeId);

  const totalRevenue = totals.revenue;
  const totalOrders = totals.orders;
  const totalUnits = totals.units;
  const totalBuyers = totals.buyers;

  const noData = totalOrders === 0;

  return (
    <>
      <PageHeader
        title="Analytics"
        subtitle="Sales performance for your store — last 30 days and lifetime totals."
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {/* Compact notation keeps 7+ digit revenue from clipping at md. */}
        <StatCard
          icon={TrendingUp}
          label="Revenue (lifetime)"
          value={coinsCompact(thbToCoins(totalRevenue))}
          valueTooltip={coins(thbToCoins(totalRevenue))}
          accent="yellow"
        />
        <StatCard icon={ShoppingBag} label="Orders" value={totalOrders} />
        <StatCard icon={PackageIcon} label="Units sold" value={totalUnits} />
        <StatCard icon={Users} label="Unique buyers" value={totalBuyers} />
      </div>

      {noData ? (
        <EmptyState
          title="No sales yet"
          description="As soon as a buyer pays, you'll see daily revenue, top products, and your top buyers here."
          icon={<TrendingUp className="h-8 w-8" />}
          action={<GlassButton tone="gold" href="/seller/products/new">Add a product →</GlassButton>}
        />
      ) : (
        <>
          <div className="mb-6">
            <RevenueChart data={dailyShaped} />
          </div>

          <div className="grid lg:grid-cols-[2fr_1fr] gap-6">
            {/* Top products */}
            <section className="rounded-2xl glass-morphism overflow-hidden">
              <div className="px-5 py-3 border-b border-white/8 flex items-center justify-between">
                <h2 className="font-display font-bold text-white">Top products</h2>
                <span className="text-xs text-ink-dim">paid + fulfilled</span>
              </div>
              <table className="w-full text-sm">
                <thead className="text-xs uppercase tracking-wider text-ink-dim">
                  <tr>
                    <th className="text-left px-5 py-2.5">Product</th>
                    <th className="text-right px-5 py-2.5">Units</th>
                    <th className="text-right px-5 py-2.5">Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/6">
                  {perProduct.map((p) => (
                    <tr key={p.product_id} className="hover:bg-white/5">
                      <td className="px-5 py-2.5 text-white truncate max-w-[280px]">
                        <Link href={`/product/${p.product_id}`} className="hover:text-metu-yellow transition-colors">
                          {p.name}
                        </Link>
                      </td>
                      <td className="px-5 py-2.5 text-right text-ink-secondary tabular-nums">{Number(p.units).toLocaleString()}</td>
                      <td className="px-5 py-2.5 text-right font-mono tabular-nums text-mint">
                        {coins(thbToCoins(Number(p.revenue)))}
                      </td>
                    </tr>
                  ))}
                  {perProduct.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-5 py-6 text-center text-ink-dim text-sm">
                        No products with sales yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </section>

            {/* Right column: status breakdown + top buyers */}
            <div className="space-y-6">
              <section className="rounded-2xl glass-morphism p-5">
                <h2 className="font-display font-bold text-white mb-3">Order status mix</h2>
                {(() => {
                  const total = statusBreakdown.reduce((s, r) => s + Number(r.count), 0);
                  if (total === 0) {
                    return <p className="text-sm text-ink-dim">No orders yet.</p>;
                  }
                  return (
                    <>
                      <div className="flex h-2 rounded-full overflow-hidden mb-3 bg-space-800" role="img" aria-label="Order status mix">
                        {statusBreakdown.map((s) => {
                          const pct = (Number(s.count) / total) * 100;
                          const color = STATUS_BAR_COLOR[s.status as keyof typeof STATUS_BAR_COLOR] ?? "bg-white/20";
                          return (
                            <span
                              key={s.status}
                              className={color}
                              style={{ width: `${pct}%` }}
                              title={`${s.status}: ${Number(s.count).toLocaleString()} (${pct.toFixed(1)}%)`}
                            />
                          );
                        })}
                      </div>
                      <ul className="space-y-2">
                        {statusBreakdown.map((s) => (
                          <li key={s.status} className="flex items-center justify-between text-sm">
                            <Badge variant={STATUS_VARIANT[s.status as keyof typeof STATUS_VARIANT] ?? "mist"} className="uppercase">
                              {s.status}
                            </Badge>
                            <span className="font-mono tabular-nums text-white">{Number(s.count).toLocaleString()}</span>
                          </li>
                        ))}
                      </ul>
                    </>
                  );
                })()}
              </section>

              <section className="rounded-2xl glass-morphism p-5">
                <h2 className="font-display font-bold text-white mb-3">Top buyers</h2>
                <ul className="space-y-2">
                  {topBuyers.map((b) => (
                    <li key={b.user_id} className="flex items-center justify-between text-sm">
                      <div className="min-w-0">
                        <div className="font-semibold text-white truncate">
                          {b.first_name} {b.last_name}
                        </div>
                        <div className="text-[11px] text-ink-dim">@{b.username} · {Number(b.orders)} order{Number(b.orders) !== 1 ? "s" : ""}</div>
                      </div>
                      <span className="font-mono tabular-nums font-semibold text-mint text-sm">
                        {coins(thbToCoins(Number(b.spent)))}
                      </span>
                    </li>
                  ))}
                  {topBuyers.length === 0 && (
                    <li className="text-center text-ink-dim text-sm">No buyers yet.</li>
                  )}
                </ul>
              </section>
            </div>
          </div>
        </>
      )}
    </>
  );
}
