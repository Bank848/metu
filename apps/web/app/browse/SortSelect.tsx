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
 * Browse Sort dropdown that auto-submits via `router.push()`. Reads
 * the current URL params and overwrites only `sort` + clears `page`,
 * so resorting always returns the user to page 1.
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
