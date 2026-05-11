"use client";

import Link from "next/link";
import { coins, thbToCoins } from "@/lib/format";
import { PaginatedList } from "./PaginatedList";

interface Product {
  productId: number;
  name: string;
  revenue: number;
  units: number;
}

/**
 * Client wrapper for the dashboard's top-products list. Same RSC
 * boundary reason as TopStoresList — render callback stays in the
 * client component so the page server component only ships data.
 */
export function TopProductsList({ products }: { products: Product[] }) {
  return (
    <div className="space-y-2 text-sm">
      <PaginatedList
        items={products}
        empty={<p className="text-ink-dim">No product sales yet.</p>}
        renderItem={(p, i) => (
          <div
            key={p.productId}
            className="flex items-center justify-between border-b border-line/50 pb-1.5"
          >
            <span className="flex items-center gap-2">
              <span className="text-ink-dim text-xs font-mono w-5">{i + 1}.</span>
              <Link
                href={`/product/${p.productId}`}
                className="text-white hover:text-metu-yellow truncate max-w-[200px]"
              >
                {p.name}
              </Link>
              <span className="text-xs text-ink-dim">×{p.units}</span>
            </span>
            <span className="font-mono text-mint">
              {coins(thbToCoins(p.revenue))}
            </span>
          </div>
        )}
      />
    </div>
  );
}
