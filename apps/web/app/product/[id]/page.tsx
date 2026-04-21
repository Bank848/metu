import Image from "next/image";
import Link from "next/link";
import { Star, Clock, MessageSquare, ShieldCheck } from "lucide-react";
import { notFound } from "next/navigation";
import { TopNav } from "@/components/TopNav";
import { Footer } from "@/components/Footer";
import { Badge } from "@/components/ui/Badge";
import { Reviews } from "@/components/Reviews";
import { getProduct } from "@/lib/server/queries";
import { getMe } from "@/lib/session";
import { isDataUrl } from "@/lib/utils";
import { AddToCart } from "./AddToCart";
import { Gallery } from "./Gallery";

type Product = {
  productId: number;
  name: string;
  description: string;
  avgRating?: number;
  reviewCount?: number;
  store: { storeId: number; name: string; description: string; profileImage?: string | null; businessType?: { name: string } | null; stats?: { rating: number; responseTime: number } | null };
  category: { categoryName: string };
  items: Array<{ productItemId: number; deliveryMethod: string; price: string | number; discountPercent: number; quantity: number }>;
  images: Array<{ productImage: string }>;
  productNTags: Array<{ tag: { tagName: string; tagId: number } }>;
  reviews: Array<{ reviewId: number; rating: number; comment: string; createdAt: string; user: { firstName: string; lastName: string; profileImage?: string | null; username: string } }>;
};

export const dynamic = "force-dynamic";

export default async function ProductPage({ params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isFinite(id)) return notFound();
  const [product, me] = await Promise.all([
    getProduct(id) as Promise<Product | null>,
    getMe(),
  ]);
  if (!product) return notFound();

  const items = product.items.map((it) => ({
    ...it,
    price: Number(it.price),
    finalPrice: Number(it.price) * (1 - (it.discountPercent ?? 0) / 100),
  }));

  return (
    <>
      <TopNav />
      <main className="mx-auto max-w-[1440px] px-6 md:px-10 py-10">
        <nav className="text-sm text-ink-dim mb-6 flex items-center gap-2">
          <Link href="/browse" className="hover:text-metu-yellow">Browse</Link>
          <span className="text-ink-mute">/</span>
          <span>{product.category.categoryName}</span>
          <span className="text-ink-mute">/</span>
          <span className="text-white font-medium truncate max-w-[400px]">{product.name}</span>
        </nav>

        <div className="grid md:grid-cols-[1.15fr_1fr] gap-10">
          <Gallery images={product.images.map((i) => i.productImage)} alt={product.name} />

          <div>
            <div className="flex items-center gap-2 mb-3">
              <Badge variant="yellow">{product.category.categoryName}</Badge>
              {product.productNTags.slice(0, 3).map((nt) => (
                <Badge key={nt.tag.tagId} variant="mist">{nt.tag.tagName}</Badge>
              ))}
            </div>
            <h1 className="font-display text-3xl md:text-4xl font-extrabold tracking-tight text-white mb-3">
              {product.name}
            </h1>
            <div className="flex items-center gap-4 mb-4 text-sm">
              {product.avgRating !== undefined && (
                <div className="flex items-center gap-1">
                  <Star className="h-4 w-4 fill-metu-yellow stroke-metu-yellow" />
                  <span className="font-semibold text-white">{product.avgRating.toFixed(1)}</span>
                  <span className="text-ink-dim">({product.reviewCount} reviews)</span>
                </div>
              )}
              {product.store.stats && (
                <div className="flex items-center gap-1 text-ink-dim">
                  <Clock className="h-4 w-4" />
                  <span>~{Math.round(product.store.stats.responseTime / 60)}h response</span>
                </div>
              )}
            </div>
            <p className="text-ink-secondary leading-relaxed mb-6">{product.description}</p>

            <Link
              href={`/store/${product.store.storeId}`}
              className="flex items-center gap-3 rounded-2xl glass-morphism p-4 mb-6 hover:border-metu-yellow/40 transition"
            >
              <div className="relative h-12 w-12 shrink-0 rounded-full bg-metu-yellow overflow-hidden">
                {product.store.profileImage && (
                  <Image src={product.store.profileImage} alt={product.store.name} fill sizes="48px" className="object-cover" unoptimized={isDataUrl(product.store.profileImage)} />
                )}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-medium text-ink-dim flex items-center gap-1">
                  <ShieldCheck className="h-3 w-3 text-metu-yellow" />
                  Verified · {product.store.businessType?.name}
                </div>
                <div className="font-display font-bold text-white">{product.store.name}</div>
              </div>
              <div className="ml-auto text-xs text-metu-yellow">Visit store →</div>
            </Link>

            <AddToCart items={items} />
          </div>
        </div>

        {/* Reviews tab */}
        <section className="mt-16">
          <div className="flex items-end justify-between mb-6 border-b border-white/8 pb-3">
            <h2 className="font-display text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-metu-yellow" />
              Reviews
              <span className="text-ink-dim text-base font-normal">
                ({product.reviewCount ?? product.reviews.length})
              </span>
            </h2>
          </div>
          <Reviews
            productId={product.productId}
            initialReviews={product.reviews}
            avgRating={product.avgRating}
            reviewCount={product.reviewCount ?? product.reviews.length}
            canWrite={Boolean(me)}
          />
        </section>
      </main>
      <Footer />
    </>
  );
}
