import { Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { Sparkles, ShieldCheck, Zap, Ticket, Clock } from "lucide-react";
import { TopNav } from "@/components/TopNav";
import { Footer } from "@/components/Footer";
import { Badge } from "@/components/ui/Badge";
import { getStats, getFeaturedProducts, getFeaturedStores, getFeaturedCoupons, getCategories, getFavoriteSet } from "@/lib/server/queries";
import { coins, thbToCoins, fmtDate } from "@/lib/format";
import { getMe } from "@/lib/session";
import { isDataUrl, cn } from "@/lib/utils";
import Hero from "@/components/HeroSection.";
import TrendingProducts from "@/components/TrendingSection";

type Store = Awaited<ReturnType<typeof getFeaturedStores>>[number];
type Coupon = Awaited<ReturnType<typeof getFeaturedCoupons>>[number];
type Category = Awaited<ReturnType<typeof getCategories>>[number];

export const dynamic = "force-dynamic";

// The home page is intentionally synchronous at the top level so the
// HTML shell + skeletons flush to the browser immediately. Each
// section below is an async server component wrapped in Suspense —
// Next streams them in as their data resolves, in roughly the order
// listed: hero (cached counters) first, trending grid next, then the
// heavier coupon/store/category blocks. The user sees real content
// arrive in chunks instead of staring at a blank page until the
// slowest fetch resolves.
export default function Home() {
  return (
    <>
      <TopNav />
      <main>
        <Suspense fallback={<HeroSkeleton />}>
          <HeroSection />
        </Suspense>
        <Suspense fallback={<TrendingSkeleton />}>
          <TrendingSection />
        </Suspense>
        <Suspense fallback={<CouponsSkeleton />}>
          <FeaturedCouponsSection />
        </Suspense>
        <Suspense fallback={<StoresSkeleton />}>
          <FeaturedStoresSection />
        </Suspense>
        <Suspense fallback={<CategoriesSkeleton />}>
          <CategoryTilesSection />
        </Suspense>
        <WhyMetu />
      </main>
      <Footer />
    </>
  );
}

// ─── Sections ──────────────────────────────────────────────────────────────

async function HeroSection() {
  const stats = await getStats();
  return <Hero stats={stats} />;
}

async function TrendingSection() {
  // getMe is React-cached per-request, so calling it here doesn't add a
  // second auth round-trip even if TopNav already called it.
  const me = await getMe();
  const [products, favSet] = await Promise.all([
    getFeaturedProducts(8),
    getFavoriteSet(me?.user.userId),
  ]);
  return <TrendingProducts products={products} favSet={favSet} />;
}

async function FeaturedCouponsSection() {
  const coupons = await getFeaturedCoupons(6);
  return <FeaturedCoupons coupons={coupons} />;
}

async function FeaturedStoresSection() {
  const stores = await getFeaturedStores(4);
  return <FeaturedStores stores={stores} />;
}

async function CategoryTilesSection() {
  const categories = await getCategories();
  return <CategoryTiles categories={categories} />;
}

// ─── Skeletons ─────────────────────────────────────────────────────────────

function SkeletonBox({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-2xl bg-white/5 border border-white/8 animate-pulse",
        className,
      )}
    />
  );
}

function HeroSkeleton() {
  return (
    <section className="px-5 sm:px-6 md:px-10 py-12 sm:py-16 max-w-[1400px] mx-auto">
      <div className="space-y-4">
        <SkeletonBox className="h-10 sm:h-14 w-3/4 max-w-[640px]" />
        <SkeletonBox className="h-5 w-1/2 max-w-[420px]" />
      </div>
      <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonBox key={i} className="h-24" />
        ))}
      </div>
    </section>
  );
}

function TrendingSkeleton() {
  return (
    <section className="px-5 sm:px-6 md:px-10 py-10 sm:py-12 max-w-[1400px] mx-auto">
      <SkeletonBox className="h-7 w-56 mb-6" />
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="space-y-3">
            <SkeletonBox className="aspect-[4/3]" />
            <SkeletonBox className="h-4 w-5/6" />
            <SkeletonBox className="h-3 w-2/3" />
          </div>
        ))}
      </div>
    </section>
  );
}

function CouponsSkeleton() {
  return (
    <section className="px-5 sm:px-6 md:px-10 py-10 sm:py-12 max-w-[1400px] mx-auto">
      <SkeletonBox className="h-7 w-48 mb-6" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonBox key={i} className="h-44" />
        ))}
      </div>
    </section>
  );
}

function StoresSkeleton() {
  return (
    <section className="bg-surface-2/60 py-10 sm:py-16 border-y border-white/6">
      <div className="mx-auto max-w-[1440px] px-5 sm:px-6 md:px-10">
        <SkeletonBox className="h-8 w-64 mb-6" />
        <div className="grid gap-5 lg:grid-cols-3">
          <SkeletonBox className="lg:row-span-2 aspect-[16/10] lg:aspect-auto lg:h-[420px]" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 lg:col-span-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <SkeletonBox key={i} className="h-28 sm:h-32" />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function CategoriesSkeleton() {
  return (
    <section className="mx-auto max-w-[1440px] px-5 sm:px-6 md:px-10 py-10 sm:py-16">
      <SkeletonBox className="h-8 w-56 mb-6" />
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <SkeletonBox key={i} className="h-24" />
        ))}
      </div>
    </section>
  );
}

// ─── Section components (presentational) ───────────────────────────────────

function FeaturedCoupons({ coupons }: { coupons: Coupon[] }) {
  if (coupons.length === 0) return null;
  return (
    <section className="px-5 sm:px-6 md:px-10 py-10 sm:py-12 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between mb-5 sm:mb-6 gap-3 flex-wrap">
        <div>
          <h2 className="font-display text-xl sm:text-2xl md:text-3xl font-extrabold text-white flex items-center gap-2">
            <Ticket className="h-5 w-5 sm:h-6 sm:w-6 text-metu-yellow" />
            Featured coupons
          </h2>
          <p className="text-sm text-ink-secondary mt-1">
            Almost-out-of-stock or expiring soon — grab them before they&apos;re gone.
          </p>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {coupons.map((c, i) => {
          const remaining = c.usageLimit - c.usedCount;
          return (
            <div
              key={c.couponId}
              className={cn(
                "rounded-2xl border p-5 bg-space-900 transition hover:scale-[1.02]",
                "animate-[stagger-rise_0.55s_cubic-bezier(0.22,1,0.36,1)_both]",
                c.isMaster
                  ? "border-metu-yellow/60 ring-2 ring-metu-yellow/30"
                  : "border-line",
              )}
              style={{ animationDelay: `${i * 70}ms` }}
            >
              <div className="flex items-start justify-between gap-2 mb-3">
                <Badge variant={c.isMaster ? "gold" : "mist"} className="uppercase text-[10px]">
                  {c.isMaster ? "Master coupon" : c.storeName ?? "Store"}
                </Badge>
                <span className="text-xs text-ink-dim flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {fmtDate(c.endDate)}
                </span>
              </div>
              <div className="font-display text-2xl font-extrabold text-gold-gradient mb-1">
                {c.discountType === "percent"
                  ? `${c.discountValue}% off`
                  : `${coins(thbToCoins(c.discountValue))} off`}
              </div>
              <code className="block font-mono text-sm text-metu-yellow bg-metu-yellow/10 border border-metu-yellow/30 rounded-lg px-3 py-1.5 mb-3 select-all">
                {c.code}
              </code>
              <div className="text-xs text-ink-dim">
                {remaining > 0
                  ? `${remaining} of ${c.usageLimit} left`
                  : "Sold out"}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function FeaturedStores({ stores }: { stores: Store[] }) {
  if (!stores.length) return null;
  // Lead store gets the larger accent card; others are flat side cards.
  const [lead, ...others] = stores;
  return (
    <section className="bg-surface-2/60 py-10 sm:py-16 border-y border-white/6">
      <div className="mx-auto max-w-[1440px] px-5 sm:px-6 md:px-10">
        <div className="mb-6 sm:mb-8">
          <h2 className="font-display text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-white">
            Featured creators
          </h2>
          <p className="text-sm sm:text-base text-ink-secondary mt-1">
            Independent studios and makers on METU.
          </p>
        </div>
        <div className="grid gap-5 lg:grid-cols-3">
          {/* Lead store: accent surface, taller cover, gold hairline. */}
          {lead && (
            <Link
              href={`/store/${lead.storeId}`}
              className="group surface-accent rounded-3xl overflow-hidden lift-on-hover hover:shadow-raised hover:border-mint/45 lg:row-span-2"
            >
              <div className="relative aspect-[16/10] bg-surface-2 overflow-hidden">
                {lead.coverImage && (
                  <Image
                    src={lead.coverImage}
                    alt={lead.name}
                    fill
                    sizes="(max-width: 1024px) 100vw, 33vw"
                    className="object-cover group-hover:scale-105 transition-transform"
                    unoptimized={isDataUrl(lead.coverImage)}
                  />
                )}
                <div className="absolute bottom-0 inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-metu-yellow to-transparent opacity-80" />
                <div className="absolute top-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-mint/20 backdrop-blur-sm px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-mint border border-mint/40">
                  <Sparkles className="h-3 w-3" /> Featured
                </div>
              </div>
              <div className="p-6 flex items-start gap-3">
                <div className="relative h-14 w-14 shrink-0 rounded-full bg-metu-yellow overflow-hidden ring-2 ring-surface-2 -mt-10">
                  {lead.profileImage && (
                    <Image src={lead.profileImage} alt={lead.name} fill sizes="56px" className="object-cover" unoptimized={isDataUrl(lead.profileImage)} />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-xs font-medium text-ink-dim">
                    <span>{lead.businessType?.name}</span>
                    {lead.sellerLevel > 0 && (
                      <Badge variant="gold" className="text-[10px]">
                        ⭐ Lv.{lead.sellerLevel} Seller
                      </Badge>
                    )}
                    {lead.rating > 0 && (
                      <span className="font-mono text-metu-yellow">
                        {(lead.rating / 10).toFixed(1)}★
                      </span>
                    )}
                  </div>
                  <div className="font-display font-bold text-xl text-white truncate">
                    {lead.name}
                  </div>
                  <div className="text-sm text-ink-secondary line-clamp-2 mt-1">
                    {lead.description}
                  </div>
                </div>
              </div>
            </Link>
          )}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 lg:col-span-2 lg:grid-rows-3 lg:grid-cols-1">
            {others.slice(0, 3).map((s) => (
              <Link
                key={s.storeId}
                href={`/store/${s.storeId}`}
                className="group surface-flat rounded-xl overflow-hidden lift-on-hover hover:shadow-raised hover:border-metu-yellow/40 flex"
              >
                <div className="relative w-24 sm:w-32 md:w-40 shrink-0 bg-surface-2 overflow-hidden">
                  {s.coverImage && (
                    <Image
                      src={s.coverImage}
                      alt={s.name}
                      fill
                      sizes="(max-width: 640px) 96px, 160px"
                      className="object-cover group-hover:scale-105 transition-transform"
                      unoptimized={isDataUrl(s.coverImage)}
                    />
                  )}
                </div>
                <div className="p-4 flex items-start gap-2 min-w-0 flex-1">
                  <div className="relative h-10 w-10 shrink-0 rounded-full bg-metu-yellow overflow-hidden ring-2 ring-surface-2">
                    {s.profileImage && (
                      <Image src={s.profileImage} alt={s.name} fill sizes="40px" className="object-cover" unoptimized={isDataUrl(s.profileImage)} />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-[10px] font-medium text-ink-dim uppercase tracking-wider">
                      <span>{s.businessType?.name}</span>
                      {s.sellerLevel > 0 && (
                        <Badge variant="gold" className="text-[9px] !px-1.5 !py-0">
                          Lv.{s.sellerLevel}
                        </Badge>
                      )}
                    </div>
                    <div className="font-display font-bold text-white truncate">
                      {s.name}
                    </div>
                    <div className="text-xs text-ink-secondary line-clamp-1 mt-0.5">
                      {s.description}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// Rotate radius + tone so category tiles don't all look identical.
const TILE_RADII = ["rounded-2xl", "rounded-3xl", "rounded-xl", "rounded-lg", "rounded-2xl"] as const;
const TILE_TONES = [
  "surface-accent text-mint hover:border-mint/45",
  "surface-flat text-white hover:border-metu-yellow/40",
  "surface-flat text-white hover:border-white/20",
  "surface-accent surface-accent--coral text-coral hover:border-coral/45",
  "surface-flat text-metu-yellow hover:border-metu-yellow/40",
] as const;

function CategoryTiles({ categories }: { categories: Category[] }) {
  if (!categories.length) return null;
  return (
    <section className="mx-auto max-w-[1440px] px-5 sm:px-6 md:px-10 py-10 sm:py-16">
      <h2 className="font-display text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-white mb-6 sm:mb-8">
        Shop by category
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        {categories.map((c, i) => {
          const radius = TILE_RADII[i % TILE_RADII.length];
          const tone = TILE_TONES[i % TILE_TONES.length];
          return (
            <Link
              key={c.categoryId}
              href={`/browse?category=${c.categoryId}`}
              className={cn(
                "group relative overflow-hidden p-5 font-display font-semibold cursor-pointer lift-on-hover hover:shadow-raised",
                radius,
                tone,
              )}
            >
              <div className="text-[10px] uppercase tracking-wider opacity-60">Category</div>
              <div className="mt-1 text-lg">{c.categoryName}</div>
              <div className="mt-3 text-xs font-normal text-ink-dim opacity-0 group-hover:opacity-100 transition-all">
                Explore →
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function WhyMetu() {
  // First card uses the accent surface so it outranks the other two.
  const items = [
    {
      icon: Zap,
      title: "Instant delivery",
      desc: "Digital products download or stream the moment you pay.",
      tone: "accent" as const,
    },
    {
      icon: ShieldCheck,
      title: "Built for trust",
      desc: "Store reviews, seller stats, and buyer protection baked in.",
      tone: "flat" as const,
    },
    {
      icon: Sparkles,
      title: "Beautifully designed",
      desc: "A marketplace that actually feels nice to browse and sell on.",
      tone: "flat" as const,
    },
  ];
  return (
    <section className="mx-auto max-w-[1440px] px-5 sm:px-6 md:px-10 py-10 sm:py-16">
      <div className="grid gap-5 sm:gap-6 sm:grid-cols-2 md:grid-cols-3">
        {items.map((it) => {
          const isAccent = it.tone === "accent";
          return (
            <div
              key={it.title}
              className={cn(
                "rounded-2xl p-6 sm:p-8 lift-on-hover hover:shadow-raised",
                isAccent ? "surface-accent" : "surface-flat",
              )}
            >
              <div
                className={cn(
                  "flex h-12 w-12 items-center justify-center rounded-xl",
                  isAccent
                    ? "bg-mint/20 text-mint border border-mint/30"
                    : "bg-metu-yellow/15 text-metu-yellow",
                )}
              >
                <it.icon className="h-6 w-6" strokeWidth={2.25} />
              </div>
              <h3 className="mt-5 font-display text-xl font-bold text-white">
                {it.title}
              </h3>
              <p className="mt-1 text-sm text-ink-secondary">{it.desc}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
