"use client";

import { useEffect, useState } from "react";
import { Filter, X } from "lucide-react";

/**
 * Mobile bottom-sheet wrapper for the browse filter panel. Hidden on
 * md+ (the desktop aside takes over). Receives the FilterPanel as
 * `children` so the server-rendered content is reused unchanged.
 */
export function BrowseFiltersSheet({
  activeCount,
  children,
}: {
  activeCount: number;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    // Lock background scroll so the sheet feels modal. Restore on
    // close — also covers the case where the route changes (e.g. user
    // taps a filter), since the server page re-renders with `open`
    // back to false.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="md:hidden flex items-center gap-2 rounded-full border border-line bg-space-800 px-4 py-2 text-sm font-semibold text-white hover:border-mint/40 transition"
        aria-label={
          activeCount > 0
            ? `Open filters (${activeCount} active)`
            : "Open filters"
        }
      >
        <Filter className="h-4 w-4 text-mint" />
        Filters
        {activeCount > 0 && (
          <span className="ml-0.5 inline-flex items-center justify-center min-w-[1.25rem] h-5 rounded-full bg-mint/20 text-mint text-xs font-bold px-1.5">
            {activeCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 md:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Filters"
        >
          <button
            type="button"
            aria-label="Close filters"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm cursor-default"
          />
          <div className="absolute inset-x-0 bottom-0 max-h-[85vh] flex flex-col rounded-t-3xl border-t border-line bg-space-900 animate-sheet-rise">
            {/* Sticky header — keeps the close button + active-filter
                count visible while the buyer scrolls deep into the
                filter list. Drag-handle bar above doubles as the
                "swipe down to dismiss" affordance even though we
                don't wire a real gesture (taps still work). */}
            <div className="sticky top-0 z-10 bg-space-900 px-5 pt-3 pb-3 border-b border-white/6 rounded-t-3xl">
              <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-line" />
              <div className="flex items-center justify-between">
                <h2 className="font-display font-bold text-white text-lg">
                  Filters
                  {activeCount > 0 && (
                    <span className="ml-2 text-sm font-medium text-mint">
                      {activeCount} active
                    </span>
                  )}
                </h2>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close filters"
                  className="rounded-full p-2 text-ink-secondary hover:bg-white/5 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-5 pt-4 pb-8">
              {children}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
