import type { ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/EmptyState";

/**
 * Phase 10 / Step 2 — minimal table abstraction for admin & seller lists.
 *
 * The admin pages (users, stores, transactions, etc.) all reach for the
 * same recipe: a sticky header on a `surface-flat` table, hover-tinted
 * rows, an actions cell on the right, optional pagination beneath. This
 * primitive owns that shape so each page only writes a `columns` array
 * and a `renderCell` function.
 *
 * Generic over the row type. We do NOT virtualise — the demo has at
 * most a few hundred rows per page, and a virtualised table here would
 * cost more in bundle size than it saves in render time.
 */
export type DataTableAlign = "left" | "right" | "center";

export type DataTableColumn<T> = {
  key: string;
  header: ReactNode;
  width?: string;
  align?: DataTableAlign;
};

export type DataTablePagination = {
  page: number;
  totalPages: number;
  /** Either build hrefs (server-friendly) or fire a callback (client). */
  onChange?: (next: number) => void;
  buildHref?: (next: number) => string;
};

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  getRowKey: (row: T) => string | number;
  renderCell: (row: T, column: DataTableColumn<T>) => ReactNode;
  /** Optional row-actions cell rendered as a sticky right column. */
  actions?: (row: T) => ReactNode;
  emptyState?: ReactNode;
  pagination?: DataTablePagination;
  className?: string;
  /** aria-label for the table itself — passed to the <table> element. */
  ariaLabel?: string;
}

const alignClass: Record<DataTableAlign, string> = {
  left:   "text-left",
  right:  "text-right",
  center: "text-center",
};

export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  renderCell,
  actions,
  emptyState,
  pagination,
  className,
  ariaLabel,
}: DataTableProps<T>) {
  if (rows.length === 0) {
    return (
      <div className={className}>
        {emptyState ?? (
          <EmptyState title="Nothing here yet" description="Records will appear here once they exist." />
        )}
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      <div className="surface-flat rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" aria-label={ariaLabel}>
            <thead>
              <tr className="sticky top-0 z-10 bg-space-900 text-ink-dim text-[11px] uppercase tracking-wider font-semibold">
                {columns.map((col) => (
                  <th
                    key={col.key}
                    style={col.width ? { width: col.width } : undefined}
                    className={cn(
                      "px-4 py-3 border-b border-white/8",
                      alignClass[col.align ?? "left"],
                    )}
                    scope="col"
                  >
                    {col.header}
                  </th>
                ))}
                {actions && (
                  <th
                    className="px-4 py-3 border-b border-white/8 text-right w-[1%]"
                    scope="col"
                  >
                    <span className="sr-only">Actions</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={getRowKey(row)}
                  className="border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors"
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn(
                        "px-4 py-3 text-ink-secondary",
                        alignClass[col.align ?? "left"],
                      )}
                    >
                      {renderCell(row, col)}
                    </td>
                  ))}
                  {actions && (
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {actions(row)}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {pagination && pagination.totalPages > 1 && (
        <DataTablePaginationFooter pagination={pagination} />
      )}
    </div>
  );
}

/**
 * Pagination footer mirroring the inline `Pagination` from
 * apps/web/app/browse/page.tsx (lines 286–318) so the visual rhythm of
 * paged surfaces stays consistent across browse + admin lists.
 *
 * Two modes:
 *  - `buildHref` for server-component pages (no JS roundtrip)
 *  - `onChange`  for client-driven tables
 */
function DataTablePaginationFooter({ pagination }: { pagination: DataTablePagination }) {
  const { page, totalPages, onChange, buildHref } = pagination;

  function PageButton({
    target,
    children,
  }: {
    target: number;
    children: ReactNode;
  }) {
    const className =
      "rounded-full border border-line px-4 py-2 text-sm text-white hover:border-metu-yellow/50 transition";
    if (buildHref) {
      return (
        <Link href={buildHref(target)} className={className}>
          {children}
        </Link>
      );
    }
    return (
      <button type="button" onClick={() => onChange?.(target)} className={className}>
        {children}
      </button>
    );
  }

  return (
    <div className="flex items-center justify-center gap-2">
      {page > 1 && <PageButton target={page - 1}>← Prev</PageButton>}
      <span className="px-4 text-sm text-ink-secondary">
        Page <span className="text-white font-semibold">{page}</span> of {totalPages}
      </span>
      {page < totalPages && <PageButton target={page + 1}>Next →</PageButton>}
    </div>
  );
}
