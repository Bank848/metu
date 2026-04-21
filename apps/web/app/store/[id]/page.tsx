import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Star, Clock, BadgeCheck, MapPin, Calendar, Package as PackageIcon } from "lucide-react";
import { TopNav } from "@/components/TopNav";
import { Footer } from "@/components/Footer";
import { Badge } from "@/components/ui/Badge";
import { ProductCard } from "@/components/ProductCard";
import { EmptyState } from "@/components/EmptyState";
import { GlassButton } from "@/components/visual/GlassButton";
import { StarField } from "@/components/DotGrid";
import { getStore, getFavoriteSet } from "@/lib/server/queries";
import { getMe } from "@/lib/session";
import { isDataUrl } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function StorePage({ params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isFinite(id)) return notFound();
  const me = await getMe();
  const [data, favSet] = await Promise.all([getStore(id), getFavoriteSet(me?.user.userId)]);
  if (!data) return notFound();
  const { store, products, productCount, reviewCount, avgRating } = data;

  return (
    <>
      <TopNav />
      <main>
        {/* Cover banner */}
        <section className="relative h-[280px] md:h-[360px] overflow-hidden">
          <StarField density="md" />
          {store.coverImage ? (
            <Image
              src={store.coverImage}
              alt=""
              fill
              priority
              sizes="100vw"
              className="object-cover"
              unoptimized={isDataUrl(store.coverImage)}
            />
          ) : (
            <div className="absolute inset-0 vibrant-mesh" />
          )}
          {/* dark overlay for legibility */}
          <div className="absolute inset-0 bg-gradient-to-t from-surface-1 via-surface-1/30 to-transparent" />
          {/* gold hairline */}
          <div className="absolute bottom-0 inset-x-0 h-[3px] bg-gradient-to-r from-transparent via-metu-yellow to-transparent" />
        </section>

        <div className="mx-auto max-w-[1280px] px-6 md:px-10 -mt-20 relative">
          {/* Profile header */}
          <header className="flex flex-col md:flex-row md:items-end gap-6 mb-10">
            <div className="relative h-32 w-32 shrink-0 rounded-2xl bg-metu-yellow overflow-hidden ring-4 ring-surface-1 shadow-pop">
              {store.profileImage && (
                <Image src={store.profileImage} alt={store.name} fill sizes="128px" className="object-cover" unoptimized={isDataUrl(store.profileImage)} />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <Badge variant="yellow" className="mb-2 inline-flex items-center gap-1">
                <BadgeCheck className="h-3 w-3" />
                {store.businessType?.name ?? "Verified store"}
              </Badge>
              <h1 className="font-display text-3xl md:text-5xl font-extrabold tracking-tight text-white">
                {store.name}
              </h1>
              <p className="mt-2 text-ink-secondary max-w-2xl">{store.description}</p>
              <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-ink-dim">
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> {store.businessType?.name ?? "Marketplace"}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> Member since{" "}
                  {new Date(store.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "short" })}
                </span>
                {store.stats && (
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3 w-3" /> ~{Math.round(store.stats.responseTime / 60)}h response
                  </span>
                )}
              </div>
            </div>
          </header>

          {/* Stat cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-10">
            <Stat label="Products" value={productCount} icon={<PackageIcon className="h-4 w-4 text-metu-yellow" />} />
            <Stat
              label="Average rating"
              value={avgRating ? `${avgRating.toFixed(1)}★` : "—"}
              icon={<Star className="h-4 w-4 text-metu-yellow fill-metu-yellow" />}
            />
            <Stat label="Reviews" value={reviewCount} />
            <Stat
              label="Engagement"
              value={store.stats ? `${(store.stats.ctr / 100).toFixed(1)}%` : "—"}
              hint="CTR"
            />
          </div>

          {/* Products grid */}
          <section className="mb-16">
            <div className="flex items-end justify-between mb-6 border-b border-white/8 pb-3">
              <h2 className="font-display text-2xl font-bold text-white">
                Products{" "}
                <span className="text-ink-dim text-base font-normal">({productCount})</span>
              </h2>
              <Link href={`/browse?q=${encodeURIComponent(store.name)}`} className="text-sm font-semibold text-metu-yellow hover:underline">
                Search by store →
              </Link>
            </div>
            {products.length === 0 ? (
              <EmptyState
                title="No products yet"
                description="This store hasn't listed any products."
                icon={<PackageIcon className="h-8 w-8" />}
                action={<GlassButton tone="gold" href="/browse">Browse marketplace →</GlassButton>}
              />
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
                {products.map((p) => (
                  <ProductCard key={p.productId} product={p} isFavorited={favSet.has(p.productId)} />
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}

function Stat({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl glass-morphism p-5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-dim">
          {label}
        </span>
        {icon}
      </div>
      <div className="mt-1 font-display text-3xl font-extrabold text-white">
        {typeof value === "number" ? value.toLocaleString() : value}
      </div>
      {hint && <div className="text-xs text-ink-dim mt-1">{hint}</div>}
    </div>
  );
}
