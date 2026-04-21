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
import { getStats, getFeaturedProducts, getFeaturedStores, getCategories } from "@/lib/server/queries";
import { isDataUrl } from "@/lib/utils";

type Stats = { sellers: number; products: number; orders: number; reviews: number };
type Store = Awaited<ReturnType<typeof getFeaturedStores>>[number];
type Category = Awaited<ReturnType<typeof getCategories>>[number];

export const dynamic = "force-dynamic";

export default async function Home() {
  const [stats, products, stores, categories] = await Promise.all([
    getStats(),
    getFeaturedProducts(8),
    getFeaturedStores(4),
    getCategories(),
  ]);

  return (
    <>
      <TopNav />
      <main>
        <Hero stats={stats} />
        <TrendingProducts products={products} />
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
        <div className="animate-fade-in-up">
          <Badge variant="yellow" className="mb-6 !px-3 !py-1">
            CPE241 · Group 8 · Live Demo
          </Badge>
          <h1 className="font-display text-6xl md:text-8xl font-black tracking-tighter leading-[0.92] mb-6">
            <span className="block text-white">DIGITAL</span>
            <LightSweepText className="block">MARKETPLACE</LightSweepText>
          </h1>
          <p className="text-base md:text-lg text-ink-secondary max-w-lg mb-10 leading-relaxed">
            The marketplace for Thai digital creators. Templates, music, courses, art —
            sell and buy without ever shipping a thing.
          </p>
          <div className="flex flex-wrap gap-3">
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

      {/* Stats strip (sits at the bottom of the hero, glassmorphic) */}
      <div className="relative mx-auto max-w-[1440px] px-6 md:px-10 pb-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Sellers"  value={stats.sellers}  icon={Users}       accent="yellow" />
          <StatCard label="Products" value={stats.products} icon={Package} />
          <StatCard label="Orders"   value={stats.orders}   icon={ShoppingBag} />
          <StatCard label="Reviews"  value={stats.reviews}  icon={Star} />
        </div>
      </div>
    </section>
  );
}

function TrendingProducts({ products }: { products: ProductCardProduct[] }) {
  if (!products.length) return null;
  return (
    <section className="mx-auto max-w-[1440px] px-6 md:px-10 py-16">
      <div className="flex items-end justify-between mb-8">
        <div>
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
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
        {products.map((p) => (
          <ProductCard key={p.productId} product={p} />
        ))}
      </div>
    </section>
  );
}

function FeaturedStores({ stores }: { stores: Store[] }) {
  if (!stores.length) return null;
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {stores.map((s) => (
            <Link
              key={s.storeId}
              href={`/store/${s.storeId}`}
              className="group glass-morphism rounded-2xl overflow-hidden transition-all hover:border-metu-yellow/40 hover:-translate-y-1"
            >
              <div className="relative aspect-[5/2] bg-surface-2 overflow-hidden">
                {s.coverImage && (
                  <Image
                    src={s.coverImage}
                    alt={s.name}
                    fill
                    sizes="(max-width: 768px) 100vw, 25vw"
                    className="object-cover group-hover:scale-105 transition-transform"
                    unoptimized={isDataUrl(s.coverImage)}
                  />
                )}
                {/* gold accent bar */}
                <div className="absolute bottom-0 inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-metu-yellow to-transparent opacity-70" />
              </div>
              <div className="p-5 flex items-start gap-3">
                <div className="relative h-12 w-12 shrink-0 rounded-full bg-metu-yellow overflow-hidden ring-2 ring-surface-2 -mt-8">
                  {s.profileImage && (
                    <Image src={s.profileImage} alt={s.name} fill sizes="48px" className="object-cover" unoptimized={isDataUrl(s.profileImage)} />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-medium text-ink-dim">
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
    </section>
  );
}

function CategoryTiles({ categories }: { categories: Category[] }) {
  if (!categories.length) return null;
  return (
    <section className="mx-auto max-w-[1440px] px-6 md:px-10 py-16">
      <h2 className="font-display text-3xl md:text-4xl font-extrabold tracking-tight text-white mb-8">
        Shop by category
      </h2>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {categories.map((c, i) => (
          <Link
            key={c.categoryId}
            href={`/browse?category=${c.categoryId}`}
            className={`group relative overflow-hidden rounded-2xl p-5 font-display font-semibold cursor-pointer transition-all duration-200 hover:-translate-y-1 hover:shadow-pop hover:border-metu-yellow/60 hover:bg-white/[0.05] ${
              i % 3 === 0
                ? "glass-morphism text-metu-yellow border-metu-yellow/25"
                : "glass-morphism text-white"
            }`}
          >
            <div className="text-[10px] uppercase tracking-wider opacity-60">Category</div>
            <div className="mt-1 text-lg">{c.categoryName}</div>
            {/* visible explore affordance on hover */}
            <div className="mt-3 text-xs font-normal text-ink-dim opacity-0 group-hover:opacity-100 group-hover:text-metu-yellow transition-all">
              Explore →
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-metu-yellow/40 to-transparent group-hover:via-metu-yellow group-hover:h-[2px] transition-all" />
          </Link>
        ))}
      </div>
    </section>
  );
}

function WhyMetu() {
  const items = [
    { icon: Zap,         title: "Instant delivery",   desc: "Digital products download or stream the moment you pay." },
    { icon: ShieldCheck, title: "Built for trust",    desc: "Store reviews, seller stats, and buyer protection baked in." },
    { icon: Sparkles,    title: "Beautifully designed", desc: "A marketplace that actually feels nice to browse and sell on." },
  ];
  return (
    <section className="mx-auto max-w-[1440px] px-6 md:px-10 py-16">
      <div className="grid gap-6 md:grid-cols-3">
        {items.map((it) => (
          <div
            key={it.title}
            className="glass-morphism rounded-2xl p-8"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-metu-yellow/15 text-metu-yellow">
              <it.icon className="h-6 w-6" strokeWidth={2.25} />
            </div>
            <h3 className="mt-5 font-display text-xl font-bold text-white">
              {it.title}
            </h3>
            <p className="mt-1 text-sm text-ink-secondary">{it.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
