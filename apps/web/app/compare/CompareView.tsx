"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Star, X, Scale } from "lucide-react";
import { GlassButton } from "@/components/visual/GlassButton";
import { EmptyState } from "@/components/EmptyState";
import { money } from "@/lib/format";
import { isDataUrl } from "@/lib/utils";
import { readIds, toggle, clear } from "@/lib/compareList";

type Item = {
  productId: number;
  name: string;
  image: string;
  storeName?: string;
  storeId?: number;
  minPrice: number;
  maxPrice?: number;
  avgRating?: number;
  reviewCount?: number;
  discountPercent?: number;
};

export function CompareView() {
  const [items, setItems] = useState<Item[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const fetchFor = async (ids: number[]) => {
      if (ids.length === 0) {
        setItems([]);
        setLoaded(true);
        return;
      }
      try {
        const res = await fetch(`/api/products/by-ids?ids=${ids.join(",")}`);
        if (!res.ok) return;
        const data = await res.json();
        setItems(data.items as Item[]);
      } finally {
        setLoaded(true);
      }
    };
    fetchFor(readIds());
    const handler = (e: Event) => fetchFor((e as CustomEvent).detail as number[]);
    window.addEventListener("metu-compare-change", handler);
    return () => window.removeEventListener("metu-compare-change", handler);
  }, []);

  if (!loaded) return <p className="text-center text-ink-dim py-8">Loading…</p>;

  if (items.length === 0) {
    return (
      <EmptyState
        title="Nothing to compare yet"
        description="Add products to comparison from any product card (the scale icon)."
        icon={<Scale className="h-8 w-8" />}
        action={<GlassButton tone="gold" href="/browse">Browse marketplace →</GlassButton>}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <GlassButton tone="glass" size="sm" onClick={() => clear()}>
          Clear all
        </GlassButton>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-separate border-spacing-x-3">
          <tbody>
            {/* Image + remove */}
            <tr>
              <th className="w-32 text-left text-xs font-semibold text-ink-dim uppercase tracking-wider"></th>
              {items.map((it) => (
                <td key={it.productId} className="rounded-2xl glass-morphism p-4 align-top">
                  <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-surface-2 mb-3">
                    <Image
                      src={it.image}
                      alt=""
                      fill
                      sizes="280px"
                      className="object-cover"
                      unoptimized={isDataUrl(it.image)}
                    />
                    <button
                      type="button"
                      onClick={() => toggle(it.productId)}
                      aria-label="Remove from comparison"
                      className="absolute top-1.5 right-1.5 inline-flex items-center justify-center h-6 w-6 rounded-full bg-surface-1/80 text-white hover:bg-metu-red/40"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                  <Link
                    href={`/product/${it.productId}`}
                    className="font-display font-bold text-white hover:text-metu-yellow line-clamp-2"
                  >
                    {it.name}
                  </Link>
                  {it.storeName && (
                    <Link
                      href={`/store/${it.storeId}`}
                      className="text-xs text-ink-dim hover:text-metu-yellow"
                    >
                      {it.storeName}
                    </Link>
                  )}
                </td>
              ))}
            </tr>

            <Row label="Price">
              {items.map((it) => (
                <td key={it.productId} className="px-4 py-3 text-sm text-white">
                  <span className="font-display text-base font-bold text-gold-gradient">
                    {money(it.minPrice)}
                  </span>
                  {it.maxPrice && it.maxPrice !== it.minPrice && (
                    <span className="text-ink-dim"> – {money(it.maxPrice)}</span>
                  )}
                </td>
              ))}
            </Row>

            <Row label="Rating">
              {items.map((it) => (
                <td key={it.productId} className="px-4 py-3 text-sm">
                  {it.avgRating !== undefined ? (
                    <span className="inline-flex items-center gap-1 text-white">
                      <Star className="h-3.5 w-3.5 fill-metu-yellow stroke-metu-yellow" />
                      {it.avgRating.toFixed(1)}
                      <span className="text-ink-dim">({it.reviewCount ?? 0})</span>
                    </span>
                  ) : (
                    <span className="text-ink-dim">—</span>
                  )}
                </td>
              ))}
            </Row>

            <Row label="Discount">
              {items.map((it) => (
                <td key={it.productId} className="px-4 py-3 text-sm">
                  {it.discountPercent ? (
                    <span className="text-metu-yellow font-bold">−{it.discountPercent}%</span>
                  ) : (
                    <span className="text-ink-dim">—</span>
                  )}
                </td>
              ))}
            </Row>

            <Row label="">
              {items.map((it) => (
                <td key={it.productId} className="px-4 py-3">
                  <GlassButton tone="gold" size="sm" href={`/product/${it.productId}`}>
                    View →
                  </GlassButton>
                </td>
              ))}
            </Row>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <tr>
      <th className="text-left text-[11px] font-semibold text-ink-dim uppercase tracking-wider align-top pt-4">
        {label}
      </th>
      {children}
    </tr>
  );
}
