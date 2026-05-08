"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { Button } from "@/components/ui/Button";
import { Loader2, AlertCircle } from "lucide-react";

// bfcache + Stripe Elements quirk: when the buyer hits browser-back
// from the Stripe-hosted 3DS flow, browsers may restore the page from
// the back-forward cache with the Stripe iframe state half-attached.
// Force a full reload so Stripe Elements re-mounts cleanly.
function useReloadOnBfcacheRestore() {
  useEffect(() => {
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) {
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
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // True once <PaymentElement /> has actually mounted its iframe.
  // Without this, Pay was clickable while Stripe was still loading and
  // the button got stuck on "Confirming…" forever.
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [slowLoad, setSlowLoad] = useState(false);

  // If Elements never mounts within ~10s, surface a refresh CTA.
  // Otherwise the form sits at "Loading payment form…" indefinitely
  // when the seller's stripeAccount doesn't match the PI's account, a
  // CSP rule blocks the iframe, etc.
  useEffect(() => {
    if (ready || loadError) return;
    const t = window.setTimeout(() => setSlowLoad(true), 10_000);
    return () => window.clearTimeout(t);
  }, [ready, loadError]);

  // If the user navigated BACK to this page after a successful redirect
  // (the PI is already succeeded/processing on Stripe), don't let them
  // submit again — bounce to the receipt page where the webhook flip
  // is awaited. Same for cancellations: surface the error rather than
  // silently mounting a dead form.
  useEffect(() => {
    if (!stripe) return;
    let cancelled = false;
    stripe.retrievePaymentIntent(clientSecret).then((res) => {
      if (cancelled) return;
      const pi = res.paymentIntent;
      if (!pi) return;
      if (pi.status === "succeeded" || pi.status === "processing") {
        router.replace(`/orders/${orderId}?new=1`);
      } else if (pi.status === "canceled") {
        setError("This payment was cancelled. Start a new checkout from your cart.");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [stripe, clientSecret, orderId, router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements || !ready) return;
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
    <form onSubmit={onSubmit} className="max-w-md mx-auto rounded-2xl border border-line bg-space-900 p-6">
      <div className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-metu-yellow/15 ring-1 ring-metu-yellow/30 px-2.5 py-1 text-[10px] font-mono text-metu-yellow uppercase tracking-wider">
        <AlertCircle className="h-3 w-3" />
        Test mode · no real charge
      </div>
      <PaymentElement
        onReady={() => setReady(true)}
        onLoadError={(e) =>
          setLoadError(e.error?.message ?? "Couldn't load the payment form.")
        }
      />
      {(loadError || (slowLoad && !ready)) && (
        <div role="alert" className="mt-4 rounded-xl border border-coral/40 bg-coral/5 p-3 text-sm text-coral">
          <p className="font-semibold mb-1">
            {loadError ? "Payment form failed to load." : "Payment form is taking longer than usual."}
          </p>
          <p className="text-xs text-coral/80 mb-2">
            {loadError ?? "It usually loads within a few seconds. Refresh the page or return to your cart and try again."}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-full bg-coral/20 px-3 py-1 text-xs font-semibold hover:bg-coral/30 transition"
            >
              Refresh
            </button>
            <button
              type="button"
              onClick={() => router.push("/cart")}
              className="rounded-full ring-1 ring-coral/40 px-3 py-1 text-xs font-semibold hover:bg-coral/10 transition"
            >
              Back to cart
            </button>
          </div>
        </div>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-400">
          {error}
        </p>
      )}
      <Button
        type="submit"
        variant="primary"
        disabled={!ready || busy || !!loadError}
        className="mt-6 w-full"
      >
        {(busy || (!ready && !loadError)) ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {busy ? "Confirming…" : loadError ? "Payment form unavailable" : !ready ? "Loading payment form…" : "Pay now"}
      </Button>
      <p className="mt-4 text-center text-xs text-ink-dim">
        Test mode &middot; use card <code>4242 4242 4242 4242</code>, any future expiry, any CVC.
      </p>
    </form>
  );
}
