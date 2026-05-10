"use client";

import { useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * Generic page-by-5 view over a server-prefetched array. The dashboard
 * already ships top-25 buyer / store / product slices in one round
 * trip; this component just slices them client-side and surfaces a
 * "page X / Y" footer with prev/next so the admin can scroll past
 * the first five without another network hop.
 */
export function PaginatedList<T>({
  items,
  pageSize = 5,
  renderItem,
  empty,
}: {
  items: T[];
  pageSize?: number;
  renderItem: (item: T, index: number) => ReactNode;
  empty?: ReactNode;
}) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const slice = items.slice(start, start + pageSize);

  if (items.length === 0 && empty !== undefined) return <>{empty}</>;

  return (
    <>
      {slice.map((item, i) => renderItem(item, start + i))}
      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-2 mt-3 pt-3 border-t border-line/50">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={safePage <= 1}
            className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-semibold text-ink-secondary hover:border-metu-yellow/40 hover:text-metu-yellow disabled:opacity-30 disabled:cursor-not-allowed transition"
            aria-label="Previous page"
          >
            <ChevronLeft className="h-3 w-3" />
            Prev
          </button>
          <span className="text-[11px] font-mono text-ink-dim">
            Page {safePage} / {totalPages}
            <span className="ml-2 text-ink-dim/60">
              ({start + 1}–{Math.min(start + pageSize, items.length)} of {items.length})
            </span>
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={safePage >= totalPages}
            className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-semibold text-ink-secondary hover:border-metu-yellow/40 hover:text-metu-yellow disabled:opacity-30 disabled:cursor-not-allowed transition"
            aria-label="Next page"
          >
            Next
            <ChevronRight className="h-3 w-3" />
          </button>
        </div>
      )}
    </>
  );
}
