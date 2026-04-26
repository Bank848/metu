"use client";

import { useEffect, useState } from "react";
import { Filter, X } from "lucide-react";

/**
 * Phase 11 / F19 — Mobile bottom-sheet wrapper for the browse filter
 * panel.
 *
 * Background: at md+ the FilterPanel sits in a left aside (`hidden
 * md:block`) — sticky, always visible. On mobile the aside used to
 * render ABOVE the product grid, forcing buyers to scroll past four
 * filter cards before seeing a single product. F19 hides the aside
 * on mobile and surfaces filters via this client-only sheet
 * triggered by a "Filters" pill at the top of the section.
 *
 * The sheet:
 *   - Renders nothing visible on md+ (`md:hidden` on both the
 *     trigger button and the dialog).
 *   - Slides up from the bottom on `open`, takes 85vh max so a
 *     quick swipe down exposes the page underneath.
 *   - Locks body scroll while open.
 *   - Closes on backdrop click, Escape, or the X button.
 *   - Receives the FilterPanel as `children` so the existing server
 *     component renders unchanged inside the sheet — no markup
 *     duplication, no client-side data fetching.
 *
 * Active-filter count is computed by the server page (read off the
 * search params) so it stays accurate after every navigation.
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
          <div className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-3xl border-t border-line bg-space-900 p-5 pb-8 animate-sheet-rise">
            {/* Drag-handle affordance — purely visual, signals "swipe
                down to dismiss" pattern even though we don't wire a
                real gesture (taps still work). */}
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-line" />
            <div className="mb-4 flex items-center justify-between">
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
            {children}
          </div>
        </div>
      )}
    </>
  );
}
