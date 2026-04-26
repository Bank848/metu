import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Tag as TagIcon, Users, Banknote, Receipt } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/EmptyState";
import { GlassButton } from "@/components/visual/GlassButton";
import { getMe } from "@/lib/session";
import { prisma } from "@/lib/server/prisma";
import { money } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function CouponReportPage({ params }: { params: { id: string } }) {
  const me = await getMe();
  if (!me) redirect(`/login?next=/seller/coupons/${params.id}/report`);
  if (!me.user?.store && me.role !== "admin") redirect("/become-seller");

  const couponId = Number(params.id);
  if (!Number.isFinite(couponId)) return notFound();

  const coupon = await prisma.coupon.findUnique({
    where: { couponId },
    include: { store: { select: { storeId: true, name: true } } },
  });
  if (!coupon) return notFound();
  if (me.role !== "admin" && coupon.storeId !== me.user.store?.storeId) return notFound();

  // Pull every order line that used this coupon. The `couponId` FK on
  // OrderItem is what we set during checkout (see /api/orders POST), so
  // this is the source of truth for "redemptions".
  const lines = await prisma.orderItem.findMany({
    where: { couponId, order: { status: { in: ["paid", "fulfilled"] } } },
    orderBy: { orderId: "desc" },
    include: {
      order: {
        include: {
          cart: {
            include: {
              user: { select: { userId: true, username: true, firstName: true, lastName: true } },
            },
          },
        },
      },
      productItem: { include: { product: { select: { productId: true, name: true } } } },
    },
  });

  // Group by order so the table reads "1 row per redemption".
  type Row = {
    orderId: number;
    createdAt: Date;
    buyer: { userId: number; username: string; firstName: string; lastName: string };
    items: Array<{ name: string; quantity: number; subtotal: number }>;
    grossSubtotal: number;
    discount: number;
  };
  const rows = new Map<number, Row>();
  for (const li of lines) {
    const subtotal = Number(li.priceAtPurchase) * li.quantity;
    const r = rows.get(li.orderId);
    if (!r) {
      rows.set(li.orderId, {
        orderId: li.orderId,
        createdAt: li.order.createdAt,
        buyer: li.order.cart.user,
        items: [{ name: li.productItem.product.name, quantity: li.quantity, subtotal }],
        grossSubtotal: subtotal,
        discount: computeDiscount(subtotal, coupon.discountType, coupon.discountValue),
      });
    } else {
      r.items.push({ name: li.productItem.product.name, quantity: li.quantity, subtotal });
      r.grossSubtotal += subtotal;
      r.discount += computeDiscount(subtotal, coupon.discountType, coupon.discountValue);
    }
  }
  const sorted = [...rows.values()].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const totalRedemptions = sorted.length;
  const totalDiscount = sorted.reduce((a, r) => a + r.discount, 0);
  const totalGross = sorted.reduce((a, r) => a + r.grossSubtotal, 0);
  const uniqueBuyers = new Set(sorted.map((r) => r.buyer.userId)).size;

  return (
    <>
      <Link
        href="/seller/coupons"
        className="inline-flex items-center gap-1.5 text-sm text-ink-dim hover:text-metu-yellow mb-3"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to coupons
      </Link>
      <PageHeader
        title={
          <span className="inline-flex items-center gap-2">
            <TagIcon className="h-5 w-5 text-metu-yellow" />
            <code className="font-mono text-base bg-metu-yellow/10 text-metu-yellow border border-metu-yellow/30 px-2 py-0.5 rounded-md">
              {coupon.code}
            </code>
            <Badge variant={coupon.isActive ? "success" : "mist"} className="uppercase">
              {coupon.isActive ? "Active" : "Paused"}
            </Badge>
          </span>
        }
        subtitle={`${coupon.discountType === "percent" ? coupon.discountValue + "%" : "฿" + coupon.discountValue} off · valid ${new Date(coupon.startDate).toLocaleDateString()} – ${new Date(coupon.endDate).toLocaleDateString()}`}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard icon={Receipt} label="Redemptions" value={totalRedemptions} accent="yellow" />
        <StatCard icon={Users} label="Unique buyers" value={uniqueBuyers} />
        <StatCard icon={Banknote} label="Gross subtotal" value={money(totalGross)} />
        <StatCard icon={Banknote} label="Discount given" value={money(totalDiscount)} />
      </div>

      {sorted.length === 0 ? (
        <EmptyState
          title="No redemptions yet"
          description="Once a buyer applies this coupon at checkout you'll see the breakdown here."
          icon={<TagIcon className="h-8 w-8" />}
          action={<GlassButton tone="glass" href="/seller/coupons">Back to coupons</GlassButton>}
        />
      ) : (
        <section className="rounded-2xl glass-morphism overflow-hidden">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wider text-ink-dim bg-white/[0.02]">
              <tr>
                <th className="text-left px-5 py-3">Order</th>
                <th className="text-left px-5 py-3">Buyer</th>
                <th className="text-left px-5 py-3">Items</th>
                <th className="text-right px-5 py-3">Gross</th>
                <th className="text-right px-5 py-3">Discount</th>
                <th className="text-left px-5 py-3">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/6">
              {sorted.map((r) => (
                <tr key={r.orderId} className="hover:bg-white/5">
                  <td className="px-5 py-3">
                    <Link href={`/orders/${r.orderId}`} className="font-mono text-xs text-metu-yellow hover:underline">
                      #{r.orderId}
                    </Link>
                  </td>
                  <td className="px-5 py-3">
                    <div className="text-sm font-semibold text-white">
                      {r.buyer.firstName} {r.buyer.lastName}
                    </div>
                    <div className="text-xs text-ink-dim">@{r.buyer.username}</div>
                  </td>
                  <td className="px-5 py-3 text-sm text-ink-secondary truncate max-w-[300px]">
                    {r.items.map((i) => `${i.name} ×${i.quantity}`).join(" · ")}
                  </td>
                  <td className="px-5 py-3 text-right text-sm">{money(r.grossSubtotal)}</td>
                  <td className="px-5 py-3 text-right font-semibold text-green-400">
                    −{money(r.discount)}
                  </td>
                  <td className="px-5 py-3 text-xs text-ink-dim">
                    {new Date(r.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </>
  );
}

function computeDiscount(subtotal: number, type: string, value: number): number {
  return type === "percent" ? (subtotal * value) / 100 : Math.min(subtotal, value);
}
