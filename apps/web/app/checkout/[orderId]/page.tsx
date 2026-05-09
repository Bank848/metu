import { notFound, redirect } from "next/navigation";
import { TopNav } from "@/components/TopNav";
import { getMe } from "@/lib/session";
import { prisma } from "@/lib/server/prisma";
import { CheckoutForm } from "./CheckoutForm";

export const dynamic = "force-dynamic";

/**
 * Stripe Elements checkout confirmation. POST /orders returns a
 * clientSecret and redirects here; we re-validate the order and hand
 * the secret to <CheckoutForm /> which mounts <PaymentElement />.
 * `?cs=` carries the clientSecret in the URL so a refresh works.
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
      // Single-store orders only — load every item so a hard-deleted
      // item[0] (productItem set null) doesn't strand us with no
      // Stripe account.
      items: {
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
    // Pending order without ?cs= → user came back via browser-back; bounce
    // to receipt where PendingOrderRefresher handles the wait.
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
            // Find the first surviving item — null productItem rows show up
            // when a variant is hard-deleted (set-null FK).
            order.items.find((i) => i.productItem)?.productItem?.product.store.stripeAccountId ?? null
          }
        />
      </main>
    </>
  );
}
