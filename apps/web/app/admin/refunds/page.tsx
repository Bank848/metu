import { PageHeader } from "@/components/PageHeader";
import { prisma } from "@/lib/server/prisma";
import { RefundButton } from "./RefundButton";

export const dynamic = "force-dynamic";

/**
 * admin refund queue.
 * Lists every Stripe-charged order that hasn't been fully refunded.
 * The actual refund call goes via /api/admin/orders/:id/refund (which
 * gates on requireRecent2FA so admins re-enter their TOTP code if it's
 * been more than 15 minutes since the last step-up).
 * Demo-mode orders (no stripe_payment_intent_id) don't show up here —
 * those are refunded via the existing legacy admin refund flow.
 */
export default async function AdminRefundsPage() {
  const orders = await prisma.order.findMany({
    where: {
      stripePaymentIntentId: { not: null },
      status: { in: ["paid", "fulfilled"] },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      user: { select: { email: true, firstName: true, lastName: true } },
    },
  });

  return (
    <main id="main" className="px-8 py-8 max-w-5xl">
      <PageHeader
        title="Refunds"
        subtitle="Stripe-charged orders eligible for refund. Issuing a refund calls Stripe's Refund API + reverses the Connect transfer + claws back the platform fee."
      />

      <section className="mt-6 rounded-2xl border border-line bg-space-900 overflow-hidden">
        {orders.length === 0 ? (
          <p className="p-6 text-sm text-ink-dim">No Stripe-charged orders pending.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-space-950 text-left text-xs uppercase tracking-wider text-ink-dim">
              <tr>
                <th className="py-2 px-4 font-medium">Order</th>
                <th className="py-2 px-4 font-medium">Buyer</th>
                <th className="py-2 px-4 font-medium">Total</th>
                <th className="py-2 px-4 font-medium">Refunded</th>
                <th className="py-2 px-4 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => {
                const refundedSatang = o.stripeAmountRefunded ?? 0;
                const receivedSatang = o.stripeAmountReceived ?? 0;
                const fullyRefunded = refundedSatang > 0 && refundedSatang >= receivedSatang;
                return (
                  <tr key={o.orderId} className="border-t border-white/5 hover:bg-white/[0.02]">
                    <td className="py-2 px-4 font-mono">#{o.orderId}</td>
                    <td className="py-2 px-4">
                      <div className="text-white">{o.user.firstName} {o.user.lastName}</div>
                      <div className="text-xs text-ink-dim">{o.user.email}</div>
                    </td>
                    <td className="py-2 px-4 font-mono">฿{Number(o.totalPrice).toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
                    <td className="py-2 px-4 font-mono">
                      {refundedSatang > 0 ? `฿${(refundedSatang / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}` : "—"}
                    </td>
                    <td className="py-2 px-4">
                      {fullyRefunded ? (
                        <span className="text-xs text-ink-dim">Fully refunded</span>
                      ) : (
                        <RefundButton orderId={o.orderId} />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
