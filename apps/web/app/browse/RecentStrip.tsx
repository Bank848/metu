"use client";
import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { ProductCard, type ProductCardProduct } from "@/components/ProductCard";
import { readIds } from "@/lib/recentlyViewed";

/**
 * Horizontal "Recently viewed" strip rendered at the bottom of /browse.
 * Hydrates from `localStorage` on mount, so guests see their own history
 * even without an account. Empties + hides if there's no history.
 */
export function RecentStrip() {
  const [items, setItems] = useState<ProductCardProduct[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const fetchFor = async (ids: number[]) => {
      if (ids.length === 0) {
        setItems([]);
        setLoaded(true);
        return;
      }
      try {
        const res = await fetch(`/api/products/by-ids?ids=${ids.join(",")}`, {
          credentials: "include",
        });
        if (!res.ok) return;
        const data = await res.json();
        setItems(data.items as ProductCardProduct[]);
      } catch {
        /* silent — strip just stays empty */
      } finally {
        setLoaded(true);
      }
    };

    fetchFor(readIds());

    // Re-hydrate when the user opens another product in another tab, etc.
    const onChange = (e: Event) => {
      const next = (e as CustomEvent).detail as number[];
      fetchFor(next);
    };
    window.addEventListener("metu-recent-change", onChange);
    return () => window.removeEventListener("metu-recent-change", onChange);
  }, []);

  if (!loaded || items.length === 0) return null;

  return (
    <section className="mt-16">
      <div className="flex items-end justify-between mb-4">
        <div>
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-metu-yellow">
            <Clock className="h-3.5 w-3.5" />
            Recently viewed
          </div>
          <h2 className="mt-1 font-display text-xl md:text-2xl font-extrabold text-white">
            Pick up where you left off
          </h2>
        </div>
      </div>
      {/* Horizontal scroller — fixed-width cards so the user can flick. */}
      <div className="no-scrollbar -mx-2 flex gap-4 overflow-x-auto px-2 pb-2 snap-x snap-mandatory">
        {items.map((p) => (
          <div key={p.productId} className="w-64 shrink-0 snap-start">
            <ProductCard product={p} />
          </div>
        ))}
      </div>
    </section>
  );
}
