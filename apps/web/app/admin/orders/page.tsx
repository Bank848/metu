import Link from "next/link";
import { ShoppingCart, CreditCard, Clock, XCircle, RotateCcw } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { StatCard } from "@/components/StatCard";
import { DataTable, type DataTableColumn } from "@/components/admin/DataTable";
import { EmptyState } from "@/components/EmptyState";
import { getAdminOrders } from "@/lib/server/queries";
import { prisma } from "@/lib/server/prisma";
import { fmtDate, coins, thbToCoins } from "@/lib/format";

type Order = Awaited<ReturnType<typeof getAdminOrders>>["items"][number];

export const dynamic = "force-dynamic";

const statusVariant: Record<Order["status"], "success" | "info" | "warning" | "danger" | "purple"> = {
  paid: "success",
  fulfilled: "info",
  pending: "warning",
  cancelled: "danger",
  refunded: "purple",
};

const columns: DataTableColumn<Order>[] = [
  { key: "orderId", header: "Order" },
  { key: "buyer",   header: "Buyer" },
  { key: "stores",  header: "Stores" },
  { key: "total",   header: "Total",   align: "right" },
  { key: "status",  header: "Status" },
  { key: "created", header: "Created", align: "right" },
];

export default async function AdminOrders({
  searchParams,
}: {
  searchParams: {
    q?: string;
    status?: "pending" | "paid" | "fulfilled" | "cancelled" | "refunded";
    storeId?: string;
    page?: string;
  };
}) {
  const page = Math.max(1, Number(searchParams.page ?? 1));
  const [data, stores, statusCounts] = await Promise.all([
    getAdminOrders({
      q: searchParams.q,
      status: searchParams.status,
      storeId: searchParams.storeId ? Number(searchParams.storeId) : undefined,
      page,
    }),
    prisma.store.findMany({ orderBy: { name: "asc" }, select: { storeId: true, name: true } }),
    prisma.order.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);

  const orders = data.items;
  const countByStatus = new Map(statusCounts.map((s) => [s.status, s._count._all]));
  const buildHref = (overrides: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged = { ...searchParams, ...overrides };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    return `/admin/orders${p.toString() ? "?" + p.toString() : ""}`;
  };

  return (
    <>
      <PageHeader
        title="Orders"
        subtitle={`${data.total.toLocaleString()} total · viewing page ${data.page}/${data.totalPages}`}
      />

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 mb-4">
        <StatCard variant="highlight" icon={ShoppingCart} label="Pending" value={countByStatus.get("pending") ?? 0} />
        <StatCard icon={CreditCard} label="Paid" value={countByStatus.get("paid") ?? 0} />
        <StatCard icon={Clock} label="Fulfilled" value={countByStatus.get("fulfilled") ?? 0} />
        <StatCard icon={XCircle} label="Cancelled" value={countByStatus.get("cancelled") ?? 0} />
        <StatCard icon={RotateCcw} label="Refunded" value={countByStatus.get("refunded") ?? 0} />
      </div>

      <form action="/admin/orders" method="get" className="mb-6 grid grid-cols-2 md:grid-cols-4 gap-2">
        <input
          name="q"
          defaultValue={searchParams.q ?? ""}
          placeholder="Order ID, buyer email, name…"
          className="col-span-2 md:col-span-2 rounded-full border border-line bg-space-800 px-4 py-2 text-sm text-white placeholder:text-ink-dim focus:border-metu-yellow outline-none"
        />
        <select
          name="status"
          defaultValue={searchParams.status ?? ""}
          className="col-span-1 md:col-span-1 rounded-full border border-line bg-space-800 px-3 py-2 text-sm text-white"
        >
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="paid">Paid</option>
          <option value="fulfilled">Fulfilled</option>
          <option value="cancelled">Cancelled</option>
          <option value="refunded">Refunded</option>
        </select>
        <select
          name="storeId"
          defaultValue={searchParams.storeId ?? ""}
          className="col-span-1 md:col-span-1 rounded-full border border-line bg-space-800 px-3 py-2 text-sm text-white"
        >
          <option value="">All stores</option>
          {stores.map((s) => (
            <option key={s.storeId} value={s.storeId}>{s.name}</option>
          ))}
        </select>
        <button className="rounded-full bg-space-800 ring-1 ring-line text-white hover:ring-metu-yellow/40 transition px-4 py-2 text-sm font-semibold col-span-2 md:col-span-1">
          Apply filters
        </button>
      </form>

      <DataTable<Order>
        ariaLabel="Orders"
        columns={columns}
        rows={orders}
        getRowKey={(o) => o.orderId}
        emptyState={
          <EmptyState
            variant="noResults"
            title="No orders match those filters"
            description="Try clearing filters or widening the date range."
          />
        }
        renderCell={(o, col) => {
          switch (col.key) {
            case "orderId":
              return (
                <Link href={`/orders/${o.orderId}`} className="font-mono text-sm text-white hover:text-metu-yellow">
                  #{o.orderId}
                </Link>
              );
            case "buyer":
              return (
                <div className="text-sm">
                  <div className="text-white truncate max-w-[200px]">
                    {o.user.firstName} {o.user.lastName}
                  </div>
                  <div className="text-xs text-ink-dim truncate max-w-[200px]">{o.user.email}</div>
                </div>
              );
            case "stores": {
              // productItem can be null when the variant was hard-deleted
              // after the order shipped; defend the join chain so the
              // admin row still renders even if the variant is gone.
              const uniq = Array.from(
                new Map(
                  o.items.flatMap((it) => {
                    const store = it.productItem?.product?.store;
                    return store ? [[store.storeId, store] as const] : [];
                  })
                ).values(),
              );
              return (
                <div className="flex flex-wrap gap-1.5">
                  {uniq.slice(0, 3).map((s) => (
                    <Badge key={s.storeId} variant="mist" className="text-[10px]">
                      {s.name}
                    </Badge>
                  ))}
                  {uniq.length > 3 && (
                    <span className="text-xs text-ink-dim">+{uniq.length - 3}</span>
                  )}
                </div>
              );
            }
            case "total":
              return (
                <span className="font-mono text-sm text-mint">
                  {coins(thbToCoins(Number(o.totalPrice)))}
                </span>
              );
            case "status":
              return (
                <Badge variant={statusVariant[o.status]} className="uppercase text-[10px]">
                  {o.status}
                </Badge>
              );
            case "created":
              return (
                <span className="font-mono text-xs text-ink-dim">{fmtDate(o.createdAt)}</span>
              );
            default:
              return null;
          }
        }}
      />

      {data.totalPages > 1 && (
        <nav className="flex items-center justify-between gap-2 text-sm mt-4">
          <span className="text-ink-dim">
            Page {data.page} of {data.totalPages}
          </span>
          <div className="flex gap-2">
            {data.page > 1 && (
              <Link href={buildHref({ page: String(data.page - 1) })} className="rounded-full border border-line px-3 py-1 text-xs hover:border-metu-yellow">
                ← Previous
              </Link>
            )}
            {data.page < data.totalPages && (
              <Link href={buildHref({ page: String(data.page + 1) })} className="rounded-full border border-line px-3 py-1 text-xs hover:border-metu-yellow">
                Next →
              </Link>
            )}
          </div>
        </nav>
      )}
    </>
  );
}
