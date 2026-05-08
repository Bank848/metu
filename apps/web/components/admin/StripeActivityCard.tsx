import { Activity, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { apiFetch, ApiError } from "@/lib/server/api";

type StripeEvent = {
  id: string;
  type: string;
  created: number;
  objectId: string | null;
  amount: number | null;
  currency: string | null;
  status: string | null;
};

type ActivityFeed = {
  balance: {
    available: { amount: number; currency: string }[];
    pending: { amount: number; currency: string }[];
  };
  events: StripeEvent[];
};

const fmtBangkok = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Bangkok",
  month: "short",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function tone(type: string): "success" | "info" | "warning" | "danger" | "purple" | "mist" {
  if (type.includes("succeeded") || type === "payout.paid") return "success";
  if (type.includes("failed")) return "danger";
  if (type.includes("refund")) return "purple";
  if (type === "transfer.created") return "info";
  return "mist";
}

function fmtAmount(amount: number | null, currency: string | null): string {
  if (amount === null) return "—";
  const cur = (currency ?? "thb").toUpperCase();
  // Stripe amounts are in the smallest currency unit (satang for THB).
  const major = amount / 100;
  return `${major.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${cur}`;
}

/**
 * Server component: fetches the platform Stripe activity feed and
 * renders it as a card on /admin overview. Read-only — no Stripe
 * action buttons here. Use existing /admin/refunds for refund actions.
 * Falls back to a "not configured" stub if STRIPE_SECRET_KEY is missing.
 */
export async function StripeActivityCard() {
  let data: ActivityFeed | null = null;
  let errorMsg: string | null = null;
  try {
    data = await apiFetch<ActivityFeed>("/admin/stripe/activity");
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 503) {
        errorMsg = "Stripe is not configured on the server.";
      } else if (err.status === 401 || err.status === 403) {
        errorMsg = "Sign in again to view Stripe activity.";
      } else {
        errorMsg = `Couldn't load Stripe activity (${err.status}).`;
      }
    } else {
      errorMsg = "Couldn't load Stripe activity.";
    }
  }

  return (
    <section className="rounded-2xl border border-line bg-space-850">
      <div className="px-6 py-4 border-b border-line flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-mint" />
          <h2 className="font-display font-bold text-white">Stripe activity</h2>
          <span className="text-[10px] uppercase tracking-wider text-ink-dim">live</span>
        </div>
        {data && (
          <span className="text-xs text-ink-dim font-mono">
            {data.events.length} recent · available{" "}
            {data.balance.available.map((b) => fmtAmount(b.amount, b.currency)).join(" + ") || "—"}
          </span>
        )}
      </div>

      {errorMsg ? (
        <div className="px-6 py-6 flex items-start gap-3">
          <AlertCircle className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
          <p className="text-sm text-amber-100/80">{errorMsg}</p>
        </div>
      ) : data && data.events.length === 0 ? (
        <div className="px-6 py-6 text-sm text-ink-dim">No Stripe events in the last 30 days.</div>
      ) : data ? (
        <ul className="divide-y divide-line max-h-[420px] overflow-y-auto">
          {data.events.map((e) => (
            <li key={e.id} className="px-6 py-3 flex items-center gap-3">
              <Badge variant={tone(e.type)} className="font-mono text-[10px] shrink-0">
                {e.type}
              </Badge>
              <div className="flex-1 min-w-0">
                <div className="font-mono text-xs text-white truncate">
                  {e.objectId ?? e.id}
                </div>
                <div className="text-[10px] text-ink-dim">
                  {fmtBangkok.format(new Date(e.created * 1000))}
                  {e.status ? ` · ${e.status}` : ""}
                </div>
              </div>
              <div className="font-mono text-xs text-mint shrink-0">
                {fmtAmount(e.amount, e.currency)}
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
