import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Star,
  BadgeCheck,
  Calendar,
  Package as PackageIcon,
  MessageSquare,
} from "lucide-react";
import { TopNav } from "@/components/TopNav";
import { Footer } from "@/components/Footer";
import { ProductCard } from "@/components/ProductCard";
import { EmptyState } from "@/components/EmptyState";
import { GlassButton } from "@/components/visual/GlassButton";
import { StarField } from "@/components/DotGrid";
import { ShareButton } from "@/components/ShareButton";
import { getStore, getFavoriteSet } from "@/lib/server/queries";
import { getMe } from "@/lib/session";
import { getServerT } from "@/lib/i18n/server";
import { isDataUrl } from "@/lib/utils";
import { fmtMonthYear } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function StorePage({ params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isFinite(id)) return notFound();

  const me = await getMe();
  const [data, favSet] = await Promise.all([
    getStore(id),
    getFavoriteSet(me?.user.userId),
  ]);
  if (!data) return notFound();

  const { store, products, productCount, reviewCount, avgRating } = data;
  const t = getServerT();

  return (
    <>
      <TopNav />
      <main className="min-h-screen bg-surface-1">

        {/* ── Hero cover ─────────────────────────────────────────────────── */}
        <section className="relative h-[240px] md:h-[320px] overflow-hidden">
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
            <div className="absolute inset-0 surface-hero" />
          )}
          {/* bottom fade into page background */}
          <div className="absolute inset-0 bg-gradient-to-t from-surface-1 via-surface-1/20 to-transparent" />
          {/* gold accent line */}
          <div className="absolute bottom-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-metu-yellow/60 to-transparent" />
        </section>

        {/* ── Page body ──────────────────────────────────────────────────── */}
        <div className="mx-auto max-w-[1280px] px-6 md:px-10">

          {/* ── Store header ─────────────────────────────────────────────── */}
          <header className="-mt-16 mb-10">
            <div className="flex flex-col md:flex-row md:items-end gap-5">

              {/* Avatar */}
              <div className="relative h-28 w-28 shrink-0 rounded-2xl overflow-hidden
                              ring-2 ring-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.5)]
                              bg-zinc-900">
                {store.profileImage && (
                  <Image
                    src={store.profileImage}
                    alt={store.name}
                    fill
                    sizes="112px"
                    className="object-cover"
                    unoptimized={isDataUrl(store.profileImage)}
                  />
                )}
              </div>

              {/* Identity + actions */}
              <div className="flex-1 min-w-0 md:pb-1">
                {/* Type badge */}
                {store.businessType?.name && (
                  <div className="inline-flex items-center gap-1.5 mb-2
                                  text-[11px] font-semibold uppercase tracking-widest
                                  text-metu-yellow/80">
                    <BadgeCheck className="h-3 w-3" />
                    {store.businessType.name}
                  </div>
                )}

                {/* Title + share */}
                <div className="flex items-start justify-between gap-4">
                  <h1 className="font-display text-2xl md:text-4xl font-extrabold
                                 tracking-tight text-white leading-tight truncate">
                    {store.name}
                  </h1>
                  <ShareButton
                    title={store.name}
                    text={`${store.name} on METU`}
                    size="md"
                  />
                </div>

                {/* Description */}
                <p className="mt-2 text-sm md:text-base text-ink-secondary leading-relaxed
                               max-w-2xl line-clamp-2">
                  {store.description}
                </p>

                {/* Meta row */}
                <div className="mt-3 flex items-center gap-1.5 text-xs text-ink-dim">
                  <Calendar className="h-3 w-3 shrink-0" />
                  <span>Member since {fmtMonthYear(store.createdAt)}</span>
                </div>
              </div>
            </div>

            {/* ── Stats strip ──────────────────────────────────────────────── */}
            <div className="mt-6 flex items-stretch gap-px rounded-xl overflow-hidden
                            border border-white/6 bg-white/4">
              <StatStrip
                icon={<PackageIcon className="h-4 w-4" />}
                label="Products"
                value={productCount}
              />
              <StatStrip
                icon={<Star className="h-4 w-4" />}
                label="Avg rating"
                value={avgRating ? `${avgRating.toFixed(1)}` : "—"}
                accent={!!avgRating}
              />
              <StatStrip
                icon={<MessageSquare className="h-4 w-4" />}
                label="Reviews"
                value={reviewCount}
              />
            </div>
          </header>

          {/* ── Products ─────────────────────────────────────────────────── */}
          <section className="mb-20">
            <div className="flex items-center justify-between mb-6
                            border-b border-white/6 pb-4">
              <div className="flex items-baseline gap-2">
                <h2 className="font-display text-xl font-bold text-white">
                  Products
                </h2>
                <span className="text-sm text-ink-dim font-normal">
                  {productCount}
                </span>
              </div>
              <Link
                href={`/browse?q=${encodeURIComponent(store.name)}`}
                className="text-xs font-semibold text-metu-yellow hover:text-metu-yellow/70
                           transition-colors"
              >
                Search by store →
              </Link>
            </div>

            {products.length === 0 ? (
              <EmptyState
                title="No products yet"
                description="This store hasn't listed any products."
                icon={<PackageIcon className="h-8 w-8" />}
                action={
                  <GlassButton tone="gold" href="/browse">
                    Browse marketplace →
                  </GlassButton>
                }
              />
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5">
                {products.map((p, i) => (
                  <ProductCard
                    key={p.productId}
                    product={p}
                    isFavorited={favSet.has(p.productId)}
                    variant={i === 0 ? "feature" : "default"}
                  />
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

// ─── StatStrip — inline pill stat ────────────────────────────────────────────
function StatStrip({
  icon,
  label,
  value,
  accent = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  accent?: boolean;
}) {
  return (
    <div className="flex-1 flex items-center gap-3 px-5 py-3.5 bg-white/[0.03]
                    hover:bg-white/[0.06] transition-colors">
      <span className={accent ? "text-metu-yellow" : "text-ink-dim"}>
        {icon}
      </span>
      <div className="min-w-0">
        <p className={`text-base font-bold leading-none ${accent ? "text-metu-yellow" : "text-white"}`}>
          {value}
        </p>
        <p className="text-[11px] text-ink-dim mt-0.5 leading-none">{label}</p>
      </div>
    </div>
  );
}