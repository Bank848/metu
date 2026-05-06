import Image from "next/image";
import Link from "next/link";
import { Package, Star, Banknote } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { StatCard } from "@/components/StatCard";
import { StoreActions } from "@/components/admin/StoreActions";
import { DataTable, type DataTableColumn } from "@/components/admin/DataTable";
import { EmptyState } from "@/components/EmptyState";
import { getAdminStores } from "@/lib/server/queries";
import { prisma } from "@/lib/server/prisma";
import { fmtDate, coins, thbToCoins, coinsCompact } from "@/lib/format";
import { isDataUrl } from "@/lib/utils";

type Store = Awaited<ReturnType<typeof getAdminStores>>["items"][number];

export const dynamic = "force-dynamic";

const columns: DataTableColumn<Store>[] = [
  { key: "store",    header: "Store" },
  { key: "owner",    header: "Owner" },
  { key: "type",     header: "Type" },
  { key: "products", header: "Products", align: "right" },
  { key: "rating",   header: "Rating",   align: "right" },
  { key: "revenue",  header: "Revenue",  align: "right" },
  { key: "created",  header: "Created",  align: "right" },
];

export default async function AdminStores({
  searchParams,
}: {
  searchParams: {
    q?: string;
    businessTypeId?: string;
    minRating?: string;
    minProducts?: string;
    page?: string;
  };
}) {
  const page = Math.max(1, Number(searchParams.page ?? 1));
  const [data, businessTypes] = await Promise.all([
    getAdminStores({
      q: searchParams.q,
      businessTypeId: searchParams.businessTypeId ? Number(searchParams.businessTypeId) : undefined,
      minRating: searchParams.minRating ? Number(searchParams.minRating) : undefined,
      minProducts: searchParams.minProducts ? Number(searchParams.minProducts) : undefined,
      page,
    }),
    prisma.businessType.findMany({ orderBy: { name: "asc" } }),
  ]);

  const stores = data.items;
  const totalProducts = stores.reduce((sum, s) => sum + s._count.products, 0);
  const ratedStores = stores.filter((s) => s._count.products > 0 && s.rating > 0);
  const avgRating =
    ratedStores.length === 0
      ? null
      : ratedStores.reduce((sum, s) => sum + s.rating, 0) / ratedStores.length / 10;
  const totalRevenue = stores.reduce((sum, s) => sum + s.revenue, 0);

  const buildHref = (overrides: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged = { ...searchParams, ...overrides };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    return `/admin/stores${p.toString() ? "?" + p.toString() : ""}`;
  };

  return (
    <>
      <PageHeader
        title="Stores"
        subtitle={`${data.total.toLocaleString()} stores · revenue this page ${coins(thbToCoins(totalRevenue))}`}
      />

      <form action="/admin/stores" method="get" className="mb-4 grid grid-cols-2 md:grid-cols-4 gap-2">
        <input
          name="q"
          defaultValue={searchParams.q ?? ""}
          placeholder="Search store or owner name…"
          className="md:col-span-2 rounded-full border border-line bg-space-800 px-4 py-2 text-sm text-white placeholder:text-ink-dim focus:border-metu-yellow outline-none"
        />
        <select
          name="businessTypeId"
          defaultValue={searchParams.businessTypeId ?? ""}
          className="rounded-full border border-line bg-space-800 px-3 py-2 text-sm text-white"
        >
          <option value="">All types</option>
          {businessTypes.map((bt) => (
            <option key={bt.typeId} value={bt.typeId}>{bt.name}</option>
          ))}
        </select>
        <select
          name="minRating"
          defaultValue={searchParams.minRating ?? ""}
          className="rounded-full border border-line bg-space-800 px-3 py-2 text-sm text-white"
        >
          <option value="">Any rating</option>
          <option value="40">4★ and up</option>
          <option value="45">4.5★ and up</option>
          <option value="48">4.8★ and up</option>
        </select>
        <select
          name="minProducts"
          defaultValue={searchParams.minProducts ?? ""}
          className="rounded-full border border-line bg-space-800 px-3 py-2 text-sm text-white"
        >
          <option value="">Any product count</option>
          <option value="1">≥ 1 product</option>
          <option value="5">≥ 5 products</option>
          <option value="10">≥ 10 products</option>
        </select>
        <button className="rounded-full bg-metu-yellow text-space-black px-4 py-2 text-sm font-bold col-span-2 md:col-span-1">
          Apply filters
        </button>
      </form>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <StatCard variant="highlight" icon={Package} label="Products listed" value={totalProducts} />
        <StatCard
          icon={Star}
          label="Avg. rating"
          value={avgRating === null ? "—" : `${avgRating.toFixed(1)}★`}
          variant={avgRating === null ? "zero" : "default"}
        />
        <StatCard
          icon={Banknote}
          label="Revenue (page)"
          value={coinsCompact(thbToCoins(totalRevenue))}
          valueTooltip={coins(thbToCoins(totalRevenue))}
        />
      </div>

      <DataTable<Store>
        ariaLabel="Stores"
        columns={columns}
        rows={stores}
        getRowKey={(s) => s.storeId}
        emptyState={
          <EmptyState
            variant="noResults"
            title="No stores match those filters"
            description="Try clearing filters or widening the rating threshold."
          />
        }
        renderCell={(s, col) => {
          switch (col.key) {
            case "store":
              return (
                <div className="flex items-center gap-3">
                  <div className="relative h-10 w-10 shrink-0 rounded-full bg-metu-yellow overflow-hidden">
                    {s.profileImage && (
                      <Image
                        src={s.profileImage}
                        alt=""
                        fill
                        sizes="40px"
                        className="object-cover"
                        unoptimized={isDataUrl(s.profileImage)}
                      />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      {/* Now points to the admin store detail page rather
                          than the public storefront. The detail page has
                          a "View public page" CTA so the public store is
                          one click away. */}
                      <Link href={`/admin/stores/${s.storeId}`} className="font-display font-bold text-sm text-white hover:text-metu-yellow truncate">
                        {s.name}
                      </Link>
                      {s.suspendedAt && (
                        <Badge variant="coral" className="uppercase text-[10px]">
                          Suspended
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-ink-dim line-clamp-1">{s.description}</div>
                  </div>
                </div>
              );
            case "owner":
              return (
                <div className="text-sm">
                  <div className="text-white">
                    {s.owner.firstName} {s.owner.lastName}
                  </div>
                  <div className="text-xs text-ink-dim">@{s.owner.username}</div>
                </div>
              );
            case "type":
              return <Badge variant="mist">{s.businessType.name}</Badge>;
            case "products":
              return (
                <span className="font-mono text-sm text-white">
                  {s._count.products.toLocaleString()}
                </span>
              );
            case "rating":
              return (
                <span className="font-mono text-sm text-ink-secondary">
                  {s.rating > 0 ? `${(s.rating / 10).toFixed(1)}★` : "—"}
                </span>
              );
            case "revenue":
              return (
                <span className="font-mono text-sm text-mint">
                  {s.revenue > 0 ? coins(thbToCoins(s.revenue)) : "—"}
                </span>
              );
            case "created":
              return (
                <span className="font-mono text-xs text-ink-dim">
                  {fmtDate(s.createdAt)}
                </span>
              );
            default:
              return null;
          }
        }}
        actions={(s) => (
          <StoreActions
            storeId={s.storeId}
            name={s.name}
            suspended={Boolean(s.suspendedAt)}
          />
        )}
      />

      {data.totalPages > 1 && (
        <nav className="flex items-center justify-between gap-2 text-sm mt-4">
          <span className="text-ink-dim">Page {data.page} of {data.totalPages}</span>
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
