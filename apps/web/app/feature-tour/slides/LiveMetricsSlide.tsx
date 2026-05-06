"use client";
import { useEffect, useState } from "react";
import { Activity, Crown, ShoppingBag, TrendingUp } from "lucide-react";
import { coins, coinsCompact, thbToCoins } from "@/lib/format";
import type { KioskData } from "@/lib/server/kiosk";

export function LiveMetricsSlide({ data }: { data: KioskData }) {
  // `now` stays null during SSR + initial hydration so the server-
  // rendered HTML and the first client paint agree on the relative-
  // time labels (both render an empty string). After mount, `now`
  // populates and the labels switch on. Without this the kiosk slide
  // logged a hydration mismatch on every minute boundary, and per
  // the Link-in-SVG lesson, hydration errors can cascade and kill
  // click handlers on neighbouring components.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);
  return (
    <div className="relative h-full w-full px-12 py-8 flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <div className="inline-flex items-center gap-2 rounded-full bg-mint/10 text-mint ring-1 ring-mint/30 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider">
          <Activity className="h-3.5 w-3.5" />
          Right now on METU
        </div>
        <div className="text-xs text-ink-dim font-mono">
          fetched {new Date(data.fetchedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false })}
        </div>
      </div>

      <h2 className="font-display text-4xl md:text-5xl font-bold text-white mb-2 leading-tight">
        The marketplace, live
      </h2>
      <p className="text-base text-ink-secondary mb-8">
        Top sellers, biggest sales, and the latest activity — refreshed every
        few minutes from the actual database.
      </p>

      <div className="grid grid-cols-12 gap-6 flex-1 min-h-0">
        {/* Top stores */}
        <section className="col-span-5 rounded-2xl border border-white/10 bg-white/[0.03] p-5 overflow-hidden">
          <header className="flex items-center gap-2 mb-4">
            <Crown className="h-4 w-4 text-metu-yellow" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-ink-dim">
              Top stores by revenue
            </h3>
          </header>
          {data.topStores.length === 0 ? (
            <EmptyHint label="No paid orders yet" />
          ) : (
            <ol className="space-y-3">
              {data.topStores.map((s, i) => (
                <li key={s.storeId} className="flex items-center gap-3">
                  <span className="font-display text-2xl font-extrabold text-metu-yellow w-6 tabular-nums">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-white truncate">{s.name}</div>
                    <div className="text-xs text-ink-dim font-mono">
                      {s.orders} {s.orders === 1 ? "order" : "orders"}
                    </div>
                  </div>
                  <div className="font-mono text-mint tabular-nums">
                    {coinsCompact(thbToCoins(s.revenue))}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>

        {/* Top products */}
        <section className="col-span-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5 overflow-hidden">
          <header className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-4 w-4 text-coral" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-ink-dim">
              Top products
            </h3>
          </header>
          {data.topProducts.length === 0 ? (
            <EmptyHint label="No paid orders yet" />
          ) : (
            <ol className="space-y-3">
              {data.topProducts.map((p, i) => (
                <li key={p.productId} className="flex items-start gap-3">
                  <span className="font-display text-lg font-extrabold text-coral w-5 tabular-nums mt-0.5">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-white truncate">{p.name}</div>
                    <div className="text-xs text-ink-dim truncate">{p.storeName}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-mint text-sm tabular-nums">
                      {coinsCompact(thbToCoins(p.revenue))}
                    </div>
                    <div className="text-[11px] text-ink-dim font-mono">
                      ×{p.units}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>

        {/* Recent orders */}
        <section className="col-span-3 rounded-2xl border border-white/10 bg-white/[0.03] p-5 overflow-hidden">
          <header className="flex items-center gap-2 mb-4">
            <ShoppingBag className="h-4 w-4 text-blue-300" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-ink-dim">
              Latest sales
            </h3>
          </header>
          {data.recentOrders.length === 0 ? (
            <EmptyHint label="No sales yet" />
          ) : (
            <ul className="space-y-2.5 text-sm">
              {data.recentOrders.slice(0, 6).map((o) => (
                <li key={o.orderId}>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-white truncate text-xs">
                      {o.productName}
                    </span>
                    <span className="font-mono text-mint text-xs shrink-0 tabular-nums">
                      {coins(thbToCoins(o.amount))}
                    </span>
                  </div>
                  <div className="text-[11px] text-ink-dim truncate">
                    {o.storeName ?? "—"} {now !== null && `· ${relativeTime(o.createdAt, now)}`}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function EmptyHint({ label }: { label: string }) {
  return (
    <p className="text-xs text-ink-dim italic">{label}</p>
  );
}

function relativeTime(iso: string, now: number): string {
  const t = new Date(iso).getTime();
  const diff = Math.max(0, now - t);
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}
