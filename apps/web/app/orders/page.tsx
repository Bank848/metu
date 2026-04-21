import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { Package, Receipt } from "lucide-react";
import { TopNav } from "@/components/TopNav";
import { Footer } from "@/components/Footer";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/EmptyState";
import { GlassButton } from "@/components/visual/GlassButton";
import { apiAuth, getMe } from "@/lib/session";
import { money } from "@/lib/format";

type Order = {
  orderId: number;
  totalPrice: string | number;
  status: "pending" | "paid" | "fulfilled" | "cancelled" | "refunded";
  createdAt: string;
  items: Array<{
    orderItemId: number;
    quantity: number;
    priceAtPurchase: string | number;
    productItem: {
      product: {
        name: string;
        images: Array<{ productImage: string }>;
        store: { name: string };
      };
    };
  }>;
};

export const dynamic = "force-dynamic";

const statusVariant: Record<Order["status"], "success" | "warning" | "info" | "danger" | "purple"> = {
  paid: "success",
  fulfilled: "info",
  pending: "warning",
  cancelled: "danger",
  refunded: "purple",
};

export default async function OrdersPage() {
  const me = await getMe();
  if (!me) redirect("/login?next=/orders");

  const orders = (await apiAuth<Order[]>("/orders")) ?? [];

  return (
    <>
      <TopNav />
      <main className="mx-auto max-w-5xl px-6 md:px-8 py-10">
        <PageHeader title="My orders" subtitle={`${orders.length} order${orders.length !== 1 ? "s" : ""} total`} />

        {orders.length === 0 ? (
          <EmptyState
            title="No orders yet"
            description="Your purchases will show up here."
            icon={<Package className="h-8 w-8" />}
            action={<GlassButton tone="gold" href="/browse">Start browsing →</GlassButton>}
          />
        ) : (
          <ul className="space-y-4">
            {orders.map((o) => (
              <li key={o.orderId}>
                <Link
                  href={`/orders/${o.orderId}`}
                  className="block rounded-2xl glass-morphism p-5 hover:border-metu-yellow/50 transition-all hover:-translate-y-0.5"
                >
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div>
                      <div className="text-xs font-mono text-ink-dim flex items-center gap-1">
                        <Receipt className="h-3 w-3" />
                        ORDER #{o.orderId}
                      </div>
                      <div className="text-sm text-ink-secondary mt-0.5">
                        {new Date(o.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant={statusVariant[o.status]} className="uppercase">{o.status}</Badge>
                      <div className="mt-2 font-display text-xl font-extrabold text-gold-gradient">
                        {money(Number(o.totalPrice))}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 overflow-hidden">
                    {o.items.slice(0, 4).map((it) => (
                      <div key={it.orderItemId} className="relative h-14 w-14 rounded-xl bg-surface-2 overflow-hidden shrink-0 border border-white/8">
                        {it.productItem.product.images[0]?.productImage && (
                          <Image src={it.productItem.product.images[0].productImage} alt="" fill sizes="56px" className="object-cover" unoptimized />
                        )}
                      </div>
                    ))}
                    <div className="ml-3 text-sm text-ink-secondary truncate">
                      {o.items.map((i) => i.productItem.product.name).join(" · ")}
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
      <Footer />
    </>
  );
}
