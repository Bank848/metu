"use client";
import { useState, useCallback, useMemo, useRef } from "react";
import { ProductCard, type ProductCardProduct } from "@/components/ProductCard";
import Link from "next/link";
import { ArrowRight, Loader2 } from "lucide-react";

const PAGE_SIZE = 8; // 2 rows × 4 cols
const MAX_PAGES = 5;

export default function TrendingProducts({
  products,
  favSet,
}: {
  products: ProductCardProduct[];
  favSet: Set<number>;
}) {
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const loaderRef = useRef<HTMLDivElement>(null);

  // Slice only what's needed for current page(s)
  const visible = useMemo(
    () => products.slice(0, page * PAGE_SIZE),
    [products, page]
  );

  const hasMore = page < MAX_PAGES && products.length > page * PAGE_SIZE;

  const loadMore = useCallback(() => {
    if (isLoading || !hasMore) return;
    setIsLoading(true);
    // Defer to next frame so UI doesn't block
    requestAnimationFrame(() => {
      setPage((p) => p + 1);
      setIsLoading(false);
    });
  }, [isLoading, hasMore]);

  if (!products.length) return null;

  return (
    <section className="mx-auto max-w-[1440px] px-5 sm:px-6 md:px-10 py-12 sm:py-20">

      {/* ── Header ── */}
      <div className="flex items-end justify-between mb-8 gap-4 flex-wrap">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.18em] text-mint">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-mint animate-pulse" />
            This week
          </div>
          <h2 className="font-display text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-white">
            Trending now
          </h2>
          <p className="mt-1 text-sm sm:text-base text-ink-secondary">
            The digital products creators are loving this week.
          </p>
        </div>
        <Link
          href="/browse"
          className="group inline-flex items-center gap-1.5 text-sm font-semibold text-metu-yellow hover:gap-2.5 transition-all duration-200"
        >
          See all
          <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
        </Link>
      </div>

      {/* ── Grid: 2 rows × 4 cols ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
        {visible.map((product, i) => {
          // Only animate newly revealed items (current page batch)
          const batchStart = (page - 1) * PAGE_SIZE;
          const isNew = i >= batchStart;
          const delay = isNew ? (i - batchStart) * 50 : 0;

          return (
            <div
              key={product.productId}
              className={isNew ? "animate-[stagger-rise_0.5s_cubic-bezier(0.22,1,0.36,1)_both]" : undefined}
              style={isNew ? { animationDelay: `${delay}ms` } : undefined}
            >
              <ProductCard
                product={product}
                isFavorited={favSet.has(product.productId)}
              />
            </div>
          );
        })}
      </div>

      {/* ── Load more ── */}
      {hasMore && (
        <div ref={loaderRef} className="mt-10 flex flex-col items-center gap-3">
          <button
            onClick={loadMore}
            disabled={isLoading}
            className="group relative inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-7 py-2.5 text-sm font-medium text-white/70 transition-all duration-200 hover:border-white/20 hover:bg-white/[0.06] hover:text-white disabled:opacity-40"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading…
              </>
            ) : (
              <>
                Load more
                <span className="text-xs text-white/30">
                  · page {page + 1} of {MAX_PAGES}
                </span>
              </>
            )}
          </button>

          {/* Page dots */}
          <div className="flex items-center gap-1.5">
            {Array.from({ length: MAX_PAGES }).map((_, i) => (
              <span
                key={i}
                className={`block rounded-full transition-all duration-300 ${
                  i < page
                    ? "h-1.5 w-4 bg-metu-yellow/70"
                    : "h-1.5 w-1.5 bg-white/15"
                }`}
              />
            ))}
          </div>
        </div>
      )}

      {/* End-of-list message */}
      {!hasMore && page > 1 && (
        <p className="mt-10 text-center text-xs text-white/25 tracking-widest uppercase font-mono">
          — all {visible.length} products shown —
        </p>
      )}
    </section>
  );
}