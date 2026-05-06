"use client";
import Link from "next/link";
import { useSearchParams, usePathname } from "next/navigation";

const RANGES = [
  { days: 7,  label: "7d",  hint: "Last week" },
  { days: 14, label: "14d", hint: "Last fortnight" },
  { days: 30, label: "30d", hint: "Last month" },
  { days: 90, label: "90d", hint: "Last quarter" },
] as const;

// URL-state pill toggle for the date range on /admin's revenue chart.
// We persist the choice as `?range=7|14|30|90` so the server component
// can read it during SSR and pass it straight to `getStats(days)`.
// Keeps it stateless on the client — no useState — and copy-pasteable
// links share the same view.
export function RangeToggle({ activeDays }: { activeDays: number }) {
  const params = useSearchParams();
  const pathname = usePathname();

  function buildHref(days: number) {
    const next = new URLSearchParams(params.toString());
    next.set("range", String(days));
    return `${pathname}?${next.toString()}`;
  }

  return (
    <div className="inline-flex rounded-full border border-line bg-space-950 p-0.5 text-xs">
      {RANGES.map((r) => {
        const active = r.days === activeDays;
        return (
          <Link
            key={r.days}
            href={buildHref(r.days)}
            scroll={false}
            title={r.hint}
            className={
              "px-3 py-1 rounded-full font-mono font-semibold transition " +
              (active
                ? "bg-metu-yellow text-space-950"
                : "text-ink-secondary hover:text-white")
            }
          >
            {r.label}
          </Link>
        );
      })}
    </div>
  );
}
