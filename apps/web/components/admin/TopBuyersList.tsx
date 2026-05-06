import Link from "next/link";
import { Crown } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { coins, thbToCoins } from "@/lib/format";
import { SqlTechniqueBadge } from "./SqlTechniqueBadge";

interface Buyer {
  userId: number;
  firstName: string;
  lastName: string;
  username: string;
  profileImage: string | null;
  orders: number;
  spend: number;
}

// Top buyers leaderboard. Renders a 5-row list with avatars + lifetime
// spend, ranked by SUM(orders.total_price). The #1 row gets a crown
// chip; others get monospace rank numbers (matches the Top Stores
// list visual rhythm).
//
// Click-through to /admin/users?q=<username> so the operator can
// drill into the buyer's full profile + order history.
export function TopBuyersList({ buyers }: { buyers: Buyer[] }) {
  const max = Math.max(1, ...buyers.map((b) => b.spend));

  return (
    <div className="rounded-2xl border border-line bg-space-900 p-5">
      <header className="mb-3">
        <h3 className="font-display font-bold text-white flex items-center gap-2">
          <Crown className="h-4 w-4 text-metu-yellow" />
          Top buyers (lifetime)
        </h3>
        <div className="flex items-center gap-1.5 mt-1">
          <SqlTechniqueBadge technique="join-group" label="JOIN users + GROUP BY" />
        </div>
      </header>

      {buyers.length === 0 ? (
        <p className="text-xs text-ink-dim italic">No paid orders yet.</p>
      ) : (
        <ol className="space-y-2.5">
          {buyers.map((b, i) => {
            const pct = (b.spend / max) * 100;
            return (
              <li key={b.userId}>
                <Link
                  href={`/admin/users?q=${encodeURIComponent(b.username)}`}
                  className="group flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-white/[0.04] transition"
                >
                  <span className="text-ink-dim text-xs font-mono w-5 shrink-0">
                    {i === 0 ? <Crown className="h-3.5 w-3.5 text-metu-yellow" /> : `${i + 1}.`}
                  </span>
                  <Avatar
                    name={`${b.firstName} ${b.lastName}`}
                    email={b.username}
                    src={b.profileImage}
                    size="sm"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-white truncate group-hover:text-metu-yellow">
                        {b.firstName} {b.lastName}
                      </span>
                      <span className="font-mono text-xs text-mint shrink-0 tabular-nums">
                        {coins(thbToCoins(b.spend))}
                      </span>
                    </div>
                    {/* Inline spend bar so the eye sees rank distribution. */}
                    <div className="mt-1 flex items-center gap-2">
                      <span className="flex-1 h-1 rounded-full bg-space-950 overflow-hidden">
                        <span
                          className="block h-full bg-metu-yellow animate-bar-extend"
                          style={{
                            ["--target-w" as string]: `${pct}%`,
                            animationDelay: `${i * 60}ms`,
                          }}
                        />
                      </span>
                      <span className="text-[10px] text-ink-dim font-mono tabular-nums shrink-0">
                        {b.orders} ord
                      </span>
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
