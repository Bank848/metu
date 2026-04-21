import Image from "next/image";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { StoreActions } from "@/components/admin/StoreActions";
import { apiAuth } from "@/lib/session";
import { isDataUrl } from "@/lib/utils";

type Store = {
  storeId: number;
  name: string;
  description: string;
  coverImage: string | null;
  profileImage: string | null;
  createdAt: string;
  businessType: { name: string };
  owner: { username: string; firstName: string; lastName: string; profileImage: string | null };
  stats: { rating: number; ctr: number; responseTime: number } | null;
  _count: { products: number };
};

export const dynamic = "force-dynamic";

export default async function AdminStores() {
  const stores = (await apiAuth<Store[]>("/admin/stores")) ?? [];
  return (
    <>
      <PageHeader title="Stores" subtitle={`${stores.length} stores on the marketplace`} />

      <div className="grid md:grid-cols-2 gap-4">
        {stores.map((s) => (
          <div key={s.storeId} className="rounded-2xl border border-line bg-space-850 overflow-hidden">
            <div className="relative aspect-[5/2] bg-space-900">
              {s.coverImage && <Image src={s.coverImage} alt="" fill sizes="(max-width: 768px) 100vw, 50vw" className="object-cover" unoptimized={isDataUrl(s.coverImage)} />}
            </div>
            <div className="p-5">
              <div className="flex items-start gap-3">
                <div className="relative h-12 w-12 shrink-0 rounded-full bg-brand-yellow overflow-hidden ring-4 ring-space-900 -mt-10">
                  {s.profileImage && <Image src={s.profileImage} alt="" fill sizes="48px" className="object-cover" unoptimized={isDataUrl(s.profileImage)} />}
                </div>
                <div className="min-w-0">
                  <Badge variant="mist" className="mb-1">{s.businessType.name}</Badge>
                  <div className="font-display font-bold text-white truncate">{s.name}</div>
                  <div className="text-xs text-ink-dim">
                    Owned by {s.owner.firstName} {s.owner.lastName}
                  </div>
                </div>
              </div>
              <p className="mt-3 text-sm text-ink-secondary line-clamp-2">{s.description}</p>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <Kpi label="Products" value={s._count.products} />
                <Kpi label="Rating" value={s.stats ? (s.stats.rating / 10).toFixed(1) + "★" : "—"} />
                <Kpi label="CTR" value={s.stats ? (s.stats.ctr / 100).toFixed(1) + "%" : "—"} />
              </div>
              <div className="mt-4 pt-4 border-t border-line flex items-center justify-end">
                <StoreActions storeId={s.storeId} name={s.name} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function Kpi({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-space-900 border border-line p-2">
      <div className="text-xs text-ink-dim">{label}</div>
      <div className="font-display font-bold text-white">{value}</div>
    </div>
  );
}
