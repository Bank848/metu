import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Star, Clock, BadgeCheck, MapPin, Calendar, Package as PackageIcon, MessageSquare, Activity, Mail } from "lucide-react";
import { TopNav } from "@/components/TopNav";
import { Footer } from "@/components/Footer";
import { Badge } from "@/components/ui/Badge";
import { ProductCard } from "@/components/ProductCard";
import { StatCard } from "@/components/StatCard";
import { EmptyState } from "@/components/EmptyState";
import { GlassButton } from "@/components/visual/GlassButton";
import { StarField } from "@/components/DotGrid";
import { getStore, getFavoriteSet } from "@/lib/server/queries";
import { getMe } from "@/lib/session";
import { getServerT } from "@/lib/i18n/server";
import { isDataUrl } from "@/lib/utils";
import { ShareButton } from "@/components/ShareButton";

export const dynamic = "force-dynamic";

export default async function StorePage({ params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isFinite(id)) return notFound();
  const me = await getMe();
  const [data, favSet] = await Promise.all([getStore(id), getFavoriteSet(me?.user.userId)]);
  if (!data) return notFound();
  const { store, products, productCount, reviewCount, avgRating } = data;
  const t = getServerT();
  // Owner can't message themselves — `POST /api/messages` rejects self-send
  // anyway, but hiding the CTA keeps the storefront from showing a button
  // the seller would never want to click.
  const showMessageCta = !me || me.user.userId !== store.ownerId;
  const messageHref = me
    ? `/messages/${store.ownerId}`
    : `/login?next=/messages/${store.ownerId}`;

  return (
    <>
      <TopNav />
      <main>
        {/* Cover banner — Wave-3: surface-hero replaces hand-rolled vibrant
            mesh fallback so the storefront banner picks up the editorial
            radial-gradient treatment from globals.css §5. */}
        <section className="relative h-[280px] md:h-[360px] overflow-hidden surface-hero">
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
          ) : null}
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
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <h1 className="font-display text-3xl md:text-5xl font-extrabold tracking-tight text-white">
                    {store.name}
                  </h1>
                  {/* Wave-3: short coral underline anchors the store name
                      with the warm secondary accent. Stays under the
                      heading rather than running full-width — this is a
                      mark, not a divider. */}
                  <span aria-hidden className="mt-2 block h-[3px] w-16 rounded-full bg-coral" />
                </div>
                {/* Action row — Message store sits left of Share so it
                    reads as the primary social action ("talk to them")
                    while Share remains the lighter utility. Coral tone
                    deliberately distinct from the gold "Visit store"
                    buy paths so it never feels like a checkout CTA. */}
                {showMessageCta && (
                  <GlassButton
                    tone="coral"
                    size="sm"
                    href={messageHref}
                    className="shrink-0"
                  >
                    <Mail className="h-4 w-4" />
                    {t("messages.cta.messageStore")}
                  </GlassButton>
                )}
                <ShareButton title={store.name} text={`${store.name} on METU`} size="md" />
              </div>
              <p className="mt-3 text-ink-secondary max-w-2xl">{store.description}</p>
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

          {/* Stat cards — Wave-3: lead stat uses `highlight` so the row
              stops reading as four identical glass tiles (playbook §1
              row 8). Remaining stats use the shared `StatCard` so they
              inherit the new flat treatment. */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-10">
            <StatCard
              variant="highlight"
              icon={PackageIcon}
              label="Products"
              value={productCount}
            />
            <StatCard
              icon={Star}
              label="Average rating"
              value={avgRating ? `${avgRating.toFixed(1)}★` : "—"}
            />
            <StatCard
              icon={MessageSquare}
              label="Reviews"
              value={reviewCount}
            />
            <StatCard
              icon={Activity}
              label="Engagement"
              value={store.stats ? `${(store.stats.ctr / 100).toFixed(1)}%` : "—"}
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
              // Wave-3 asymmetry — first card is the `feature` variant
              // (mint surface + bigger image). Same pattern as the
              // related-products row on the product detail page.
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
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
