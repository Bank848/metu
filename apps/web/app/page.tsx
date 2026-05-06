import Link from "next/link";
import Image from "next/image";
import { Users, Package, ShoppingBag, Star, Sparkles, ShieldCheck, Zap, ArrowRight, Ticket, Clock } from "lucide-react";
import { TopNav } from "@/components/TopNav";
import { Footer } from "@/components/Footer";
import { StarField } from "@/components/DotGrid";
import { StatCard } from "@/components/StatCard";
import { ProductCard, type ProductCardProduct } from "@/components/ProductCard";
import { Badge } from "@/components/ui/Badge";
import { GlassButton } from "@/components/visual/GlassButton";
import { LightSweepText } from "@/components/visual/LightSweepText";
import { BrandMark } from "@/components/illustrations/BrandMark";
import { getStats, getFeaturedProducts, getFeaturedStores, getFeaturedCoupons, getCategories, getFavoriteSet } from "@/lib/server/queries";
import { coins, thbToCoins, fmtDate } from "@/lib/format";
import { getMe } from "@/lib/session";
import { isDataUrl, cn } from "@/lib/utils";

type Stats = { sellers: number; products: number; orders: number; reviews: number };
type Store = Awaited<ReturnType<typeof getFeaturedStores>>[number];
type Coupon = Awaited<ReturnType<typeof getFeaturedCoupons>>[number];
type Category = Awaited<ReturnType<typeof getCategories>>[number];

export const dynamic = "force-dynamic";

export default async function Home() {
  const me = await getMe();
  const [stats, products, stores, coupons, categories, favSet] = await Promise.all([
    getStats(),
    getFeaturedProducts(8),
    getFeaturedStores(4),
    getFeaturedCoupons(6),
    getCategories(),
    getFavoriteSet(me?.user.userId),
  ]);

  return (
    <>
      <TopNav />
      <main>
        <Hero stats={stats} />
        <TrendingProducts products={products} favSet={favSet} />
        <FeaturedCoupons coupons={coupons} />
        <FeaturedStores stores={stores} />
        <CategoryTiles categories={categories} />
        <WhyMetu />
      </main>
      <Footer />
    </>
  );
}

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
            Codes that expire this week or are running low on uses.
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

function Hero({ stats }: { stats: Stats }) {
  return (
    <section className="relative overflow-hidden bg-hero-radial min-h-[680px]">
      {/* Pure-CSS Jupiter; layered radial gradients fake atmospheric bands. */}
      <div aria-hidden className="pointer-events-none absolute -right-40 -bottom-32 md:-right-24 md:bottom-[-180px] h-[820px] w-[820px] rounded-full opacity-95 mix-blend-screen"
        style={{
          background: `
            radial-gradient(circle at 32% 38%, #ffd166 0%, #e09a2f 18%, #b26800 38%, #6d4310 58%, transparent 78%),
            radial-gradient(ellipse at 35% 45%, transparent 30%, rgba(178,104,0,0.4) 32%, transparent 36%),
            radial-gradient(ellipse at 35% 55%, transparent 35%, rgba(110,67,16,0.5) 37%, transparent 40%),
            radial-gradient(ellipse at 35% 35%, transparent 25%, rgba(255,209,102,0.4) 27%, transparent 30%)
          `,
          filter: "blur(0.4px)",
        }}
      />
      {/* Outer glow */}
      <div aria-hidden className="pointer-events-none absolute -right-40 -bottom-32 md:-right-24 md:bottom-[-180px] h-[820px] w-[820px] rounded-full opacity-50"
        style={{ background: "radial-gradient(circle, rgba(255,204,0,0.18), transparent 60%)" }}
      />

      {/* Stars */}
      <StarField density="high" />

      <div className="relative mx-auto max-w-[1440px] px-5 sm:px-6 md:px-10 pt-14 sm:pt-20 md:pt-28 pb-16 sm:pb-24 grid md:grid-cols-2 gap-8 md:gap-10 items-center min-h-[520px] md:min-h-[600px]">
        {/* Stagger delays cascade hero copy on first paint. */}
        <div>
          <div className="animate-stagger-rise" style={{ animationDelay: "0ms" }}>
            <Badge variant="yellow" className="mb-4 sm:mb-6 !px-3 !py-1 inline-flex items-center gap-1.5">
              <BrandMark className="h-3 w-3 text-metu-yellow" title="" />
              CPE241 · Group 8
            </Badge>
          </div>
          <h1 className="font-display text-5xl sm:text-6xl md:text-8xl font-black tracking-tighter leading-[0.92] mb-5 sm:mb-6">
            <span
              className="block text-white animate-stagger-rise"
              style={{ animationDelay: "80ms" }}
            >
              DIGITAL
            </span>
            <span
              className="block animate-stagger-rise"
              style={{ animationDelay: "160ms" }}
            >
              <LightSweepText className="block">MARKETPLACE</LightSweepText>
            </span>
          </h1>
          <p
            className="text-sm sm:text-base md:text-lg text-ink-secondary max-w-lg mb-6 sm:mb-10 leading-relaxed animate-stagger-rise"
            style={{ animationDelay: "240ms" }}
          >
            The marketplace for Thai digital creators. Templates, music, courses, art —
            sell and buy without ever shipping a thing.
          </p>
          <div
            className="flex flex-wrap gap-3 animate-stagger-rise"
            style={{ animationDelay: "320ms" }}
          >
            <GlassButton href="/browse" tone="gold" size="lg">
              Browse the catalog
              <ArrowRight className="h-4 w-4" />
            </GlassButton>
            <GlassButton href="/become-seller" tone="glass" size="lg">
              Open a store
            </GlassButton>
          </div>
        </div>
        <div className="hidden md:block" />
      </div>

      {/* 2x2 on mobile, 4-wide from md up. */}
      <div className="relative mx-auto max-w-[1440px] px-6 md:px-10 pb-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Sellers"  value={stats.sellers}  icon={Users} />
          <StatCard label="Products" value={stats.products} icon={Package} />
          <StatCard label="Orders"   value={stats.orders}   icon={ShoppingBag} />
          <StatCard label="Reviews"  value={stats.reviews}  icon={Star} />
        </div>
      </div>
    </section>
  );
}

function TrendingProducts({ products, favSet }: { products: ProductCardProduct[]; favSet: Set<number> }) {
  if (!products.length) return null;
  // First product is the feature card (spans 2 cols on desktop).
  const [feature, ...rest] = products;
  return (
    <section className="mx-auto max-w-[1440px] px-5 sm:px-6 md:px-10 py-10 sm:py-16">
      <div className="flex items-end justify-between mb-6 sm:mb-8 gap-3 flex-wrap">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.18em] text-mint">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-mint" />
            This week
          </div>
          <h2 className="font-display text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-white">
            Trending now
          </h2>
          <p className="text-sm sm:text-base text-ink-secondary mt-1">
            Most-bought items in the last 7 days, ranked by units sold.
          </p>
        </div>
        <Link href="/browse" className="text-sm font-semibold text-metu-yellow hover:underline">
          See all →
        </Link>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
        {/* Feature card lights up first; rest cascade behind it. The
            stagger uses globals.css `stagger-rise` (60ms apart, capped
            via inline animationDelay so the cascade is bounded). */}
        <div
          className="col-span-2 md:col-span-2 row-span-1 animate-[stagger-rise_0.6s_cubic-bezier(0.22,1,0.36,1)_both]"
          style={{ animationDelay: "0ms" }}
        >
          <ProductCard
            product={feature}
            isFavorited={favSet.has(feature.productId)}
            variant="feature"
            className="h-full"
          />
        </div>
        {rest.slice(0, 7).map((p, i) => (
          // Feature card is the LCP element; rest stay lazy to dodge
          // Next 14's multi-priority hydration mismatch warnings.
          <div
            key={p.productId}
            className="animate-[stagger-rise_0.6s_cubic-bezier(0.22,1,0.36,1)_both]"
            style={{ animationDelay: `${80 + i * 60}ms` }}
          >
            <ProductCard
              product={p}
              isFavorited={favSet.has(p.productId)}
            />
          </div>
        ))}
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
  // Copy reworked so the three cards don't all share the same "X
  // verb" parallel structure — each one now has its own rhythm.
  const items = [
    {
      icon: Zap,
      title: "Buy at midnight, download by 00:01",
      desc: "Every product on METU ships as a file or a license key. No couriers, no Bangkok traffic, no \"out for delivery\".",
      tone: "accent" as const,
    },
    {
      icon: ShieldCheck,
      title: "Reviews you can actually trust",
      desc: "Only buyers who paid can leave a review. Seller stats — refund rate, response time, fulfilment — sit one tap from every product page.",
      tone: "flat" as const,
    },
    {
      icon: Sparkles,
      title: "Made for creators, not enterprises",
      desc: "Open a store in five minutes. Stripe payouts arrive in two days. The fee is one number, posted on the seller dashboard.",
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
