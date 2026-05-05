import { Ticket, Plus } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { GlassButton } from "@/components/visual/GlassButton";
import { EmptyState } from "@/components/EmptyState";
import { prisma } from "@/lib/server/prisma";
import { fmtDate, coins, thbToCoins } from "@/lib/format";

export const metadata = { title: "Coupons · Admin · METU" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

interface SearchParams {
  page?: string;
  scope?: "all" | "master" | "store";
  status?: "all" | "active" | "expired";
  sort?: "discount" | "newest" | "expiring";
}

interface Row {
  coupon_id: number;
  code: string;
  store_id: number | null;
  store_name: string | null;
  discount_type: string;
  discount_value: number;
  usage_limit: number;
  used_count: bigint;
  total_discount: string;
  start_date: Date;
  end_date: Date;
  is_active: boolean;
  created_at: Date;
}

export default async function AdminCouponsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const page = Math.max(1, Number(searchParams.page ?? 1));
  const scope = (searchParams.scope ?? "all") as NonNullable<SearchParams["scope"]>;
  const status = (searchParams.status ?? "all") as NonNullable<SearchParams["status"]>;
  const sort = (searchParams.sort ?? "discount") as NonNullable<SearchParams["sort"]>;

  // Single round trip: list + per-coupon stats (used_count, total_discount in
  // baht). uses correlated subquery per row — fine because LIMIT 20 caps the
  // outer fan-out.
  const orderBy = (() => {
    switch (sort) {
      case "newest":   return `c.start_date DESC`;
      case "expiring": return `c.end_date ASC`;
      case "discount":
      default:         return `total_discount::numeric DESC`;
    }
  })();
  const scopeWhere = scope === "master"
    ? `AND c.store_id IS NULL`
    : scope === "store"
    ? `AND c.store_id IS NOT NULL`
    : ``;
  const statusWhere = status === "active"
    ? `AND c.is_active = true AND c.end_date >= NOW() AND c.start_date <= NOW()`
    : status === "expired"
    ? `AND (c.is_active = false OR c.end_date < NOW())`
    : ``;

  const offset = (page - 1) * PAGE_SIZE;
  const rows = await prisma.$queryRawUnsafe<Row[]>(
    `SELECT
       c.coupon_id, c.code, c.store_id,
       s.name AS store_name,
       c.discount_type, c.discount_value, c.usage_limit,
       (SELECT COUNT(*)::int FROM coupon_usage cu WHERE cu.coupon_id = c.coupon_id) AS used_count,
       COALESCE((
         SELECT SUM(
           CASE WHEN c.discount_type = 'percent'
                THEN oi.price_per_unit * oi.quantity * c.discount_value / 100.0
                ELSE LEAST(c.discount_value, oi.price_per_unit * oi.quantity)
           END
         )
         FROM order_item oi
         JOIN orders o ON o.order_id = oi.order_id
         WHERE oi.coupon_id = c.coupon_id
           AND o.status IN ('paid', 'fulfilled')
       ), 0)::text AS total_discount,
       c.start_date, c.end_date, c.is_active, c.start_date AS created_at
     FROM coupon c
     LEFT JOIN store s ON s.store_id = c.store_id
     WHERE 1=1 ${scopeWhere} ${statusWhere}
     ORDER BY ${orderBy}
     LIMIT ${PAGE_SIZE} OFFSET ${offset}`,
  );
  const totalRow = await prisma.$queryRawUnsafe<Array<{ total: bigint }>>(
    `SELECT COUNT(*)::int AS total FROM coupon c WHERE 1=1 ${scopeWhere} ${statusWhere}`,
  );
  const total = Number(totalRow[0]?.total ?? 0);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const buildHref = (overrides: Partial<SearchParams>) => {
    const params = new URLSearchParams();
    const merged = { ...searchParams, ...overrides };
    for (const [k, v] of Object.entries(merged)) if (v) params.set(k, String(v));
    return `/admin/coupons?${params.toString()}`;
  };

  return (
    <main className="px-8 py-8 max-w-6xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <PageHeader
          title="Coupons"
          subtitle={`${total.toLocaleString()} coupons across the platform · ranked by total discount given`}
        />
        <GlassButton tone="gold" href="/admin/coupons/new">
          <Plus className="h-4 w-4" /> New master coupon
        </GlassButton>
      </div>

      {/* Filter bar */}
      <section className="rounded-2xl border border-line bg-space-900 p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-ink-dim">Scope</span>
          {(["all", "master", "store"] as const).map((s) => (
            <Link key={s} href={buildHref({ scope: s, page: undefined })}>
              <Badge variant={scope === s ? "yellow" : "mist"} className="capitalize">
                {s === "all" ? "All" : s === "master" ? "Master only" : "Store only"}
              </Badge>
            </Link>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-ink-dim">Status</span>
          {(["all", "active", "expired"] as const).map((s) => (
            <Link key={s} href={buildHref({ status: s, page: undefined })}>
              <Badge variant={status === s ? "yellow" : "mist"} className="capitalize">{s}</Badge>
            </Link>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-ink-dim">Sort</span>
          {([
            ["discount", "By discount given"],
            ["expiring", "Expiring soon"],
            ["newest", "Newest"],
          ] as const).map(([s, label]) => (
            <Link key={s} href={buildHref({ sort: s, page: undefined })}>
              <Badge variant={sort === s ? "yellow" : "mist"}>{label}</Badge>
            </Link>
          ))}
        </div>
      </section>

      {/* Table */}
      {rows.length === 0 ? (
        <EmptyState
          title="No coupons match these filters"
          description="Try clearing the filters or create the first master coupon."
          icon={<Ticket className="h-8 w-8" />}
        />
      ) : (
        <section className="rounded-2xl border border-line bg-space-900 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-space-950 text-xs uppercase tracking-wider text-ink-dim">
              <tr>
                <th className="text-left px-4 py-2 font-medium">Code</th>
                <th className="text-left px-4 py-2 font-medium">Store</th>
                <th className="text-left px-4 py-2 font-medium">Discount</th>
                <th className="text-right px-4 py-2 font-medium">Used / Limit</th>
                <th className="text-right px-4 py-2 font-medium">Total saved</th>
                <th className="text-right px-4 py-2 font-medium">Created</th>
                <th className="text-right px-4 py-2 font-medium">Expires</th>
                <th className="text-center px-4 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const expired = new Date(r.end_date) < new Date();
                return (
                  <tr key={r.coupon_id} className="border-t border-line hover:bg-white/[0.02]">
                    <td className="px-4 py-3 font-mono text-metu-yellow font-bold">{r.code}</td>
                    <td className="px-4 py-3 text-sm">
                      {r.store_id == null
                        ? <Badge variant="gold" className="text-[10px]">MASTER</Badge>
                        : <span className="text-ink-secondary">{r.store_name}</span>}
                    </td>
                    <td className="px-4 py-3 text-sm text-white">
                      {r.discount_type === "percent"
                        ? `${r.discount_value}%`
                        : coins(thbToCoins(r.discount_value))}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-ink-secondary">
                      {Number(r.used_count)} / {r.usage_limit}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-mono text-mint">
                      {coins(thbToCoins(Number(r.total_discount)))}
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-ink-dim">
                      {fmtDate(r.start_date)}
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-ink-dim">
                      {fmtDate(r.end_date)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {expired
                        ? <Badge variant="danger">Expired</Badge>
                        : r.is_active
                        ? <Badge variant="success">Active</Badge>
                        : <Badge variant="mist">Paused</Badge>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <nav className="flex items-center justify-between gap-2 text-sm">
          <span className="text-ink-dim">Page {page} of {totalPages}</span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link href={buildHref({ page: String(page - 1) })} className="rounded-full border border-line px-3 py-1 text-xs hover:border-metu-yellow">
                ← Previous
              </Link>
            )}
            {page < totalPages && (
              <Link href={buildHref({ page: String(page + 1) })} className="rounded-full border border-line px-3 py-1 text-xs hover:border-metu-yellow">
                Next →
              </Link>
            )}
          </div>
        </nav>
      )}
    </main>
  );
}
