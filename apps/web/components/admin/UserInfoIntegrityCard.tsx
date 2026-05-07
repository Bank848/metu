import { ShieldCheck } from "lucide-react";
import { SqlTechniqueBadge } from "./SqlTechniqueBadge";

// Section 5c of the CPE241 final report — User Information Integrity
// & Product Order. The report wants two ratios:
//   1. share of users with a "complete" profile
//   2. share of (settled) orders that came from such a user
//
// "Complete" = firstName + lastName + dateOfBirth + countryId + phone
// + profileImage all populated (six fields). Missing any one = the
// user is bucketed as incomplete. The bigger gap between the two
// ratios, the more skewed conversion is towards engaged buyers — a
// signal admin can act on (e.g. require profile completion before
// checkout, or surface "complete your profile" prompts to incomplete
// users to lift the second ratio).

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
  // Conversion lift = how much more likely a complete-profile user is
  // to have placed an order than the average. Computed as the ratio
  // of "share of orders from complete users" to "share of complete
  // users". Above 1.0 → complete users over-index on orders. Below
  // 1.0 → incomplete users somehow place more orders (rare, usually
  // means seed data is skewed).
  const lift = userRate > 0 ? orderRate / userRate : 0;

  return (
    <div className="rounded-2xl border border-line bg-space-900 p-5">
      <header className="mb-3">
        <h3 className="font-display font-bold text-white flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-mint" />
          User information integrity
        </h3>
        <div className="flex items-center gap-1.5 mt-1">
          <SqlTechniqueBadge technique="count-filter" label="COUNT(*) FILTER (WHERE …)" />
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-xl bg-space-950/60 p-3">
          <div className="text-[10px] uppercase tracking-wider text-ink-dim">
            Profile complete
          </div>
          <div className="font-display text-2xl font-extrabold text-white mt-1 tabular-nums">
            {userRate.toFixed(1)}%
          </div>
          <div className="text-[11px] text-ink-dim mt-0.5 tabular-nums">
            {completeUsers.toLocaleString()} / {totalUsers.toLocaleString()} users
          </div>
        </div>
        <div className="rounded-xl bg-mint/[0.06] border border-mint/15 p-3">
          <div className="text-[10px] uppercase tracking-wider text-mint/80">
            Orders from complete users
          </div>
          <div className="font-display text-2xl font-extrabold text-mint mt-1 tabular-nums">
            {orderRate.toFixed(1)}%
          </div>
          <div className="text-[11px] text-ink-dim mt-0.5 tabular-nums">
            {ordersFromComplete.toLocaleString()} / {totalOrders.toLocaleString()} settled
          </div>
        </div>
      </div>

      {/* Lift readout — only meaningful when both ratios are non-zero. */}
      {userRate > 0 && orderRate > 0 && (
        <div className="mt-3 text-xs text-ink-secondary tabular-nums">
          Complete-profile users are{" "}
          <span className={lift >= 1 ? "text-mint font-semibold" : "text-coral font-semibold"}>
            {lift.toFixed(2)}×
          </span>{" "}
          more likely to convert than average.
        </div>
      )}

      <p className="mt-2 text-[10px] text-ink-dim font-mono leading-relaxed">
        complete = firstName + lastName + DOB + country + phone + avatar
      </p>
    </div>
  );
}
