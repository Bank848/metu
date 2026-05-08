import { notFound, redirect } from "next/navigation";
import { TopNav } from "@/components/TopNav";
import { getMe } from "@/lib/session";
import { prisma } from "@/lib/server/prisma";
import { CheckoutForm } from "./CheckoutForm";

export const dynamic = "force-dynamic";

/**
 * Stripe Elements checkout confirmation page.
 * The cart's `POST /orders` endpoint returns a clientSecret + redirects
 * here. We re-validate the order (must belong to the buyer and still be
 * in `pending` Stripe state) and hand the clientSecret off to the
 * client component that mounts <PaymentElement />.
 * `?cs=` carries the clientSecret in the URL so a direct refresh keeps
 * working. The secret only lets the bearer confirm THIS payment intent
 * for THIS order amount, so URL exposure is acceptable (matches Stripe's
 * own redirect flow patterns).
 */
export default async function CheckoutPage({
  params,
  searchParams,
}: {
  params: { orderId: string };
  searchParams: { cs?: string };
}) {
  const orderId = Number(params.orderId);
  if (!Number.isFinite(orderId)) return notFound();

  const me = await getMe();
  if (!me) redirect(`/login?next=/checkout/${orderId}`);

  const order = await prisma.order.findUnique({
    where: { orderId },
    include: {
      // Direct-charge PIs live on the seller's Connect account, so
      // Stripe.js scopes with stripeAccount: <sellerAcct>. Derived from
      // the first item's product's store (all items single-store).
      items: {
        take: 1,
        include: {
          productItem: {
            include: {
              product: {
                include: {
                  store: { select: { stripeAccountId: true } },
                },
              },
            },
          },
        },
      },
    },
  });
  if (!order || order.userId !== me.user.userId) return notFound();

  // If the order has already settled (webhook landed first) bounce to
  // the receipt page.
  if (order.status === "paid" || order.status === "fulfilled") {
    redirect(`/orders/${orderId}`);
  }

  const clientSecret = searchParams.cs;
  if (!clientSecret) {
    // No clientSecret in the URL. Three cases:
    //   1. order is already settled → handled above (line 59).
    //   2. order is `pending` but the user landed here via browser-back
    //      from the receipt — the original ?cs= is gone from history.
    //      Route to the receipt instead of /cart so a paid order never
    //      "disappears". Stripe webhook may have settled the row between
    //      the load and now; receipt page handles the still-pending state
    //      with PendingOrderRefresher.
    //   3. true demo mode (no Stripe key) — the API never returned a
    //      clientSecret in the first place; treat as cart bounce.
    if (order.status === "pending") {
      redirect(`/orders/${orderId}`);
    }
    redirect("/cart");
  }

  const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  if (!publishableKey) {
    return (
      <>
        <TopNav />
        <main id="main" className="mx-auto max-w-2xl px-4 sm:px-6 py-10 sm:py-16">
          <h1 className="font-display text-2xl font-bold text-white mb-3">Stripe not configured</h1>
          <p className="text-ink-secondary">
            The deployment is missing <code>NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY</code>. Set it via flyctl secrets to enable card payments.
          </p>
        </main>
      </>
    );
  }

  return (
    <>
      <TopNav />
      <main id="main" className="mx-auto max-w-2xl px-4 sm:px-6 py-8 sm:py-12">
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-white mb-2">
          Confirm your payment
        </h1>
        <p className="text-ink-secondary mb-8">
          Order #{orderId} &middot; ฿{Number(order.totalPrice).toLocaleString("en-US", { minimumFractionDigits: 2 })}
        </p>
        <CheckoutForm
          orderId={orderId}
          clientSecret={clientSecret}
          publishableKey={publishableKey}
          stripeAccount={
            order.items[0]?.productItem?.product.store.stripeAccountId ?? null
          }
        />
      </main>
    </>
  );
}
