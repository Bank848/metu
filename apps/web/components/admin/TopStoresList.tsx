"use client";

import Link from "next/link";
import { coins, thbToCoins } from "@/lib/format";
import { PaginatedList } from "./PaginatedList";

interface Store {
  storeId: number;
  name: string;
  revenue: number;
  orders: number;
  rating: number;
}

/**
 * Client wrapper for the dashboard's top-stores list. RSC can't
 * serialize render callbacks across the server/client boundary, so
 * we keep the row JSX inside this client component and only pass the
 * plain data array down from the page server component.
 */
export function TopStoresList({ stores }: { stores: Store[] }) {
  return (
    <div className="space-y-2 text-sm">
      <PaginatedList
        items={stores}
        empty={
          <p className="text-ink-dim">
            No store revenue yet — refresh the matview after the first paid order to populate.
          </p>
        }
        renderItem={(s, i) => (
          <div
            key={s.storeId}
            className="flex items-center justify-between border-b border-line/50 pb-1.5"
          >
            <span className="flex items-center gap-2 min-w-0">
              <span className="text-ink-dim text-xs font-mono w-5">{i + 1}.</span>
              <Link
                href={`/admin/stores/${s.storeId}`}
                className="text-white hover:text-metu-yellow truncate max-w-[180px]"
              >
                {s.name}
              </Link>
              {s.rating > 0 && (
                <span className="text-xs text-metu-yellow font-mono">
                  {(s.rating / 10).toFixed(1)}★
                </span>
              )}
            </span>
            <span className="font-mono text-mint">
              {coins(thbToCoins(s.revenue))}
            </span>
          </div>
        )}
      />
    </div>
  );
}
