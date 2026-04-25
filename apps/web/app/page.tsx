import Link from "next/link";
import Image from "next/image";
import { Users, Package, ShoppingBag, Star, Sparkles, ShieldCheck, Zap, ArrowRight } from "lucide-react";
import { TopNav } from "@/components/TopNav";
import { Footer } from "@/components/Footer";
import { StarField } from "@/components/DotGrid";
import { StatCard } from "@/components/StatCard";
import { ProductCard, type ProductCardProduct } from "@/components/ProductCard";
import { Badge } from "@/components/ui/Badge";
import { GlassButton } from "@/components/visual/GlassButton";
import { LightSweepText } from "@/components/visual/LightSweepText";
import { BrandMark } from "@/components/illustrations/BrandMark";
import { getStats, getFeaturedProducts, getFeaturedStores, getCategories, getFavoriteSet } from "@/lib/server/queries";
import { getMe } from "@/lib/session";
import { isDataUrl, cn } from "@/lib/utils";

type Stats = { sellers: number; products: number; orders: number; reviews: number };
type Store = Awaited<ReturnType<typeof getFeaturedStores>>[number];
type Category = Awaited<ReturnType<typeof getCategories>>[number];

export const dynamic = "force-dynamic";

export default async function Home() {
  const me = await getMe();
  const [stats, products, stores, categories, favSet] = await Promise.all([
    getStats(),
    getFeaturedProducts(8),
    getFeaturedStores(4),
    getCategories(),
    getFavoriteSet(me?.user.userId),
  ]);

  return (
    <>
      <TopNav />
      <main>
        <Hero stats={stats} />
        <TrendingProducts products={products} favSet={favSet} />
        <FeaturedStores stores={stores} />
        <CategoryTiles categories={categories} />
        <WhyMetu />
      </main>
      <Footer />
    </>
  );
}

function Hero({ stats }: { stats: Stats }) {
  return (
    <section className="relative overflow-hidden bg-hero-radial min-h-[680px]">
      {/* Layered Jupiter — pure CSS, four radial gradients to fake atmospheric bands */}
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

      <div className="relative mx-auto max-w-[1440px] px-6 md:px-10 pt-20 md:pt-28 pb-24 grid md:grid-cols-2 gap-10 items-center min-h-[600px]">
        {/* Each child carries a stagger delay so the hero copy cascades on
            first paint instead of every line popping in together — Wave-1
            keyframe `stagger-rise` already respects reduced-motion. */}
        <div>
          <div className="animate-stagger-rise" style={{ animationDelay: "0ms" }}>
            <Badge variant="yellow" className="mb-6 !px-3 !py-1 inline-flex items-center gap-1.5">
              {/* The BrandMark replaces the lone Lucide spark this row used
                  to lean on; one custom SVG in the eyebrow tells visitors
                  the brand exists before they reach the wordmark below. */}
              <BrandMark className="h-3 w-3 text-metu-yellow" title="" />
              CPE241 · Group 8 · Live Demo
            </Badge>
          </div>
          <h1 className="font-display text-6xl md:text-8xl font-black tracking-tighter leading-[0.92] mb-6">
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
            className="text-base md:text-lg text-ink-secondary max-w-lg mb-10 leading-relaxed animate-stagger-rise"
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
              Explore Now
              <ArrowRight className="h-4 w-4" />
            </GlassButton>
            <GlassButton href="/become-seller" tone="glass" size="lg">
              Sell your work
            </GlassButton>
          </div>
        </div>
        <div className="hidden md:block" />
      </div>

      {/* Stats strip — broken out of the 4-equal-col grid. F26 (QA
          2026-04-25): the SELLERS card previously rendered with the
          `highlight` variant (mint surface-accent + mint icon chip),
          which read as "this tile is selected" rather than "this tile
          is the lead metric". All four cards now share the default
          `surface-flat` treatment so the row reads as a consistent
          stat row; the asymmetric column layout (Sellers + Reviews
          spanning 2 cols on md+) is preserved so the row isn't four
          identical squares either — the rhythm comes from spacing,
          not from a colour swap. */}
      <div className="relative mx-auto max-w-[1440px] px-6 md:px-10 pb-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="md:col-span-2">
            <StatCard label="Sellers" value={stats.sellers} icon={Users} />
          </div>
          <StatCard label="Products" value={stats.products} icon={Package} />
          <StatCard label="Orders"   value={stats.orders}   icon={ShoppingBag} />
          {/* Reviews is the lowest-volume number — let it sit as a third
              equal tile under tablet+; on mobile it follows the others. */}
          <div className="md:col-span-2 lg:col-span-1">
            <StatCard label="Reviews" value={stats.reviews} icon={Star} />
          </div>
        </div>
      </div>
    </section>
  );
}

function TrendingProducts({ products, favSet }: { products: ProductCardProduct[]; favSet: Set<number> }) {
  if (!products.length) return null;
  // Split the first product off as the editorial "feature" card. The rest
  // flow into a 3-col grid where the feature occupies 2 cols on desktop —
  // this kills the symmetric 4×N grid that was the loudest AI tell.
  const [feature, ...rest] = products;
  return (
    <section className="mx-auto max-w-[1440px] px-6 md:px-10 py-16">
      <div className="flex items-end justify-between mb-8">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.18em] text-mint">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-mint" />
            This week
          </div>
          <h2 className="font-display text-3xl md:text-4xl font-extrabold tracking-tight text-white">
            Trending now
          </h2>
          <p className="text-ink-secondary mt-1">
            The digital products creators are loving this week.
          </p>
        </div>
        <Link href="/browse" className="text-sm font-semibold text-metu-yellow hover:underline">
          See all →
        </Link>
      </div>
      {/* Asymmetric layout: feature spans 2 cols on lg, rest fall into the
          remaining slots. The 3-col base grid means desktop reads as
          2+1 / 1+1+1 / 1+1+1, mobile stays 2-up.  */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
        <div className="col-span-2 md:col-span-2 row-span-1">
          <ProductCard
            product={feature}
            isFavorited={favSet.has(feature.productId)}
            variant="feature"
            className="h-full"
          />
        </div>
        {rest.slice(0, 7).map((p) => (
          <ProductCard key={p.productId} product={p} isFavorited={favSet.has(p.productId)} />
        ))}
      </div>
    </section>
  );
}

function FeaturedStores({ stores }: { stores: Store[] }) {
  if (!stores.length) return null;
  // 1-large + 3-small layout — first store is the editorial standout
  // (mint surface-accent + larger cover); the rest are flat cards
  // stacked beside it on desktop, full-width on mobile.
  const [lead, ...others] = stores;
  return (
    <section className="bg-surface-2/60 py-16 border-y border-white/6">
      <div className="mx-auto max-w-[1440px] px-6 md:px-10">
        <div className="mb-8">
          <h2 className="font-display text-3xl md:text-4xl font-extrabold tracking-tight text-white">
            Featured creators
          </h2>
          <p className="text-ink-secondary mt-1">
            Independent studios and makers on METU.
          </p>
        </div>
        <div className="grid gap-5 lg:grid-cols-3">
          {/* Standout store — mint surface-accent, taller cover, gold
              hairline preserved here (per playbook §9: hairline is for
              the feature card only, not every grid card). */}
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
                {/* Gold hairline kept on the standout only */}
                <div className="absolute bottom-0 inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-metu-yellow to-transparent opacity-80" />
                {/* Editorial eyebrow on the cover — mint chip ties the
                    card back to the surface-accent tint. */}
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
                  <div className="text-xs font-medium text-ink-dim">
                    {lead.businessType?.name}
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

          {/* Three small stores stacked into the right-hand column on
              desktop, then sit in their own row on mobile. */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 lg:col-span-2 lg:grid-rows-3 lg:grid-cols-1">
            {others.slice(0, 3).map((s) => (
              <Link
                key={s.storeId}
                href={`/store/${s.storeId}`}
                className="group surface-flat rounded-xl overflow-hidden lift-on-hover hover:shadow-raised hover:border-metu-yellow/40 flex"
              >
                <div className="relative w-32 sm:w-40 shrink-0 bg-surface-2 overflow-hidden">
                  {s.coverImage && (
                    <Image
                      src={s.coverImage}
                      alt={s.name}
                      fill
                      sizes="160px"
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
                    <div className="text-[10px] font-medium text-ink-dim uppercase tracking-wider">
                      {s.businessType?.name}
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

/* Per-tile recipe for the category row. Each tile gets its own radius +
   tone so the row stops reading as nine identical glass squares — see
   docs/design-system.md §1 row 5. We rotate through three radius
   families and three tones; the modulo math means any number of
   categories still produces a varied row. */
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
    <section className="mx-auto max-w-[1440px] px-6 md:px-10 py-16">
      <h2 className="font-display text-3xl md:text-4xl font-extrabold tracking-tight text-white mb-8">
        Shop by category
      </h2>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
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
              {/* visible explore affordance on hover */}
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
  // First card opts into surface-accent (mint) so it visually outranks
  // the other two — same "1 hero + N flat" rhythm we use across the
  // home page. Per Wave-1 handoff doc.
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
    <section className="mx-auto max-w-[1440px] px-6 md:px-10 py-16">
      <div className="grid gap-6 md:grid-cols-3">
        {items.map((it) => {
          const isAccent = it.tone === "accent";
          return (
            <div
              key={it.title}
              className={cn(
                "rounded-2xl p-8 lift-on-hover hover:shadow-raised",
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
