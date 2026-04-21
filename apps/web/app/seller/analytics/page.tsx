import { redirect } from "next/navigation";
import { TrendingUp, ShoppingBag, Users, Package as PackageIcon } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { RevenueChart } from "@/components/admin/RevenueChart";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/EmptyState";
import { GlassButton } from "@/components/visual/GlassButton";
import { getMe } from "@/lib/session";
import { prisma } from "@/lib/server/prisma";
import { money } from "@/lib/format";

export const dynamic = "force-dynamic";

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

export default async function SellerAnalyticsPage() {
  const me = await getMe();
  if (!me) redirect("/login?next=/seller/analytics");
  if (!me.user?.store) redirect("/become-seller");
  const storeId = me.user.store.storeId;

  // Pull everything needed for the analytics view in parallel. Each query
  // is scoped to the seller's store so admins viewing another store don't
  // accidentally leak across.
  const [
    daily,
    statusBreakdown,
    perProduct,
    topBuyers,
    totals,
  ] = await Promise.all([
    // Daily revenue over the last 30 days — same shape as the admin
    // RevenueChart component expects (day, revenue, orderCount).
    prisma.$queryRaw<Array<{ day: string; revenue: string; order_count: bigint }>>`
      SELECT
        TO_CHAR(d::date, 'YYYY-MM-DD') AS day,
        COALESCE(SUM(oi.price_at_purchase * oi.quantity)
          FILTER (WHERE o.status IN ('paid','fulfilled')), 0)::text AS revenue,
        COUNT(DISTINCT o.order_id)
          FILTER (WHERE o.status IN ('paid','fulfilled')) AS order_count
      FROM generate_series(CURRENT_DATE - INTERVAL '29 days', CURRENT_DATE, INTERVAL '1 day') d
      LEFT JOIN order_item oi ON DATE(
        (SELECT created_at FROM orders WHERE order_id = oi.order_id)
      ) = d::date
      LEFT JOIN orders o ON o.order_id = oi.order_id
      LEFT JOIN product_item pi ON pi.product_item_id = oi.product_item_id
      LEFT JOIN product p ON p.product_id = pi.product_id AND p.store_id = ${storeId}
      WHERE pi.product_item_id IS NULL OR p.store_id = ${storeId}
      GROUP BY d
      ORDER BY d ASC
    `,
    // Order status mix for orders containing this store's products.
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
    // Per-product revenue + units sold (paid+fulfilled only).
    prisma.$queryRaw<Array<{
      product_id: number;
      name: string;
      units: bigint;
      revenue: string;
    }>>`
      SELECT
        p.product_id,
        p.name,
        COALESCE(SUM(oi.quantity), 0) AS units,
        COALESCE(SUM(oi.price_at_purchase * oi.quantity), 0)::text AS revenue
      FROM product p
      LEFT JOIN product_item pi ON pi.product_id = p.product_id
      LEFT JOIN order_item oi ON oi.product_item_id = pi.product_item_id
      LEFT JOIN orders o ON o.order_id = oi.order_id AND o.status IN ('paid','fulfilled')
      WHERE p.store_id = ${storeId}
      GROUP BY p.product_id, p.name
      ORDER BY units DESC, revenue DESC
      LIMIT 10
    `,
    // Top 5 buyers by spend on this store.
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
        COALESCE(SUM(oi.price_at_purchase * oi.quantity), 0)::text AS spent
      FROM users u
      JOIN cart c ON c.user_id = u.user_id
      JOIN orders o ON o.cart_id = c.cart_id AND o.status IN ('paid','fulfilled')
      JOIN order_item oi ON oi.order_id = o.order_id
      JOIN product_item pi ON pi.product_item_id = oi.product_item_id
      JOIN product p ON p.product_id = pi.product_id
      WHERE p.store_id = ${storeId}
      GROUP BY u.user_id, u.username, u.first_name, u.last_name
      ORDER BY spent DESC
      LIMIT 5
    `,
    // Lifetime totals.
    prisma.$queryRaw<Array<{ orders: bigint; units: bigint; revenue: string; buyers: bigint }>>`
      SELECT
        COUNT(DISTINCT o.order_id) AS orders,
        COALESCE(SUM(oi.quantity), 0) AS units,
        COALESCE(SUM(oi.price_at_purchase * oi.quantity), 0)::text AS revenue,
        COUNT(DISTINCT c.user_id) AS buyers
      FROM orders o
      JOIN cart c ON c.cart_id = o.cart_id
      JOIN order_item oi ON oi.order_id = o.order_id
      JOIN product_item pi ON pi.product_item_id = oi.product_item_id
      JOIN product p ON p.product_id = pi.product_id
      WHERE p.store_id = ${storeId} AND o.status IN ('paid','fulfilled')
    `,
  ]);

  const dailyShaped = daily.map((d) => ({
    day: d.day,
    revenue: Number(d.revenue),
    orderCount: Number(d.order_count),
  }));

  const t = totals[0] ?? { orders: 0n, units: 0n, revenue: "0", buyers: 0n };
  const totalRevenue = Number(t.revenue);
  const totalOrders = Number(t.orders);
  const totalUnits = Number(t.units);
  const totalBuyers = Number(t.buyers);

  const noData = totalOrders === 0;

  return (
    <>
      <PageHeader
        title="Analytics"
        subtitle="Sales performance for your store — last 30 days and lifetime totals."
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard icon={TrendingUp} label="Revenue (lifetime)" value={money(totalRevenue)} accent="yellow" />
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
                      <td className="px-5 py-2.5 text-white truncate max-w-[280px]">{p.name}</td>
                      <td className="px-5 py-2.5 text-right text-ink-secondary">{Number(p.units).toLocaleString()}</td>
                      <td className="px-5 py-2.5 text-right font-semibold text-gold-gradient">
                        {money(Number(p.revenue))}
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
                <ul className="space-y-2">
                  {statusBreakdown.map((s) => (
                    <li key={s.status} className="flex items-center justify-between text-sm">
                      <Badge variant={STATUS_VARIANT[s.status as keyof typeof STATUS_VARIANT] ?? "mist"} className="uppercase">
                        {s.status}
                      </Badge>
                      <span className="font-mono text-white">{Number(s.count).toLocaleString()}</span>
                    </li>
                  ))}
                </ul>
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
                      <span className="font-display font-bold text-gold-gradient text-sm">
                        {money(Number(b.spent))}
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
