"use client";
import { useEffect, useMemo, useState } from "react";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { Button } from "@/components/ui/Button";
import { Loader2 } from "lucide-react";

// bfcache + Stripe Elements quirk: when the buyer hits browser-back
// from the Stripe-hosted 3DS flow, browsers may restore the page from
// the back-forward cache with the Stripe iframe state half-attached —
// leaving an orphaned floating "Pay" / wallet button visible above
// the page. Easiest fix: detect a bfcache restore (event.persisted)
// and force a full reload so Stripe Elements re-mounts cleanly.
function useReloadOnBfcacheRestore() {
  useEffect(() => {
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) {
        // Bfcache restore — reload to wipe any orphaned Stripe DOM.
        window.location.reload();
      }
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);
}

/**
 * Stripe Payment Element host. Renders inside the buyer's
 * checkout page, confirms via stripe.js, then redirects back to
 * /orders/[orderId] which polls the webhook-driven status flip.
 * Test cards (test mode only):
 *   4242 4242 4242 4242   — succeeds
 *   4000 0000 0000 0002   — generic decline
 *   4000 0027 6000 3184   — requires 3DS auth
 */
export function CheckoutForm({
  orderId,
  clientSecret,
  publishableKey,
  stripeAccount,
}: {
  orderId: number;
  clientSecret: string;
  publishableKey: string;
  /**
   * for direct-charge Connect orders the
   * PaymentIntent lives on the seller's Connect account, so Stripe.js
   * must be scoped with `stripeAccount`. Without this, PaymentElement
   * fails to mount with `Unhandled payment Element loaderror`.
   */
  stripeAccount: string | null;
}) {
  useReloadOnBfcacheRestore();

  const stripePromise = useMemo<Promise<Stripe | null>>(
    () =>
      stripeAccount
        ? loadStripe(publishableKey, { stripeAccount })
        : loadStripe(publishableKey),
    [publishableKey, stripeAccount],
  );

  return (
    <Elements
      stripe={stripePromise}
      options={{
        clientSecret,
        appearance: { theme: "night", labels: "floating" },
      }}
    >
      <InnerForm orderId={orderId} clientSecret={clientSecret} />
    </Elements>
  );
}

function InnerForm({ orderId, clientSecret }: { orderId: number; clientSecret: string }) {
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
    // Validate the PaymentElement BEFORE asking Stripe to confirm. Without
    // this, clicking Pay now with an empty card field hands `confirmPayment`
    // an unvalidated form and the iframe quietly waits for input that the
    // user can't see — busy stays true and the button hangs on
    // "Confirming…" forever. `elements.submit()` triggers the same
    // built-in validation Stripe shows after a real submit attempt and
    // surfaces inline field errors to the buyer.
    const submission = await elements.submit();
    if (submission.error) {
      setError(submission.error.message ?? "Please fill in your payment details.");
      setBusy(false);
      return;
    }
    const result = await stripe.confirmPayment({
      elements,
      clientSecret,
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
