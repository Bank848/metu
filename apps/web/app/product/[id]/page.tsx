import Image from "next/image";
import Link from "next/link";
import { Star } from "lucide-react";
import { notFound } from "next/navigation";
import { TopNav } from "@/components/TopNav";
import { Footer } from "@/components/Footer";
import { Badge } from "@/components/ui/Badge";
import { getProduct } from "@/lib/server/queries";
import { AddToCart } from "./AddToCart";

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
  const product = (await getProduct(id)) as Product | null;
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
          <Link href="/browse" className="hover:text-brand-yellow">Browse</Link>
          <span>/</span>
          <span>{product.category.categoryName}</span>
          <span>/</span>
          <span className="text-white font-medium">{product.name}</span>
        </nav>

        <div className="grid md:grid-cols-[1.15fr_1fr] gap-10">
          <Gallery images={product.images} />

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
            {product.avgRating !== undefined && (
              <div className="flex items-center gap-1 mb-4 text-sm">
                <Star className="h-4 w-4 fill-brand-yellow stroke-brand-yellow" />
                <span className="font-semibold text-white">{product.avgRating.toFixed(1)}</span>
                <span className="text-ink-dim">({product.reviewCount} reviews)</span>
              </div>
            )}
            <p className="text-ink-secondary leading-relaxed mb-6">{product.description}</p>

            <Link
              href={`/store/${product.store.storeId}`}
              className="flex items-center gap-3 rounded-2xl border border-line bg-space-850 p-4 mb-6 hover:border-brand-yellow/40 transition"
            >
              <div className="relative h-12 w-12 shrink-0 rounded-full bg-brand-yellow overflow-hidden">
                {product.store.profileImage && (
                  <Image src={product.store.profileImage} alt={product.store.name} fill sizes="48px" className="object-cover" unoptimized />
                )}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-medium text-ink-dim">{product.store.businessType?.name}</div>
                <div className="font-display font-bold text-white">{product.store.name}</div>
              </div>
              <div className="ml-auto text-xs text-ink-dim">Visit store →</div>
            </Link>

            <AddToCart items={items} />
          </div>
        </div>

        <section className="mt-14">
          <h2 className="font-display text-2xl font-bold tracking-tight text-white mb-5">
            Reviews ({product.reviewCount ?? product.reviews.length})
          </h2>
          {product.reviews.length === 0 ? (
            <p className="text-ink-dim text-sm">No reviews yet.</p>
          ) : (
            <div className="grid md:grid-cols-2 gap-5">
              {product.reviews.map((r) => (
                <div key={r.reviewId} className="rounded-2xl border border-line bg-space-850 p-5">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="relative h-9 w-9 rounded-full bg-brand-yellow overflow-hidden">
                      {r.user.profileImage && (
                        <Image src={r.user.profileImage} alt={r.user.username} fill sizes="36px" className="object-cover" unoptimized />
                      )}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-white">{r.user.firstName} {r.user.lastName}</div>
                      <div className="flex items-center gap-0.5">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            className={`h-3 w-3 ${i < r.rating ? "fill-brand-yellow stroke-brand-yellow" : "fill-space-700 stroke-space-700"}`}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                  <p className="text-sm text-ink-secondary">{r.comment}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
      <Footer />
    </>
  );
}

function Gallery({ images }: { images: Array<{ productImage: string }> }) {
  const first = images[0]?.productImage;
  return (
    <div>
      <div className="relative aspect-[4/3] rounded-2xl bg-space-900 overflow-hidden border border-line">
        {first && <Image src={first} alt="" fill sizes="60vw" className="object-cover" unoptimized />}
      </div>
      {images.length > 1 && (
        <div className="mt-3 grid grid-cols-4 gap-2">
          {images.slice(0, 4).map((img, i) => (
            <div key={i} className="relative aspect-square rounded-xl bg-space-900 overflow-hidden border border-line">
              <Image src={img.productImage} alt="" fill sizes="12vw" className="object-cover" unoptimized />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
