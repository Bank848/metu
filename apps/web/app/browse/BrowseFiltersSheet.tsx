"use client";

import { useEffect, useState } from "react";
import { Filter, X } from "lucide-react";

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
