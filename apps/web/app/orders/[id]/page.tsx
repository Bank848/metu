import Link from "next/link";
import Image from "next/image";
import { redirect, notFound } from "next/navigation";
import { TopNav } from "@/components/TopNav";
import { Footer } from "@/components/Footer";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { apiAuth, getMe } from "@/lib/session";
import { money } from "@/lib/format";
import { Confetti } from "./Confetti";

type Order = {
  orderId: number;
  totalPrice: string | number;
  status: "pending" | "paid" | "fulfilled" | "cancelled" | "refunded";
  createdAt: string;
  transaction?: { transactionId: number; totalAmount: string | number; date: string } | null;
  items: Array<{
    orderItemId: number;
    quantity: number;
    priceAtPurchase: string | number;
    coupon?: { code: string; discountType: string; discountValue: number } | null;
    productItem: {
      productItemId: number;
      deliveryMethod: string;
      price: string | number;
      product: {
        productId: number;
        name: string;
        images: Array<{ productImage: string }>;
        store: { name: string; storeId: number };
      };
    };
  }>;
};

export const dynamic = "force-dynamic";

export default async function OrderDetail({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { new?: string };
}) {
  const me = await getMe();
  if (!me) redirect(`/login?next=/orders/${params.id}`);
  const order = await apiAuth<Order>(`/orders/${params.id}`);
  if (!order) return notFound();

  return (
    <>
      <TopNav />
      {searchParams.new && <Confetti />}
      <main className="mx-auto max-w-4xl px-6 md:px-8 py-10">
        <Link href="/orders" className="text-sm text-ink-dim hover:text-brand-yellow">
          ← All orders
        </Link>

        <div className="mt-4 rounded-2xl border border-line bg-space-850 overflow-hidden">
          <header className="flex items-start justify-between gap-4 p-6 border-b border-line bg-gradient-to-br from-brand-yellow/10 to-transparent">
            <div>
              <div className="text-xs font-mono text-ink-dim">ORDER #{order.orderId}</div>
              <h1 className="font-display text-3xl font-extrabold tracking-tight text-white mt-1">
                {searchParams.new ? "Thanks — your order is confirmed! 🎉" : `Order #${order.orderId}`}
              </h1>
              <p className="text-sm text-ink-secondary mt-1">
                Placed {new Date(order.createdAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
              </p>
            </div>
            <Badge
              className="uppercase"
              variant={
                order.status === "paid" ? "success" :
                order.status === "fulfilled" ? "info" :
                order.status === "pending" ? "warning" :
                order.status === "refunded" ? "purple" : "danger"
              }
            >
              {order.status}
            </Badge>
          </header>

          <div className="p-6">
            <h2 className="font-display text-xs font-bold uppercase tracking-wider text-ink-dim mb-3">
              Items
            </h2>
            <ul className="divide-y divide-line">
              {order.items.map((it) => (
                <li key={it.orderItemId} className="flex items-center gap-4 py-4">
                  <div className="relative h-16 w-16 rounded-xl bg-space-900 overflow-hidden shrink-0 border border-line">
                    {it.productItem.product.images[0]?.productImage && (
                      <Image src={it.productItem.product.images[0].productImage} alt="" fill sizes="64px" className="object-cover" unoptimized />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <Link href={`/product/${it.productItem.product.productId}`} className="font-semibold text-white hover:text-brand-yellow">
                      {it.productItem.product.name}
                    </Link>
                    <div className="text-xs text-ink-dim capitalize">
                      {it.productItem.deliveryMethod.replace("_", " ")} · {it.productItem.product.store.name}
                    </div>
                    <div className="text-xs text-ink-dim">
                      Qty {it.quantity} · {money(Number(it.priceAtPurchase))} each
                    </div>
                  </div>
                  <div className="text-right font-display text-lg font-bold text-brand-yellow">
                    {money(Number(it.priceAtPurchase) * it.quantity)}
                  </div>
                </li>
              ))}
            </ul>

            <div className="mt-6 pt-4 border-t border-line flex justify-between items-center">
              <div>
                {order.transaction && (
                  <div className="text-xs text-ink-dim font-mono">
                    Transaction #{order.transaction.transactionId} · recorded {new Date(order.transaction.date).toLocaleDateString()}
                  </div>
                )}
              </div>
              <div className="font-display text-2xl font-extrabold text-brand-yellow">
                Total {money(Number(order.totalPrice))}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          <Button href="/orders" variant="outline">Back to orders</Button>
          <Button href="/browse" variant="primary">Browse more →</Button>
        </div>
      </main>
      <Footer />
    </>
  );
}
