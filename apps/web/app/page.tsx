import Link from "next/link";
import Image from "next/image";
import { Users, Package, ShoppingBag, Star, Sparkles, ShieldCheck, Zap } from "lucide-react";
import { api } from "@/lib/utils";
import { TopNav } from "@/components/TopNav";
import { Footer } from "@/components/Footer";
import { StarField } from "@/components/DotGrid";
import { StatCard } from "@/components/StatCard";
import { ProductCard, type ProductCardProduct } from "@/components/ProductCard";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

type Stats = { sellers: number; products: number; orders: number; reviews: number };
type Store = {
  storeId: number;
  name: string;
  description: string;
  coverImage?: string | null;
  profileImage?: string | null;
  businessType?: { name: string } | null;
  stats?: { rating: number } | null;
};
type Category = { categoryId: number; categoryName: string; description: string };

async function safe<T>(p: Promise<T>, fallback: T): Promise<T> {
  try {
    return await p;
  } catch {
    return fallback;
  }
}

export const dynamic = "force-dynamic";

export default async function Home() {
  const [stats, products, stores, categories] = await Promise.all([
    safe(api<Stats>("/stats"), { sellers: 0, products: 0, orders: 0, reviews: 0 }),
    safe(api<ProductCardProduct[]>("/products/featured"), []),
    safe(api<Store[]>("/stores?limit=4"), []),
    safe(api<Category[]>("/categories"), []),
  ]);

  return (
    <>
      <TopNav />
      {/* TopNav is an async server component (Next 14 App Router supports this natively) */}
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
    <section className="relative overflow-hidden bg-space-black min-h-[640px]">
      {/* Jupiter-esque planet bottom-right */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-32 -bottom-24 md:-right-20 md:bottom-[-120px] h-[720px] w-[720px] rounded-full opacity-80"
        style={{
          background:
            "radial-gradient(circle at 32% 40%, #d4a84b 0%, #8b6914 25%, #4a3a10 55%, transparent 75%)",
          filter: "blur(1px)",
          mixBlendMode: "screen",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-20 -bottom-24 md:-right-10 md:bottom-[-110px] h-[680px] w-[680px] rounded-full"
        style={{
          background:
            "radial-gradient(circle at 38% 38%, #b9823c 0%, #7a4f1e 30%, transparent 60%)",
        }}
      />
      {/* Subtle tungsten glow from top-right */}
      <div aria-hidden className="absolute inset-0 bg-tungsten-fade" />
      {/* Starfield */}
      <StarField />

      <div className="relative mx-auto max-w-[1440px] px-6 md:px-10 pt-16 md:pt-24 pb-20 grid md:grid-cols-2 gap-10 items-center min-h-[560px]">
        <div>
          <Badge variant="yellow" className="mb-5 !px-3 !py-1">
            CPE241 · Group 8 · Live Demo
          </Badge>
          <h1 className="font-display text-6xl md:text-8xl font-black tracking-tighter leading-[0.95] mb-4">
            <span className="block text-white">DIGITAL</span>
            <span className="block text-brand-yellow">MARKETPLACE</span>
          </h1>
          <p className="text-base md:text-lg text-ink-secondary max-w-lg mb-8 leading-relaxed">
            The marketplace for Thai digital creators. Templates, music, courses, art —
            sell and buy without ever shipping a thing.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button href="/browse" variant="primary" size="lg">
              Explore Now →
            </Button>
            <Button href="/become-seller" variant="ghost" size="lg">
              Sell your work
            </Button>
          </div>
        </div>

        <div className="hidden md:block" />
      </div>

      {/* Stats strip floating above the hero bottom */}
      <div className="relative mx-auto max-w-[1440px] px-6 md:px-10 pb-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 backdrop-blur">
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
        <Link href="/browse" className="text-sm font-semibold text-brand-yellow hover:underline">
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
    <section className="bg-space-950/60 py-16 border-y border-line">
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
              className="group rounded-2xl bg-space-850 border border-line overflow-hidden transition-all hover:border-brand-yellow/50 hover:-translate-y-1"
            >
              <div className="relative aspect-[5/2] bg-space-900 overflow-hidden">
                {s.coverImage && (
                  <Image
                    src={s.coverImage}
                    alt={s.name}
                    fill
                    sizes="(max-width: 768px) 100vw, 25vw"
                    className="object-cover group-hover:scale-105 transition-transform"
                    unoptimized
                  />
                )}
              </div>
              <div className="p-5 flex items-start gap-3">
                <div className="relative h-12 w-12 shrink-0 rounded-full bg-brand-yellow overflow-hidden ring-2 ring-space-900 -mt-8">
                  {s.profileImage && (
                    <Image src={s.profileImage} alt={s.name} fill sizes="48px" className="object-cover" unoptimized />
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
  const accents = [
    "bg-brand-yellow/10 text-brand-yellow border-brand-yellow/30",
    "bg-white/5 text-white border-line",
    "bg-brand-yellow/5 text-brand-yellow border-brand-yellow/20",
    "bg-white/5 text-white border-line",
  ];
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
            className={`rounded-2xl p-5 font-display font-semibold transition-all hover:-translate-y-0.5 border ${accents[i % accents.length]}`}
          >
            <div className="text-[10px] uppercase tracking-wider opacity-60">Category</div>
            <div className="mt-1 text-lg">{c.categoryName}</div>
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
            className="rounded-2xl border border-line bg-space-850 p-8"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-yellow/15 text-brand-yellow">
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
