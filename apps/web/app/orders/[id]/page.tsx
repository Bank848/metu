import Link from "next/link";
import Image from "next/image";
import { redirect, notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, Receipt, Sparkles, Tag as TagIcon, Mail } from "lucide-react";
import { TopNav } from "@/components/TopNav";
import { Footer } from "@/components/Footer";
import { Badge } from "@/components/ui/Badge";
import { GlassButton } from "@/components/visual/GlassButton";
import { apiAuth, getMe } from "@/lib/session";
import { getServerT } from "@/lib/i18n/server";
import { money } from "@/lib/format";
import { isDataUrl } from "@/lib/utils";
import { prisma } from "@/lib/server/prisma";
import { Confetti } from "./Confetti";
import { ReviewItemButton } from "./ReviewItemButton";

type Order = {
  orderId: number;
  totalPrice: string | number;
  status: "pending" | "paid" | "fulfilled" | "cancelled" | "refunded";
  createdAt: string;
  giftRecipientEmail?: string | null;
  giftMessage?: string | null;
  transaction?: { transactionId: number; totalAmount: string | number; date: string; transactionType: string } | null;
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
        productNTags?: Array<{ tag: { tagId: number; tagName: string } }>;
      };
    };
  }>;
};

export const dynamic = "force-dynamic";

const statusBadge: Record<Order["status"], "success" | "info" | "warning" | "danger" | "purple"> = {
  paid: "success",
  fulfilled: "info",
  pending: "warning",
  cancelled: "danger",
  refunded: "purple",
};

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

  // Which products in this order has the buyer already reviewed?
  const productIds = Array.from(
    new Set(order.items.map((i) => i.productItem.product.productId)),
  );
  const existing =
    productIds.length > 0
      ? await prisma.productReview.findMany({
          where: { userId: me.user.userId, productId: { in: productIds } },
          select: { productId: true },
        })
      : [];
  const reviewedSet = new Set(existing.map((r) => r.productId));
  const canReview = order.status === "paid" || order.status === "fulfilled";

  const isNew = Boolean(searchParams.new);
  const subtotal = order.items.reduce(
    (a, it) => a + Number(it.priceAtPurchase) * it.quantity,
    0,
  );
  const total = Number(order.totalPrice);
  const discount = Math.max(0, subtotal - total);
  const couponCode = order.items.find((i) => i.coupon?.code)?.coupon?.code;

  return (
    <>
      <TopNav />
      {isNew && <Confetti />}
      <main id="main" className="relative">
        {/* radial gold glow background, dim */}
        <div aria-hidden className="absolute inset-x-0 top-0 h-[640px] vibrant-mesh opacity-60 pointer-events-none" />

        <div className="relative mx-auto max-w-4xl px-6 md:px-8 py-10">
          <Link href="/orders" className="inline-flex items-center gap-1.5 text-sm text-ink-dim hover:text-metu-yellow mb-4">
            <ArrowLeft className="h-3.5 w-3.5" />
            All orders
          </Link>

          {/* Receipt card — Wave-3: surface-flat replaces glass so the
              receipt reads as a printable, calm panel rather than a
              floating glass slab. */}
          <div className="rounded-3xl surface-flat overflow-hidden shadow-raised">
            {/* Hero / status header */}
            <header className="relative px-7 py-8 border-b border-white/8">
              <div className="absolute top-0 inset-x-0 h-[3px] bg-gradient-to-r from-transparent via-metu-yellow to-transparent" />

              {isNew ? (
                <div className="flex flex-col items-center text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-500/15 text-green-400 mb-3">
                    <CheckCircle2 className="h-8 w-8" strokeWidth={2} />
                  </div>
                  <Badge variant="gold" className="mb-3 !px-3 !py-1">Order confirmed</Badge>
                  <h1 className="font-display text-3xl md:text-4xl font-extrabold text-white">
                    Thanks — your order is on the way!
                  </h1>
                  <p className="text-ink-secondary mt-2 max-w-md">
                    We've recorded your payment. Digital downloads are available immediately
                    from your{" "}
                    <Link href="/orders" className="text-metu-yellow hover:underline">orders dashboard</Link>.
                  </p>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-xs font-mono text-ink-dim flex items-center gap-1.5">
                      <Receipt className="h-3 w-3" />
                      ORDER #{order.orderId}
                    </div>
                    <h1 className="font-display text-3xl font-extrabold text-white mt-1">
                      Order receipt
                    </h1>
                    <p className="text-sm text-ink-secondary mt-1">
                      Placed{" "}
                      {new Date(order.createdAt).toLocaleString("en-US", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </p>
                  </div>
                  <Badge className="uppercase" variant={statusBadge[order.status]}>
                    {order.status}
                  </Badge>
                </div>
              )}
            </header>

            {/* Order # mono row (small) for the new state — replaces the duplicated block above */}
            {isNew && (
              <div className="px-7 py-3 border-b border-white/8 flex items-center justify-between bg-surface-2/40">
                <div className="text-xs font-mono text-ink-dim flex items-center gap-1.5">
                  <Receipt className="h-3 w-3" />
                  ORDER #{order.orderId}
                </div>
                <Badge className="uppercase" variant={statusBadge[order.status]}>
                  {order.status}
                </Badge>
              </div>
            )}

            {order.giftRecipientEmail && (
              <section className="px-7 pt-6">
                <div className="rounded-xl border border-pink-400/30 bg-pink-400/10 p-4">
                  <div className="text-xs font-semibold uppercase tracking-wider text-pink-300 inline-flex items-center gap-1">
                    🎁 Gift for {order.giftRecipientEmail}
                  </div>
                  {order.giftMessage && (
                    <p className="mt-2 text-sm text-white whitespace-pre-line">
                      “{order.giftMessage}”
                    </p>
                  )}
                </div>
              </section>
            )}

            {/* Items */}
            <section className="px-7 py-6">
              <h2 className="text-xs font-bold uppercase tracking-wider text-ink-dim mb-3">
                Items ({order.items.length})
              </h2>
              <ul className="divide-y divide-white/6">
                {order.items.map((it) => (
                  <li key={it.orderItemId} className="flex items-center gap-4 py-4">
                    <div className="relative h-16 w-16 rounded-xl bg-surface-2 overflow-hidden shrink-0 border border-white/8">
                      {it.productItem.product.images[0]?.productImage && (
                        <Image
                          src={it.productItem.product.images[0].productImage}
                          alt=""
                          fill
                          sizes="64px"
                          className="object-cover"
                          unoptimized={isDataUrl(it.productItem.product.images[0].productImage)}
                        />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <Link
                        href={`/product/${it.productItem.product.productId}`}
                        className="font-semibold text-white hover:text-metu-yellow line-clamp-1"
                      >
                        {it.productItem.product.name}
                      </Link>
                      <div className="text-xs text-ink-dim capitalize mt-0.5">
                        {it.productItem.deliveryMethod.replace("_", " ")} ·{" "}
                        {it.productItem.product.store.name}
                      </div>
                      {(it.productItem.product.productNTags?.length ?? 0) > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {it.productItem.product.productNTags!.slice(0, 4).map((nt) => (
                            <span
                              key={nt.tag.tagId}
                              className="inline-flex items-center rounded-full bg-white/5 border border-white/10 px-2 py-0.5 text-[10px] font-semibold text-ink-secondary"
                            >
                              {nt.tag.tagName}
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="text-xs text-ink-dim mt-1.5">
                        Qty {it.quantity} · {money(Number(it.priceAtPurchase))} each
                      </div>
                      {canReview && (
                        <div className="mt-2">
                          <ReviewItemButton
                            productId={it.productItem.product.productId}
                            alreadyReviewed={reviewedSet.has(it.productItem.product.productId)}
                          />
                        </div>
                      )}
                    </div>
                    <div className="text-right font-display text-lg font-bold text-gold-gradient">
                      {money(Number(it.priceAtPurchase) * it.quantity)}
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            {/* Totals */}
            <section className="px-7 py-5 border-t border-white/8 bg-surface-2/30">
              <div className="space-y-1.5 text-sm">
                <Row label="Subtotal" value={subtotal} />
                {discount > 0 && (
                  <Row
                    label={
                      couponCode
                        ? `Discount (${couponCode})`
                        : "Discount"
                    }
                    value={-discount}
                    accent="green"
                  />
                )}
                <div className="border-t border-white/8 my-3" />
                <div className="flex justify-between items-baseline">
                  <span className="text-white font-semibold">Total</span>
                  <span className="font-display text-3xl font-extrabold text-gold-gradient">
                    {money(total)}
                  </span>
                </div>
              </div>
            </section>

            {/* Transaction sub-card */}
            {order.transaction && (
              <section className="px-7 py-5 border-t border-white/8">
                <h2 className="text-xs font-bold uppercase tracking-wider text-ink-dim mb-3 flex items-center gap-1.5">
                  <Sparkles className="h-3 w-3 text-metu-yellow" />
                  Transaction
                </h2>
                <div className="rounded-xl border border-white/10 bg-surface-2 p-4 grid grid-cols-3 gap-4 font-mono text-xs">
                  <div>
                    <div className="text-ink-dim">Tx ID</div>
                    <div className="text-white mt-0.5">#{order.transaction.transactionId}</div>
                  </div>
                  <div>
                    <div className="text-ink-dim">Type</div>
                    <div className="text-white mt-0.5 capitalize">{order.transaction.transactionType}</div>
                  </div>
                  <div>
                    <div className="text-ink-dim">Recorded</div>
                    <div className="text-white mt-0.5">
                      {new Date(order.transaction.date).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </div>
                  </div>
                </div>
              </section>
            )}
          </div>

          {/* CTA row */}
          <div className="mt-6 flex gap-3">
            <GlassButton tone="glass" href="/orders">Back to orders</GlassButton>
            <GlassButton tone="gold" href="/browse">Browse more →</GlassButton>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}

function Row({
  label,
  value,
  accent = "default",
}: {
  label: string;
  value: number;
  accent?: "default" | "green";
}) {
  return (
    <div className="flex justify-between">
      <span className="text-ink-secondary">{label}</span>
      <span className={accent === "green" ? "text-green-400 font-semibold" : "text-white font-semibold"}>
        {money(value)}
      </span>
    </div>
  );
}
