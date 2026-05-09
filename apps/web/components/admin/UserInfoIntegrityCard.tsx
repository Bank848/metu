import { ShieldCheck } from "lucide-react";
import { SqlTechniqueBadge } from "./SqlTechniqueBadge";

// User Information Integrity card — surfaces two ratios:
//   1. share of users with a complete profile (six fields populated)
//   2. share of settled orders placed by such users
// A bigger gap between them = conversion is skewed toward engaged buyers.

interface Props {
  totalUsers: number;
  completeUsers: number;
  totalOrders: number;
  ordersFromComplete: number;
}

export function UserInfoIntegrityCard({
  totalUsers,
  completeUsers,
  totalOrders,
  ordersFromComplete,
}: Props) {
  const userRate = totalUsers > 0 ? (completeUsers / totalUsers) * 100 : 0;
  const orderRate = totalOrders > 0 ? (ordersFromComplete / totalOrders) * 100 : 0;
  // Lift > 1 → complete-profile users over-index on orders.
  const lift = userRate > 0 ? orderRate / userRate : 0;

  const liftMeaningful = userRate > 0 && orderRate > 0;
  const liftAccent = lift >= 1 ? "mint" : "coral";

  return (
    <div className="rounded-2xl border border-line/80 bg-space-850 p-5 shadow-flat">
      <header className="mb-3">
        <h3 className="font-display text-base font-bold text-white flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-mint" />
          User information integrity
        </h3>
        <div className="flex items-center gap-1.5 mt-1">
          <SqlTechniqueBadge technique="count-filter" label="COUNT(*) FILTER (WHERE …)" />
        </div>
      </header>

      {/* Lead with the lift; the two ratios below are supporting context. */}
      {liftMeaningful && (
        <div
          className={
            "mb-3 rounded-xl p-4 " +
            (liftAccent === "mint"
              ? "bg-mint/10 ring-1 ring-mint/30"
              : "bg-coral/10 ring-1 ring-coral/30")
          }
        >
          <div
            className={
              "text-[10px] uppercase tracking-wider mb-1 " +
              (liftAccent === "mint" ? "text-mint" : "text-coral")
            }
          >
            Conversion lift
          </div>
          <div
            className={
              "font-display text-3xl font-extrabold tabular-nums " +
              (liftAccent === "mint" ? "text-mint" : "text-coral")
            }
          >
            {lift.toFixed(2)}×
          </div>
          <div className="text-xs text-ink-secondary mt-1">
            Complete profiles convert at this multiple of the platform average.
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-xl bg-space-800 ring-1 ring-line p-3">
          <div className="text-[10px] uppercase tracking-wider text-ink-secondary">
            Profile complete
          </div>
          <div className="font-display text-xl font-bold text-white mt-1 tabular-nums">
            {userRate.toFixed(1)}%
          </div>
          <div className="text-[11px] text-ink-secondary mt-0.5 tabular-nums">
            {completeUsers.toLocaleString()} / {totalUsers.toLocaleString()} users
          </div>
        </div>
        <div className="rounded-xl bg-space-800 ring-1 ring-line p-3">
          <div className="text-[10px] uppercase tracking-wider text-ink-secondary">
            Orders from complete users
          </div>
          <div className="font-display text-xl font-bold text-white mt-1 tabular-nums">
            {orderRate.toFixed(1)}%
          </div>
          <div className="text-[11px] text-ink-secondary mt-0.5 tabular-nums">
            {ordersFromComplete.toLocaleString()} / {totalOrders.toLocaleString()} settled
          </div>
        </div>
      </div>

      <p className="mt-3 text-[10px] text-ink-dim italic leading-relaxed">
        complete = firstName + lastName + DOB + country + phone + avatar
      </p>
    </div>
  );
}
