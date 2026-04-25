import Image from "next/image";
import { Package, Star, MousePointerClick } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { StatCard } from "@/components/StatCard";
import { StoreActions } from "@/components/admin/StoreActions";
import { DataTable, type DataTableColumn } from "@/components/admin/DataTable";
import { EmptyState } from "@/components/EmptyState";
import { apiAuth } from "@/lib/session";
import { isDataUrl } from "@/lib/utils";

type Store = {
  storeId: number;
  name: string;
  description: string;
  coverImage: string | null;
  profileImage: string | null;
  createdAt: string;
  // `deletedAt` lands on the row whenever an admin soft-deletes the
  // store (Phase 11 / F23). The admin table still LISTS deleted stores
  // — we just exclude them from the headline KPIs so a freshly
  // moderated junk store doesn't continue dragging the average down.
  deletedAt: string | null;
  businessType: { name: string };
  owner: { username: string; firstName: string; lastName: string; profileImage: string | null };
  stats: { rating: number; ctr: number; responseTime: number } | null;
  _count: { products: number };
};

export const dynamic = "force-dynamic";

const columns: DataTableColumn<Store>[] = [
  { key: "store",    header: "Store" },
  { key: "owner",    header: "Owner" },
  { key: "type",     header: "Type" },
  { key: "products", header: "Products", align: "right" },
  { key: "rating",   header: "Rating",   align: "right" },
  { key: "ctr",      header: "CTR",      align: "right" },
];

export default async function AdminStores() {
  const stores = (await apiAuth<Store[]>("/admin/stores")) ?? [];

  // Promoted KPIs — replaces the three Kpi tiles that lived inside each
  // card. The "Products" tile becomes the row's lead via the highlight
  // variant; rating-average and CTR-average are the supporting stats.
  //
  // Phase 11 / F23 — the headline averages used to include
  // soft-deleted junk stores AND zero-rated stores that simply haven't
  // sold anything yet, both of which dragged the row down to 2.1★ on
  // /admin/stores. The KPI now restricts the population to active
  // stores that actually have products listed; the table itself still
  // shows every row so a moderator can see what's been deleted /
  // empty.
  const liveStores = stores.filter((s) => !s.deletedAt);
  const totalProducts = liveStores.reduce((sum, s) => sum + s._count.products, 0);
  const ratedStores = liveStores.filter(
    (s) => s.stats && s._count.products > 0 && s.stats.rating > 0,
  );
  const avgRating =
    ratedStores.length === 0
      ? null
      : ratedStores.reduce((sum, s) => sum + (s.stats?.rating ?? 0), 0) / ratedStores.length / 10;
  const ctrPopulation = liveStores.filter((s) => s.stats && s._count.products > 0);
  const avgCtr =
    ctrPopulation.length === 0
      ? null
      : ctrPopulation.reduce((sum, s) => sum + (s.stats?.ctr ?? 0), 0) / ctrPopulation.length / 100;

  return (
    <>
      <PageHeader
        title="Stores"
        subtitle={`${stores.length} stores on the marketplace`}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <StatCard
          variant="highlight"
          icon={Package}
          label="Products listed"
          value={totalProducts}
        />
        <StatCard
          icon={Star}
          label="Avg. rating"
          value={avgRating === null ? "—" : `${avgRating.toFixed(1)}★`}
          variant={avgRating === null ? "zero" : "default"}
        />
        <StatCard
          icon={MousePointerClick}
          label="Avg. CTR"
          value={avgCtr === null ? "—" : `${avgCtr.toFixed(1)}%`}
          variant={avgCtr === null ? "zero" : "default"}
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
            title="No stores yet"
            description="Once sellers publish a store it will appear here."
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
                    <div className="font-display font-bold text-sm text-white truncate">
                      {s.name}
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
                  {s.stats ? `${(s.stats.rating / 10).toFixed(1)}★` : "—"}
                </span>
              );
            case "ctr":
              return (
                <span className="font-mono text-sm text-ink-secondary">
                  {s.stats ? `${(s.stats.ctr / 100).toFixed(1)}%` : "—"}
                </span>
              );
            default:
              return null;
          }
        }}
        actions={(s) => <StoreActions storeId={s.storeId} name={s.name} />}
      />
    </>
  );
}
