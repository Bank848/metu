import Image from "next/image";
import Link from "next/link";

import { 
  Star, Clock, MessageSquare, ShieldCheck, Flame, 
  Package, Download, Mail, KeyRound, Play, Lock as Lock, Zap, RotateCcw
} from "lucide-react";

import { notFound } from "next/navigation";
import { TopNav } from "@/components/TopNav";
import { Footer } from "@/components/Footer";
import { Badge } from "@/components/ui/Badge";
import { Reviews } from "@/components/Reviews";
import { getProduct, getFavoriteSet, getRecentPurchaseCount, getRelatedProducts, getOwnedOrderId } from "@/lib/server/queries";
import { ProductCard } from "@/components/ProductCard";
import { getMe } from "@/lib/session";
import { getServerT } from "@/lib/i18n/server";
import { isDataUrl } from "@/lib/utils";
import { FavoriteButton } from "@/components/FavoriteButton";
import { ExpandableText } from "@/components/ExpandableText";
import { RecentPing } from "@/components/RecentPing";
import { ShareButton } from "@/components/ShareButton";
import { AddToCart } from "./AddToCart";
import { Gallery } from "./Gallery";
import { ImageLightbox } from "@/components/ImageLightbox";

type Product = {
  productId: number;
  name: string;
  description: string;
  isStackable: boolean;
  avgRating?: number;
  reviewCount?: number;
  store: { storeId: number; ownerId: number; name: string; description: string; profileImage?: string | null; businessType?: { name: string } | null; stats?: { rating: number; responseTime: number } | null };
  category: { categoryName: string };
  items: Array<{ productItemId: number; deliveryMethod: string; price: string | number; discountPercent: number; quantity: number }>;
  images: Array<{ productImage: string }>;
  productNTags: Array<{ tag: { tagName: string; tagId: number } }>;
  details?: Array<{ productDetailId: number; detailName: string; detailValue: string }>;
  reviews: Array<{ reviewId: number; rating: number; comment: string; createdAt: string; user: { userId: number; firstName: string; lastName: string; profileImage?: string | null; username: string } }>;
};

export const dynamic = "force-dynamic";

export default async function ProductPage({ params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isFinite(id)) return notFound();

  const me = await getMe();
  const [product, favSet, recentBuyers, related, ownedOrderId] = await Promise.all([
    getProduct(id) as Promise<Product | null>,
    getFavoriteSet(me?.user.userId),
    getRecentPurchaseCount(id, 7),
    getRelatedProducts(id, 4),
    me?.user.userId ? getOwnedOrderId(me.user.userId, id) : Promise.resolve(null),
  ]);

  if (!product) return notFound();

  const t = getServerT();
  const isFavorited = favSet.has(product.productId);

  const items = product.items.map((it) => ({
    ...it,
    price: Number(it.price),
    finalPrice: Number(it.price) * (1 - (it.discountPercent ?? 0) / 100),
    stock: it.quantity,
    sampleUrl: (it as any).sampleUrl ?? null,
    name: (it as any).name ?? null,
    description: (it as any).description ?? null,
    image: (it as any).image ?? null,
  }));

  const productImages = product.images.map((i) => i.productImage);
  const variantImages = items
    .map((it) => it.image)
    .filter((img): img is string => Boolean(img) && !productImages.includes(img));
  const allImages = [...productImages, ...variantImages];

  const DELIVERY_LABEL: Record<string, string> = {
    download:    "Instant Download",
    email:       "Delivered by Email",
    license_key: "License Key",
    streaming:   "Streaming Access",
  };

  const DELIVERY_ICON: Record<string, React.ReactNode> = {
    download:    <Download className="h-3 w-3" />,
    email:       <Mail className="h-3 w-3" />,
    license_key: <KeyRound className="h-3 w-3" />,
    streaming:   <Play className="h-3 w-3" />,
  };

  return (
    <>
      <TopNav />
      <RecentPing productId={product.productId} />

      {/* Lightbox — client component */}
      <ImageLightbox images={allImages} />

      <main id="main" className="mx-auto max-w-[1440px] px-4 sm:px-6 md:px-10 py-6 sm:py-10">

        {/* Breadcrumb */}
        <nav className="text-xs sm:text-sm text-ink-dim mb-6 flex items-center gap-2">
          <Link href="/browse" className="hover:text-metu-yellow">Browse</Link>
          <span>/</span>
          <span>{product.category.categoryName}</span>
          <span>/</span>
          <span className="text-white font-medium truncate">{product.name}</span>
        </nav>

        <div className="grid lg:grid-cols-[1fr_400px] gap-6 sm:gap-8 xl:gap-12 items-start">

          {/* Gallery — left col on desktop, top of stack on mobile. */}
          <div className="min-w-0 lg:col-start-1 lg:row-start-1">
            <Gallery images={allImages} alt={product.name}/>
          </div>

          {/* ── LEFT COLUMN (description / specs / reviews) ── */}
          <div className="space-y-6 min-w-0 lg:col-start-1 lg:row-start-2">

            {/* Description */}
            <div className="rounded-2xl border border-white/8 bg-white/[0.02] px-6 py-5">
              <h3 className="text-[10px] font-bold uppercase tracking-[0.18em] text-metu-yellow mb-4 flex items-center gap-2">
                <span className="h-px flex-1 bg-metu-yellow/20" />
                Description
                <span className="h-px flex-1 bg-metu-yellow/20" />
              </h3>
              <div className="text-sm text-ink-secondary leading-relaxed whitespace-pre-line">
                {product.description}
              </div>
            </div>

            {/* Specifications */}
            {product.details && product.details.length > 0 && (
              <div className="rounded-2xl border border-mint/20 bg-mint/[0.03] px-6 py-5 border-l-4 border-l-mint">
                <h3 className="text-[10px] font-bold uppercase tracking-[0.18em] text-mint mb-4 flex items-center gap-2">
                  <span className="h-px flex-1 bg-mint/20" />
                  Specifications
                  <span className="h-px flex-1 bg-mint/20" />
                </h3>
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {product.details.map((d, i) => (
                    <div
                      key={d.productDetailId}
                      className="flex flex-col gap-0.5 animate-[stagger-rise_0.5s_cubic-bezier(0.22,1,0.36,1)_both]"
                      style={{ animationDelay: `${i * 50}ms` }}
                    >
                      <dt className="text-[10px] font-black uppercase tracking-widest text-ink-dim">{d.detailName}</dt>
                      <dd className="text-sm font-semibold text-white">{d.detailValue}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}

            {/* Reviews */}
            <section>
              <div className="flex items-end justify-between mb-5 border-b border-white/8 pb-3">
                <h2 className="font-display text-xl font-bold text-white flex items-center gap-2">
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
                isAdmin={me?.role === "admin"}
                currentUserId={me?.user.userId}
              />
            </section>
          </div>

          {/* ── RIGHT COLUMN — sticky purchase panel ── */}
          <div className="lg:col-start-2 lg:row-start-1 lg:row-span-2 lg:sticky lg:top-24 lg:self-start space-y-4">

            {/* Title + meta */}
            <div>
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <Badge variant="yellow">{product.category.categoryName}</Badge>
                {product.productNTags.slice(0, 3).map((nt) => (
                  <Badge key={nt.tag.tagId} variant="mist">{nt.tag.tagName}</Badge>
                ))}
              </div>
              <div className="flex items-start gap-2 mb-3">
                <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex-1 min-w-0">
                  {product.name}
                </h1>
                <FavoriteButton productId={product.productId} initial={isFavorited} size="md" />
                <ShareButton title={product.name} text={`Check out "${product.name}" on METU`} size="md" />
              </div>
              <div className="flex items-center gap-4 text-sm">
                {product.avgRating !== undefined && (
                  <div className="flex items-center gap-1">
                    <Star className="h-4 w-4 fill-metu-yellow stroke-metu-yellow" />
                    <span className="font-semibold text-white">{product.avgRating.toFixed(1)}</span>
                    <span className="text-ink-dim">({product.reviewCount} reviews)</span>
                  </div>
                )}
              </div>
            </div>

            {/* Hot badge */}
            {recentBuyers >= 2 && (
              <div className="inline-flex items-center gap-1.5 rounded-full bg-orange-400/10 border border-orange-400/30 text-orange-300 px-3 py-1 text-xs font-semibold">
                <Flame className="h-3 w-3" />
                {recentBuyers} people bought this in the last week
              </div>
            )}

            {/* Variants + Add to cart */}
            {me && me.user.userId === product.store.ownerId ? (
              <div className="space-y-3">
                <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
                  This is your own store. Sign in as a buyer to test checkout.
                </div>
              </div>
            ) : (
              <AddToCart items={items} ownedOrderId={!product.isStackable ? ownedOrderId : null} />
            )}

            {/* Store card */}
            <Link
              href={`/store/${product.store.storeId}`}
              className="flex items-center gap-3 rounded-2xl surface-flat p-4 hover:border-metu-yellow/40 transition lift-on-hover"
            >
              <div className="relative h-11 w-11 shrink-0 rounded-full bg-metu-yellow overflow-hidden">
                {product.store.profileImage && (
                  <Image src={product.store.profileImage} alt={product.store.name} fill sizes="44px" className="object-cover" unoptimized={isDataUrl(product.store.profileImage)} />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-medium text-ink-dim flex items-center gap-1">
                  <ShieldCheck className="h-3 w-3 text-metu-yellow" />
                  Verified · {product.store.businessType?.name}
                </div>
                <div className="font-display font-bold text-white text-sm">{product.store.name}</div>
              </div>
              <span className="text-xs text-metu-yellow shrink-0">Visit →</span>
            </Link>

            {/* Trust badges */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { icon: <Lock className="h-4 w-4" />, label: "Secure Checkout" },
                { icon: <Zap className="h-4 w-4" />,  label: "Instant Delivery" },
                { icon: <RotateCcw className="h-4 w-4" />, label: "Refund Policy" },
              ].map((b) => (
                <div key={b.label} className="flex flex-col items-center gap-1.5 py-3 rounded-xl border border-white/6 bg-white/[0.02]">
                  <span className="text-metu-yellow/60">{b.icon}</span>
                  <span className="text-[9px] font-bold text-ink-dim uppercase tracking-wider text-center leading-tight">{b.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Related */}
        {related.length > 0 && (
          <section className="mt-16">
            <div className="flex items-end justify-between mb-6 border-b border-white/8 pb-3">
              <h2 className="font-display text-2xl font-bold text-white">More like this</h2>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
              {related.map((p) => (
                <ProductCard key={p.productId} product={p} isFavorited={favSet.has(p.productId)} />
              ))}
            </div>
          </section>
        )}
      </main>
      <Footer />
    </>
  );
}
