import { ExternalLink, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { apiFetch, ApiError } from "@/lib/server/api";
import { OnboardingActions } from "./OnboardingActions";

export const dynamic = "force-dynamic";

/**
 * Stripe Connect Express onboarding entry point.
 * Server component: pulls the live status from the API. Client child
 * handles the POST → redirect dance to the Stripe-hosted onboarding URL.
 */
export default async function SellerOnboardingPage() {
  const status = await fetchStatus();

  return (
    <main id="main" className="px-8 py-8 max-w-3xl">
      <PageHeader
        title="Stripe Connect"
        subtitle="Link your store to Stripe (test mode) so buyers can pay you directly. Stripe handles balance, refunds, and weekly payouts to your bank — we don't store any of that data ourselves."
      />

      <div className="mt-6 grid gap-6">
        <StatusCard status={status} />
        <OnboardingActions status={status} />
        <TestCardCard />
      </div>
    </main>
  );
}

interface Status {
  configured: boolean;
  stripeAccountId?: string | null;
  payoutsEnabled?: boolean;
  chargesEnabled?: boolean;
  message?: string;
  errorKind?: "not-configured" | "auth" | "no-store" | "unknown";
}

async function fetchStatus(): Promise<Status> {
  // Use the shared apiFetch helper — it forwards the request cookie
  // via Next's headers() so the requireAuth() + requireStore() gates
  // on the API recognise the seller's session.
  try {
    return await apiFetch<Status>("/seller/stripe/status");
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 503) {
        return {
          configured: false,
          errorKind: "not-configured",
          message: "Stripe is not configured.",
        };
      }
      if (err.status === 401) {
        return {
          configured: false,
          errorKind: "auth",
          message: "Sign in again to view Stripe Connect status.",
        };
      }
      if (err.status === 403) {
        return {
          configured: false,
          errorKind: "no-store",
          message: "Create a store first to enable Stripe Connect.",
        };
      }
    }
    return {
      configured: false,
      errorKind: "unknown",
      message: "Couldn’t load Stripe Connect status.",
    };
  }
}

function StatusCard({ status }: { status: Status }) {
  if (!status.configured) {
    const kind = status.errorKind ?? "not-configured";
    const heading =
      kind === "auth"
        ? "Session expired"
        : kind === "no-store"
          ? "No store yet"
          : kind === "unknown"
            ? "Couldn’t load status"
            : "Stripe not configured";
    const body =
      kind === "auth" ? (
        <>Your session expired. Sign in again to manage Stripe Connect.</>
      ) : kind === "no-store" ? (
        <>
          You need a store before linking Stripe. Visit your seller area and pick{" "}
          <strong>Become a seller</strong> first.
        </>
      ) : kind === "unknown" ? (
        <>{status.message ?? "Try again in a moment."}</>
      ) : (
        <>
          The server is missing <code>STRIPE_SECRET_KEY</code>. Set it via flyctl
          secrets to enable Connect onboarding.
        </>
      );
    return (
      <section className="rounded-2xl border border-amber-400/30 bg-amber-400/5 p-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-amber-400 mt-0.5 shrink-0" />
          <div>
            <h2 className="font-semibold text-amber-100">{heading}</h2>
            <p className="text-sm text-amber-100/80 mt-1">{body}</p>
          </div>
        </div>
      </section>
    );
  }
  if (!status.stripeAccountId) {
    return (
      <section className="rounded-2xl border border-line bg-space-900 p-6">
        <h2 className="font-semibold text-white mb-1">Not linked yet</h2>
        <p className="text-sm text-ink-secondary">
          Click <strong>Start onboarding</strong> below to create a Stripe Express account. Stripe asks for a few business details (name, address, bank info) and routes you back here when you&#x2019;re done.
        </p>
      </section>
    );
  }
  const ready = status.chargesEnabled && status.payoutsEnabled;
  return (
    <section className={`rounded-2xl border p-6 ${ready ? "border-mint/40 bg-mint/5" : "border-amber-400/30 bg-amber-400/5"}`}>
      <div className="flex items-start gap-3">
        {ready ? (
          <CheckCircle2 className="h-5 w-5 text-mint mt-0.5 shrink-0" />
        ) : (
          <Loader2 className="h-5 w-5 text-amber-400 mt-0.5 shrink-0" />
        )}
        <div>
          <h2 className={`font-semibold ${ready ? "text-mint" : "text-amber-100"}`}>
            {ready ? "Connected & ready" : "Onboarding in progress"}
          </h2>
          <ul className="text-sm mt-2 space-y-0.5">
            <li className={status.chargesEnabled ? "text-mint" : "text-amber-100/80"}>
              {status.chargesEnabled ? "✓" : "○"} Charges enabled
            </li>
            <li className={status.payoutsEnabled ? "text-mint" : "text-amber-100/80"}>
              {status.payoutsEnabled ? "✓" : "○"} Payouts enabled
            </li>
            <li className="text-ink-dim font-mono text-xs mt-1">
              {status.stripeAccountId}
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
}

function TestCardCard() {
  return (
    <section className="rounded-2xl border border-line bg-space-900 p-6">
      <h2 className="font-semibold text-white mb-3 flex items-center gap-2">
        <ExternalLink className="h-4 w-4 text-mint" />
        Test cards (test mode only)
      </h2>
      <table className="w-full text-sm">
        <tbody>
          <tr><td className="py-1 font-mono text-mint">4242 4242 4242 4242</td><td className="py-1 text-ink-secondary">Succeeds</td></tr>
          <tr><td className="py-1 font-mono text-coral">4000 0000 0000 0002</td><td className="py-1 text-ink-secondary">Generic decline</td></tr>
          <tr><td className="py-1 font-mono text-amber-300">4000 0027 6000 3184</td><td className="py-1 text-ink-secondary">Requires 3DS auth</td></tr>
        </tbody>
      </table>
      <p className="text-xs text-ink-dim mt-3">
        Any future expiry, any 3-digit CVC, any postcode. Stripe&#x2019;s test ledger is sandboxed — no real money moves.
      </p>
    </section>
  );
}
