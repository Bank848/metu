import Image from "next/image";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { apiAuth } from "@/lib/session";
import { money } from "@/lib/format";

type Order = {
  orderId: number;
  status: "pending" | "paid" | "fulfilled" | "cancelled" | "refunded";
  totalPrice: string | number;
  createdAt: string;
  cart: { user: { firstName: string; lastName: string; username: string; profileImage: string | null } };
  items: Array<{
    orderItemId: number;
    quantity: number;
    priceAtPurchase: string | number;
    productItem: { product: { name: string; productId: number; images: Array<{ productImage: string }> } };
  }>;
};

export const dynamic = "force-dynamic";

const variants = {
  paid: "success", fulfilled: "info", pending: "warning", cancelled: "danger", refunded: "purple",
} as const;

export default async function SellerOrders() {
  const orders = (await apiAuth<Order[]>("/seller/orders")) ?? [];
  return (
    <>
      <PageHeader title="Orders inbox" subtitle={`${orders.length} orders containing your products`} />
      <ul className="space-y-3">
        {orders.map((o) => (
          <li key={o.orderId} className="rounded-2xl border border-line bg-space-850 p-5">
            <div className="flex items-start justify-between gap-4 mb-3">
              <div className="flex items-center gap-3">
                <div className="relative h-10 w-10 rounded-full bg-brand-yellow overflow-hidden shrink-0">
                  {o.cart.user.profileImage && (
                    <Image src={o.cart.user.profileImage} alt="" fill sizes="40px" className="object-cover" unoptimized />
                  )}
                </div>
                <div>
                  <div className="text-sm font-semibold text-white">
                    {o.cart.user.firstName} {o.cart.user.lastName}
                  </div>
                  <div className="text-xs font-mono text-ink-dim">
                    ORDER #{o.orderId} · {new Date(o.createdAt).toLocaleDateString()}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <Badge variant={variants[o.status]} className="uppercase">{o.status}</Badge>
                <div className="mt-1 font-display font-bold text-brand-yellow">{money(Number(o.totalPrice))}</div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-ink-secondary">
              {o.items.map((it) => (
                <span key={it.orderItemId} className="inline-flex items-center gap-1.5 rounded-full bg-space-800 border border-line px-3 py-1">
                  {it.productItem.product.images[0] && (
                    <Image src={it.productItem.product.images[0].productImage} alt="" width={16} height={16} className="rounded" unoptimized />
                  )}
                  {it.productItem.product.name} · ×{it.quantity}
                </span>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
