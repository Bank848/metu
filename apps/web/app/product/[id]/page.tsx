import Image from "next/image";
import Link from "next/link";
import { Star, Clock, MessageSquare, ShieldCheck, Flame } from "lucide-react";
import { notFound } from "next/navigation";
import { TopNav } from "@/components/TopNav";
import { Footer } from "@/components/Footer";
import { Badge } from "@/components/ui/Badge";
import { Reviews } from "@/components/Reviews";
import { getProduct, getFavoriteSet, getRecentPurchaseCount, getRelatedProducts } from "@/lib/server/queries";
import { ProductCard } from "@/components/ProductCard";
import { getMe } from "@/lib/session";
import { isDataUrl } from "@/lib/utils";
import { FavoriteButton } from "@/components/FavoriteButton";
import { ExpandableText } from "@/components/ExpandableText";
import { RecentPing } from "@/components/RecentPing";
import { ShareButton } from "@/components/ShareButton";
import { ProductQuestions } from "@/components/ProductQuestions";
import { prisma } from "@/lib/server/prisma";
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
  // Resolve the session first (cheap cookie decode) so the remaining DB
  // reads can fan out in the same Promise.all — eliminates the serial
  // getFavoriteSet await that was adding one extra Neon roundtrip.
  const me = await getMe();
  const [product, favSet, recentBuyers, questions, related] = await Promise.all([
    getProduct(id) as Promise<Product | null>,
    getFavoriteSet(me?.user.userId),
    getRecentPurchaseCount(id, 7),
    prisma.productQuestion.findMany({
      where: { productId: id },
      orderBy: { createdAt: "desc" },
      include: {
        asker:    { select: { userId: true, username: true, firstName: true, lastName: true, profileImage: true } },
        answerer: { select: { userId: true, username: true, firstName: true, lastName: true, profileImage: true } },
      },
    }),
    getRelatedProducts(id, 4),
  ]);
  if (!product) return notFound();
  // Seller-or-admin can answer questions on this product.
  const canAnswer =
    me?.role === "admin" ||
    (me?.user.store?.storeId !== undefined && me.user.store.storeId === product.store.storeId);
  const isFavorited = favSet.has(product.productId);

  // Hydrate per-variant restock subscription state so the bell button
  // shows the right colour without a client round-trip.
  const alertSet = me
    ? new Set(
        (
          await prisma.stockAlert.findMany({
            where: {
              userId: me.user.userId,
              productItemId: { in: product.items.map((it) => it.productItemId) },
            },
            select: { productItemId: true },
          })
        ).map((a) => a.productItemId),
      )
    : new Set<number>();

  const items = product.items.map((it) => ({
    ...it,
    price: Number(it.price),
    finalPrice: Number(it.price) * (1 - (it.discountPercent ?? 0) / 100),
    // Expose stock to AddToCart so it can cap the typed input correctly.
    stock: it.quantity,
    sampleUrl: (it as { sampleUrl?: string | null }).sampleUrl ?? null,
    alreadySubscribed: alertSet.has(it.productItemId),
  }));

  return (
    <>
      <TopNav />
      {/* Records this product into the user's recently-viewed history. */}
      <RecentPing productId={product.productId} />
      <main id="main" className="mx-auto max-w-[1440px] px-6 md:px-10 py-10">
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
            <div className="flex items-start gap-3 mb-3">
              <h1 className="font-display text-3xl md:text-4xl font-extrabold tracking-tight text-white flex-1">
                {product.name}
              </h1>
              <FavoriteButton productId={product.productId} initial={isFavorited} size="md" />
              <ShareButton title={product.name} text={`Check out "${product.name}" on METU`} size="md" />
            </div>
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
            {/* Social proof — only render when ≥2 buyers in the last week
                so a single sale doesn't trigger an awkward "1 person bought
                this" line. */}
            {recentBuyers >= 2 && (
              <div className="inline-flex items-center gap-1.5 mb-4 rounded-full bg-orange-400/10 border border-orange-400/30 text-orange-300 px-3 py-1 text-xs font-semibold">
                <Flame className="h-3 w-3" />
                {recentBuyers} {recentBuyers === 1 ? "person" : "people"} bought this in the last week
              </div>
            )}
            <ExpandableText text={product.description} className="mb-6" />

            <Link
              href={`/store/${product.store.storeId}`}
              className="flex items-center gap-3 rounded-2xl surface-flat p-4 mb-6 hover:border-metu-yellow/40 transition lift-on-hover"
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

        <ProductQuestions
          productId={product.productId}
          initialQuestions={questions.map((q) => ({
            questionId: q.questionId,
            body: q.body,
            answer: q.answer,
            answeredAt: q.answeredAt ? q.answeredAt.toISOString() : null,
            createdAt: q.createdAt.toISOString(),
            asker: q.asker,
            answerer: q.answerer,
          }))}
          canAnswer={canAnswer}
          isLoggedIn={Boolean(me)}
        />

        {related.length > 0 && (
          <section className="mt-16">
            <div className="flex items-end justify-between mb-6 border-b border-white/8 pb-3">
              <h2 className="font-display text-2xl font-bold tracking-tight text-white">
                More like this
              </h2>
            </div>
            {/* Wave-3 asymmetry — first card uses the `feature` variant
                (mint surface + bigger image + gold hairline) so the grid
                stops reading as four identical tiles. */}
            <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-5">
              {related.map((p, i) => (
                <ProductCard
                  key={p.productId}
                  product={p}
                  isFavorited={favSet.has(p.productId)}
                  variant={i === 0 ? "feature" : "default"}
                  className={i === 0 ? "lg:col-span-1" : undefined}
                />
              ))}
            </div>
          </section>
        )}
      </main>
      <Footer />
    </>
  );
}
