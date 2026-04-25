"use client";
import { useRouter } from "next/navigation";

type SortKey = "newest" | "rating" | "price_asc" | "price_desc";

const OPTIONS: Array<{ value: SortKey; label: string }> = [
  { value: "newest",     label: "Newest" },
  { value: "rating",     label: "Top rated" },
  { value: "price_asc",  label: "Price ↑" },
  { value: "price_desc", label: "Price ↓" },
];

/**
 * Phase 11 / F22 — Browse Sort dropdown that auto-submits on change.
 *
 * Old behaviour required the user to change the `<select>` AND then
 * click "Apply", which felt slow and inconsistent with the chip
 * filters (which are anchor links and navigate instantly). Per CEO
 * decision, Sort now auto-submits via `router.push()` while the Apply
 * button stays visible for users who prefer to commit changes
 * explicitly — a redundant safety net, not a required step.
 *
 * Other params (q, category, tags, etc.) are preserved by reading the
 * current URL search params and overwriting only `sort` + clearing
 * `page` (resorting always returns the user to page 1).
 */
export function SortSelect({ activeSort }: { activeSort: SortKey | string }) {
  const router = useRouter();

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value;
    const url = new URL(window.location.href);
    url.searchParams.set("sort", next);
    // Reset pagination — a new sort order shouldn't preserve the old
    // page index (page 5 of "Newest" is meaningless under "Top rated").
    url.searchParams.delete("page");
    router.push(`${url.pathname}?${url.searchParams.toString()}`);
  }

  return (
    <select
      name="sort"
      value={activeSort}
      onChange={onChange}
      className="rounded-full border border-line bg-space-800 px-4 py-2 text-sm text-white focus:border-brand-yellow outline-none cursor-pointer"
      aria-label="Sort products"
    >
      {OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}
