"use client";
import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { CATEGORY_STYLE, type ErCategory } from "@/lib/admin/er-categories";

/**
 * small color-key overlay matching the Lucidchart palette.
 * Collapsible so it doesn't crowd the canvas during normal use.
 */
export function CategoryLegend() {
  const [open, setOpen] = useState(true);

  // Order categories by visual priority (matches reading order).
  const categories: ErCategory[] = [
    "identity",
    "store",
    "catalog",
    "tag",
    "cart",
    "order",
    "coupon",
    "payments",
    "system",
  ];

  return (
    <div className="absolute top-4 left-4 rounded-lg border border-slate-300 bg-white shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2 px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
      >
        <span>Legend</span>
        {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>
      {open && (
        <ul className="px-2 pb-2 space-y-0.5 text-[10px]">
          {categories.map((c) => {
            const s = CATEGORY_STYLE[c];
            return (
              <li key={c} className="flex items-center gap-2">
                <span
                  className="inline-block h-3 w-3 rounded-sm border border-slate-300"
                  style={{ backgroundColor: s.headerBg }}
                />
                <span className="text-slate-700">{s.label}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
