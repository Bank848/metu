import Link from "next/link";
import { redirect } from "next/navigation";
import { Ticket, ArrowRight, Clock } from "lucide-react";
import { TopNav } from "@/components/TopNav";
import { Footer } from "@/components/Footer";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/EmptyState";
import { GlassButton } from "@/components/visual/GlassButton";
import { prisma } from "@/lib/server/prisma";
import { getMe } from "@/lib/session";
import { getFeaturedCoupons } from "@/lib/server/queries";
import { coins, thbToCoins, fmtDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata = { title: "Coupon history · METU" };
export const dynamic = "force-dynamic";

interface UsageRow {
  usage_id: number;
  coupon_id: number;
  code: string;
  store_name: string | null;
  discount_type: string;
  discount_value: number;
  used_at: Date;
  order_id: number | null;
  amount_saved: string;
}

export default async function CouponHistoryPage() {
  const me = await getMe();
  if (!me) redirect("/login?next=/coupons/history");
  const userId = me.user.userId;

  // One round trip: every redemption + the order it applied to + the
  // baht saved (LEAST cap on fixed coupons mirrors checkout math).
  const rows = await prisma.$queryRaw<UsageRow[]>`
    SELECT
      cu.usage_id,
      cu.coupon_id,
      c.code,
      s.name AS store_name,
      c.discount_type,
      c.discount_value,
      cu.created_at AS used_at,
      (
        SELECT MAX(o.order_id)
          FROM order_item oi
          JOIN orders o ON o.order_id = oi.order_id
         WHERE oi.coupon_id = c.coupon_id AND o.user_id = ${userId}
      ) AS order_id,
      COALESCE((
        SELECT SUM(
          CASE WHEN c.discount_type = 'percent'
               THEN oi.price_per_unit * oi.quantity * c.discount_value / 100.0
               ELSE LEAST(c.discount_value, oi.price_per_unit * oi.quantity)
          END
        )
        FROM order_item oi
        JOIN orders o ON o.order_id = oi.order_id
        WHERE oi.coupon_id = c.coupon_id
          AND o.user_id    = ${userId}
          AND o.status     IN ('paid','fulfilled')
      ), 0)::text AS amount_saved
    FROM coupon_usage cu
    JOIN coupon c ON c.coupon_id = cu.coupon_id
    LEFT JOIN store s ON s.store_id = c.store_id
    WHERE cu.user_id = ${userId}
    ORDER BY cu.created_at DESC
  `;

  const totalSaved = rows.reduce((a, r) => a + Number(r.amount_saved), 0);
  const featured = await getFeaturedCoupons(3);

  return (
    <>
      <TopNav />
      <main id="main" className="mx-auto max-w-4xl px-6 md:px-8 py-10 space-y-8">
        <PageHeader
          title="Coupon history"
          subtitle={
            rows.length === 0
              ? "Coupons you redeem will show up here."
              : `${rows.length} redemption${rows.length === 1 ? "" : "s"} · saved ${coins(thbToCoins(totalSaved))} total`
          }
        />

        {rows.length === 0 ? (
          <EmptyState
            title="No coupons used yet"
            description="Browse featured coupons on the home page or look for codes on individual store pages."
            icon={<Ticket className="h-8 w-8" />}
            action={<GlassButton tone="gold" href="/">Browse coupons →</GlassButton>}
          />
        ) : (
          <section className="rounded-2xl border border-line bg-space-900 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-space-950 text-xs uppercase tracking-wider text-ink-dim">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">Code</th>
                  <th className="text-left px-4 py-2 font-medium">Store</th>
                  <th className="text-left px-4 py-2 font-medium">Discount</th>
                  <th className="text-right px-4 py-2 font-medium">Amount saved</th>
                  <th className="text-right px-4 py-2 font-medium">Order</th>
                  <th className="text-right px-4 py-2 font-medium">Used on</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.usage_id} className="border-t border-line hover:bg-white/[0.02]">
                    <td className="px-4 py-3 font-mono text-metu-yellow font-bold">{r.code}</td>
                    <td className="px-4 py-3 text-sm">
                      {r.store_name ?? <Badge variant="gold" className="text-[10px]">MASTER</Badge>}
                    </td>
                    <td className="px-4 py-3 text-sm text-white">
                      {r.discount_type === "percent"
                        ? `${r.discount_value}%`
                        : coins(thbToCoins(r.discount_value))}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-mono text-mint">
                      {coins(thbToCoins(Number(r.amount_saved)))}
                    </td>
                    <td className="px-4 py-3 text-right text-xs">
                      {r.order_id ? (
                        <Link href={`/orders/${r.order_id}`} className="text-metu-yellow hover:underline">
                          #{r.order_id}
                        </Link>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-ink-dim">
                      {fmtDate(r.used_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {/* Promo: surface 3 active coupons even on an empty history so
            buyers see what's available right now. */}
        {featured.length > 0 && (
          <section className="rounded-2xl border border-metu-yellow/30 bg-gradient-to-br from-metu-yellow/5 to-transparent p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-xl font-bold text-white flex items-center gap-2">
                <Ticket className="h-5 w-5 text-metu-yellow" />
                Discover more coupons
              </h2>
              <Link href="/" className="text-xs text-metu-yellow hover:underline inline-flex items-center gap-1">
                See all <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {featured.map((c) => (
                <div
                  key={c.couponId}
                  className={cn(
                    "rounded-xl border p-4 bg-space-900",
                    c.isMaster ? "border-metu-yellow/50" : "border-line",
                  )}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <Badge variant={c.isMaster ? "gold" : "mist"} className="uppercase text-[10px]">
                      {c.isMaster ? "Master" : c.storeName ?? "Store"}
                    </Badge>
                    <span className="text-[10px] text-ink-dim flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {fmtDate(c.endDate)}
                    </span>
                  </div>
                  <div className="font-display text-lg font-bold text-gold-gradient">
                    {c.discountType === "percent"
                      ? `${c.discountValue}% off`
                      : `${coins(thbToCoins(c.discountValue))} off`}
                  </div>
                  <code className="block font-mono text-xs text-metu-yellow mt-1 select-all">
                    {c.code}
                  </code>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
      <Footer />
    </>
  );
}
