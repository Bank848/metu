"use client";
import { useEffect, useMemo, useState } from "react";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { Button } from "@/components/ui/Button";
import { Loader2 } from "lucide-react";

/**
 * Phase 27 — Stripe Payment Element host. Renders inside the buyer's
 * checkout page, confirms via stripe.js, then redirects back to
 * /orders/[orderId] which polls the webhook-driven status flip.
 *
 * Test cards (test mode only):
 *   4242 4242 4242 4242   — succeeds
 *   4000 0000 0000 0002   — generic decline
 *   4000 0027 6000 3184   — requires 3DS auth
 */
export function CheckoutForm({
  orderId,
  clientSecret,
  publishableKey,
}: {
  orderId: number;
  clientSecret: string;
  publishableKey: string;
}) {
  const stripePromise = useMemo<Promise<Stripe | null>>(
    () => loadStripe(publishableKey),
    [publishableKey],
  );

  return (
    <Elements
      stripe={stripePromise}
      options={{
        clientSecret,
        appearance: { theme: "night", labels: "floating" },
      }}
    >
      <InnerForm orderId={orderId} />
    </Elements>
  );
}

function InnerForm({ orderId }: { orderId: number }) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Stripe.js sometimes lands its initial mount before the iframe is
  // fully painted ; track readiness to disable the submit button until
  // the user actually has fields to fill.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (stripe && elements) setReady(true);
  }, [stripe, elements]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setBusy(true);
    setError(null);
    const result = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/orders/${orderId}?new=1`,
      },
    });
    if (result.error) {
      setError(result.error.message ?? "Payment could not be confirmed");
      setBusy(false);
    }
    // Success path: Stripe redirects to return_url so we never reach here.
  }

  return (
    <form onSubmit={onSubmit} className="rounded-2xl border border-line bg-space-900 p-6">
      <PaymentElement />
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-400">
          {error}
        </p>
      )}
      <Button
        type="submit"
        variant="primary"
        disabled={!ready || busy}
        className="mt-6 w-full"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {busy ? "Confirming…" : "Pay now"}
      </Button>
      <p className="mt-4 text-center text-xs text-ink-dim">
        Test mode &middot; use card <code>4242 4242 4242 4242</code>, any future expiry, any CVC.
      </p>
    </form>
  );
}
